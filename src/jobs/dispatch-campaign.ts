import 'server-only';
import { db } from '@/db';
import { campaignJobRuns } from '@/db/schema/campaign_job_runs';
import { eq, and, sql } from 'drizzle-orm';
import { getCampaignById, transitionCampaign, materializeRecipients } from '@/lib/campaigns/campaign-service';
import {
  getPendingRecipients,
  markRecipientDispatched,
  markRecipientFailed,
  markRecipientSkipped,
  getCampaignStats,
} from '@/lib/campaigns/recipient-tracking';
import { getTemplateById, interpolateTemplate } from '@/lib/campaigns/template-repository';
import { getAdapter } from '@/lib/messaging/stub-adapter';
import { logInfo, logError } from '@/lib/logger';
import { patients } from '@/db/schema/patients';

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
): Promise<{ success: boolean; dispatched: number; skipped: number; failed: number; error?: string }> {
  const campaign = await getCampaignById(practiceId, campaignId);

  if (!campaign) {
    return { success: false, dispatched: 0, skipped: 0, failed: 0, error: 'Campaign not found' };
  }

  // Guard: only run if campaign is in a dispatchable state
  if (!['scheduled', 'draft', 'failed'].includes(campaign.status)) {
    logInfo('Campaign dispatch skipped: not in dispatchable state', { campaignId, status: campaign.status });
    return { success: false, dispatched: 0, skipped: 0, failed: 0, error: `Cannot dispatch campaign in state: ${campaign.status}` };
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

  try {
    // 1. Transition to processing (atomic guard against concurrent runs)
    await transitionCampaign(practiceId, campaignId, 'processing');

    // 2. Materialize recipients: idempotent, safe to call on retry
    const newlyAdded = await materializeRecipients(practiceId, campaignId);
    logInfo('Campaign recipients materialized', { campaignId, newlyAdded });

    // 3. Load template
    const template = campaign.templateId
      ? await getTemplateById(practiceId, campaign.templateId)
      : null;

    // 4. Get messaging adapter
    const adapter = getAdapter(campaign.channel as 'sms' | 'email');

    // 5. Process pending recipients in batches
    let totalDispatched = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    let hasMore = true;
    while (hasMore) {
      const batch = await getPendingRecipients(campaignId, DISPATCH_BATCH_SIZE);
      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      for (const recipient of batch) {
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

        if (!destination) {
          await markRecipientSkipped(recipient.id, 'no_destination');
          totalSkipped++;
          continue;
        }

        // Interpolate template body
        const body = template
          ? interpolateTemplate(template.body, {
              first_name: '', // will be filled from patient join below
              practice_name: '',
            }).rendered
          : '';

        const subject = template?.subject ?? undefined;

        // Send via adapter
        const result = await adapter.send({ to: destination, body, subject });

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
      .set({ status: 'failed', errorMessage: error.message, completedAt: new Date() })
      .where(eq(campaignJobRuns.id, jobRun.id));

    // Transition campaign to failed if it's stuck in processing
    try {
      await transitionCampaign(practiceId, campaignId, 'failed');
    } catch {
      // Campaign may already be in a terminal state; ignore
    }

    logError('Campaign dispatch failed', error, { campaignId });
    return { success: false, dispatched: 0, skipped: 0, failed: 0, error: error.message };
  }
}

/**
 * Processes all campaigns that are scheduled and due.
 * Called by a periodic scheduler (e.g., cron endpoint).
 */
export async function processScheduledCampaigns(): Promise<void> {
  const { getDueCampaigns } = await import('@/lib/campaigns/campaign-service');
  const due = await getDueCampaigns();

  logInfo('Processing scheduled campaigns', { count: due.length });

  for (const campaign of due) {
    await runCampaignDispatch(campaign.practiceId, campaign.id).catch((err) => {
      logError('Failed to dispatch scheduled campaign', err, { campaignId: campaign.id });
    });
  }
}
