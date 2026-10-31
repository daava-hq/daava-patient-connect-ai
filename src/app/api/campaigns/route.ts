import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { getPracticeCampaigns, createCampaign } from '@/lib/campaigns/campaign-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const createCampaignSchema = z.object({
  practiceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['reminder', 'newsletter', 'birthday', 'recall', 'payment', 'survey', 'referral']),
  channel: z.enum(['sms', 'email']),
  templateId: z.string().uuid().nullable().optional(),
  audienceFilter: z.object({
    groupIds: z.array(z.string().uuid()).optional(),
    consentSms: z.boolean().optional(),
    consentEmail: z.boolean().optional(),
    patientStatuses: z.array(z.string()).optional(),
    birthdayMonth: z.number().int().min(1).max(12).optional(),
    appointmentAfter: z.string().datetime().optional(),
    appointmentBefore: z.string().datetime().optional(),
    patientIds: z.array(z.string().uuid()).optional(),
  }).default({}),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const practiceId = searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const type = searchParams.get('type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

    const result = await getPracticeCampaigns(practiceId, {
      type,
      status,
      limit,
      offset: (page - 1) * limit,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, scheduledAt, templateId, ...rest } = parsed.data;

    await requirePracticeMembership(session.user.id, practiceId);

    const campaign = await createCampaign({
      practiceId,
      ...rest,
      templateId: templateId ?? undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
