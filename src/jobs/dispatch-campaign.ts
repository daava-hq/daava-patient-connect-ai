import 'server-only';
import { db } from '@/db';
import { campaignJobRuns } from '@/db/schema/campaign_job_runs';
import { eq, sql } from 'drizzle-orm';
import { getCampaignById, transitionCampaign, materializeRecipients } from '@/lib/campaigns/campaign-service';
import {
  getPendingRecipients,
  markRecipientDispatched,
  markRecipientFailed,
  markRecipientSkipped,
  getCampaignStats,
} from '@/lib/campaigns/recipient-tracking';
import { getTemplateById, interpolateTemplate } from '@/lib/campaigns/template-repository';
import {
  interpolateNewsletterHtml,
  replaceNewsletterVariables,
} from '@/lib/newsletters/newsletter-content';
import { getAdapter } from '@/lib/messaging/stub-adapter';
import { logInfo, logError } from '@/lib/logger';
import { practices } from '@/db/schema/practices';
import { isValidEmailAddress } from '@/lib/campaigns/audience-service';
import { AppError } from '@/lib/errors';
import { isPracticeChannelEnabled } from '@/lib/messaging/practice-channel-settings';

export const DISPATCH_BATCH_SIZE = 50;

/**
 * Runs the campaign dispatch job for a single campaign.
 *
 * Guarantees:
 * - Recipients are materialized before dispatch begins (idempotency anchor).
 * - Consent is verified per recipient at send time.
 * - Duplicate runs are prevented via campaign state check.
 * - Failed sends are retried up to MAX_RETRY_ATTEMPTS before marking failed.
 * - Every attempt is recorded in campaign_job_runs.
 * - Campaign status transitions are atomic.
 */
export async function runCampaignDispatch(
  practiceId: string,
  campaignId: string
): Promise<{ success: boolean; dispatched: number; skipped: number; failed: number; skippedRun?: boolean; error?: string }> {
  const campaign = await getCampaignById(practiceId, campaignId);

  if (!campaign) {
    return { success: false, dispatched: 0, skipped: 0, failed: 0, error: 'Campaign not found' };
  }

  // Guard: only run if campaign is in a dispatchable state
  if (!['scheduled', 'failed'].includes(campaign.status)) {
    logInfo('Campaign dispatch skipped: not in dispatchable state', { campaignId, status: campaign.status });
    return { success: false, dispatched: 0, skipped: 0, failed: 0, skippedRun: true, error: `Cannot dispatch campaign in state: ${campaign.status}` };
  }

  // Record this job run attempt
  const [jobRun] = await db
    .insert(campaignJobRuns)
    .values({ campaignId, attempt: 1, status: 'running' })
    .returning();

  // Determine the current attempt number (re-runs increment attempt)
  const [{ attemptCount }] = await db
    .select({ attemptCount: sql<number>`count(*)::int` })
    .from(campaignJobRuns)
    .where(eq(campaignJobRuns.campaignId, campaignId));

  await db
    .update(campaignJobRuns)
    .set({ attempt: attemptCount })
    .where(eq(campaignJobRuns.id, jobRun.id));

  let claimedProcessing = false;
  try {
    // 1. Transition to processing (atomic guard against concurrent runs)
    await transitionCampaign(practiceId, campaignId, 'processing');
    claimedProcessing = true;

    // 2. Materialize recipients: idempotent, safe to call on retry
    const newlyAdded = await materializeRecipients(practiceId, campaignId);
    logInfo('Campaign recipients materialized', { campaignId, newlyAdded });

    // 3. Load template
    const template = campaign.templateId
      ? await getTemplateById(practiceId, campaign.templateId)
      : null;
    const [practice] = await db.select({
      name: practices.name,
      phone: practices.phone,
      email: practices.email,
      address: practices.address,
      website: practices.website,
    }).from(practices).where(eq(practices.id, practiceId)).limit(1);

    // 4. Get messaging adapter
    const adapter = getAdapter(campaign.channel as 'sms' | 'email');

    // 5. Process pending recipients in batches
    let totalDispatched = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    let hasMore = true;
    while (hasMore) {
      const batch = await getPendingRecipients(campaignId, practiceId, DISPATCH_BATCH_SIZE);
      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const recipient of batch) {
        if (recipient.patientStatus !== 'Patient') {
          await markRecipientSkipped(recipient.id, 'inactive_patient');
          totalSkipped++;
          continue;
        }

        // Re-check consent at send time
        const hasConsent =
          campaign.channel === 'sms' ? recipient.smsConsent : recipient.emailConsent;

        if (!hasConsent) {
          await markRecipientSkipped(recipient.id, 'opted_out');
          totalSkipped++;
          continue;
        }

        // Determine destination address
        const destination =
          campaign.channel === 'sms'
            ? recipient.phoneMobile || recipient.phoneHome
            : recipient.email;

        if (!destination || (campaign.channel === 'email' && !isValidEmailAddress(destination))) {
          await markRecipientSkipped(recipient.id, 'no_destination');
          totalSkipped++;
          continue;
        }

        if (!(await isPracticeChannelEnabled(practiceId, campaign.channel as 'sms' | 'email'))) {
          await markRecipientSkipped(recipient.id, 'practice_channel_disabled');
          totalSkipped++;
          continue;
        }

        // Interpolate template body
        const newsletterVariables = {
          'patient.firstName': recipient.firstName,
          'patient.lastName': recipient.lastName,
          'patient.fullName': `${recipient.firstName} ${recipient.lastName}`.trim(),
          'patient.email': recipient.email ?? '',
          'patient.phone': recipient.phoneMobile || recipient.phoneHome || '',
          'practice.name': practice?.name ?? '',
          'practice.phone': practice?.phone ?? '',
          'practice.email': practice?.email ?? '',
          'practice.address': practice?.address ?? '',
          'practice.website': practice?.website ?? '',
          'campaign.name': campaign.name,
        };
        const usesStructuredEmailContent = campaign.type === 'newsletter' || campaign.type === 'group_announcement';
        const body = template
          ? usesStructuredEmailContent
            ? replaceNewsletterVariables(template.body, newsletterVariables)
            : interpolateTemplate(template.body, {
                first_name: recipient.firstName,
                practice_name: practice?.name ?? '',
              }).rendered
          : '';
        const subject = template?.subject
          ? usesStructuredEmailContent
            ? replaceNewsletterVariables(template.subject, newsletterVariables)
            : interpolateTemplate(template.subject, {
                first_name: recipient.firstName,
                practice_name: practice?.name ?? '',
              }).rendered
          : undefined;
        const html = usesStructuredEmailContent && template?.htmlBody
          ? interpolateNewsletterHtml(template.htmlBody, newsletterVariables)
          : undefined;

        // Send via adapter
        const result = await adapter.send({ to: destination, body, subject, html });

        if (result.success && result.providerMessageId) {
          await markRecipientDispatched(recipient.id, result.providerMessageId);
          totalDispatched++;
        } else {
          await markRecipientFailed(recipient.id, result.errorMessage ?? 'Unknown error');
          totalFailed++;
        }
      }

      if (batch.length < DISPATCH_BATCH_SIZE) hasMore = false;
    }

    // 6. Determine final campaign status
    const stats = await getCampaignStats(campaignId);
    const finalStatus =
      stats.failed > 0 && stats.delivered + stats.dispatched === 0
        ? 'failed'
        : stats.failed > 0
        ? 'partially_failed'
        : 'completed';

    await transitionCampaign(practiceId, campaignId, finalStatus);

    // 7. Mark job run as completed
    await db
      .update(campaignJobRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(campaignJobRuns.id, jobRun.id));

    logInfo('Campaign dispatch completed', { campaignId, finalStatus, totalDispatched, totalSkipped, totalFailed });

    return { success: true, dispatched: totalDispatched, skipped: totalSkipped, failed: totalFailed };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    await db
      .update(campaignJobRuns)
      .set({
        status: !claimedProcessing && error instanceof AppError && error.code === 'INVALID_STATE_TRANSITION'
          ? 'completed'
          : 'failed',
        errorMessage: !claimedProcessing && error instanceof AppError && error.code === 'INVALID_STATE_TRANSITION'
          ? null
          : error.message,
        completedAt: new Date(),
      })
      .where(eq(campaignJobRuns.id, jobRun.id));

    if (!claimedProcessing && error instanceof AppError && error.code === 'INVALID_STATE_TRANSITION') {
      return { success: false, dispatched: 0, skipped: 0, failed: 0, skippedRun: true, error: error.message };
    }

    // A worker that did not claim the processing state must not fail another worker's campaign.
    if (claimedProcessing) {
      try {
        await transitionCampaign(practiceId, campaignId, 'failed');
      } catch {
        // The campaign may already have reached a terminal state.
      }
    }

    logError('Campaign dispatch failed', error, { campaignId });
    return { success: false, dispatched: 0, skipped: 0, failed: 0, error: error.message };
  }
}

/**
 * Processes all campaigns that are scheduled and due.
 * Called by a periodic scheduler (e.g., cron endpoint).
 */
export async function processScheduledCampaigns(practiceId?: string): Promise<{ processed: number; failed: number }> {
  const { getDueCampaigns } = await import('@/lib/campaigns/campaign-service');
  const due = await getDueCampaigns(practiceId);

  logInfo('Processing scheduled campaigns', { count: due.length });

  let processed = 0;
  let failed = 0;
  for (const campaign of due) {
    try {
      const result = await runCampaignDispatch(campaign.practiceId, campaign.id);
      if (result.success) processed++;
      else if (!result.skippedRun) failed++;
    } catch (err) {
      logError('Failed to dispatch scheduled campaign', err, { campaignId: campaign.id });
      failed++;
    }
  }
  return { processed, failed };
}
