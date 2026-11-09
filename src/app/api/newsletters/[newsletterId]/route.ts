import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z, ZodError } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { ensurePracticeGroups } from '@/lib/groups/group-repository';
import {
  getNewsletterDetails,
  updateNewsletterDraft,
} from '@/lib/campaigns/campaign-service';
import { getCampaignStats } from '@/lib/campaigns/recipient-tracking';
import { getPublishedNewsletterTemplate } from '@/lib/templates/template-service';
import { parseNewsletterDocument } from '@/lib/newsletters/newsletter-content';

const audienceFilterSchema = z.object({
  groupIds: z.array(z.string().uuid()).max(100).optional(),
  patientIds: z.array(z.string().uuid()).max(500).optional(),
  patientStatuses: z.array(z.literal('Patient')).max(1).optional(),
  birthdayMonth: z.number().int().min(1).max(12).optional(),
  appointmentAfter: z.string().datetime().optional(),
  appointmentBefore: z.string().datetime().optional(),
}).strict().default({});

const updateSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  sourceTemplateId: z.string().uuid().optional(),
  audienceFilter: audienceFilterSchema,
}).strict();

export async function GET(req: NextRequest, { params }: { params: { newsletterId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const practiceId = req.nextUrl.searchParams.get('practiceId');
    if (!practiceId || !z.string().uuid().safeParse(practiceId).success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, practiceId);
    const details = await getNewsletterDetails(practiceId, params.newsletterId);
    if (!details) return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    const stats = await getCampaignStats(params.newsletterId);
    return NextResponse.json({ data: { ...details, stats } });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to load newsletter' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { newsletterId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    const { practiceId, audienceFilter, sourceTemplateId } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);
    await ensurePracticeGroups(practiceId, audienceFilter.groupIds ?? []);

    let content: unknown;
    if (sourceTemplateId) {
      const source = await getPublishedNewsletterTemplate(practiceId, sourceTemplateId);
      if (!source) return NextResponse.json({ error: 'Select a published email newsletter template' }, { status: 400 });
      try {
        content = parseNewsletterDocument(source.content);
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid newsletter template content' }, { status: 400 });
      }
    }

    const campaign = await updateNewsletterDraft({
      practiceId,
      campaignId: params.newsletterId,
      name: parsed.data.name,
      content,
      audienceFilter: { ...audienceFilter, patientStatuses: ['Patient'], consentEmail: true },
    });
    return NextResponse.json({ data: campaign });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to save newsletter draft' }, { status: 500 });
  }
}
