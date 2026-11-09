import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logError } from '@/lib/logger';
import { ensurePracticeGroups } from '@/lib/groups/group-repository';
import { countAudience } from '@/lib/campaigns/audience-service';
import {
  createNewsletterCampaign,
  getNewsletterDashboardStats,
  getPracticeCampaigns,
} from '@/lib/campaigns/campaign-service';
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

const createSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  sourceTemplateId: z.string().uuid(),
  audienceFilter: audienceFilterSchema,
}).strict();

const querySchema = z.object({
  practiceId: z.string().uuid(),
  status: z.enum(['draft', 'scheduled', 'processing', 'completed', 'partially_failed', 'failed', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  let stage = 'session';
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    stage = 'validation';
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    const { practiceId, status, page, limit } = parsed.data;
    stage = 'authorization';
    await requirePracticeMembership(session.user.id, practiceId);
    stage = 'campaign-list';
    const result = await getPracticeCampaigns(practiceId, {
      type: 'newsletter',
      status,
      limit,
      offset: (page - 1) * limit,
    });
    stage = 'dashboard-stats';
    const stats = await getNewsletterDashboardStats(practiceId);
    return NextResponse.json({ data: { ...result, page, stats } });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    logError('Unable to load newsletters', error, { stage });
    return NextResponse.json({ error: 'Unable to load newsletters' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });

    const { practiceId, sourceTemplateId, audienceFilter } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);
    await ensurePracticeGroups(practiceId, audienceFilter.groupIds ?? []);

    const source = await getPublishedNewsletterTemplate(practiceId, sourceTemplateId);
    if (!source) return NextResponse.json({ error: 'Select a published email newsletter template' }, { status: 400 });

    let normalizedContent;
    try {
      normalizedContent = parseNewsletterDocument(source.content);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid newsletter content' }, { status: 400 });
    }
    const filter = { ...audienceFilter, patientStatuses: ['Patient'], consentEmail: true };
    const audienceSize = await countAudience(practiceId, filter);

    const campaign = await createNewsletterCampaign({
      practiceId,
      name: parsed.data.name,
      content: normalizedContent,
      audienceFilter: filter,
    });
    return NextResponse.json({ data: { campaign, audienceSize } }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    logError('Unable to create newsletter draft', error);
    return NextResponse.json({ error: 'Unable to create newsletter draft' }, { status: 500 });
  }
}
