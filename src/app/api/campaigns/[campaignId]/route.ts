import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import {
  getCampaignById,
  updateCampaign,
  transitionCampaign,
  softDeleteCampaign,
} from '@/lib/campaigns/campaign-service';
import { getCampaignStats } from '@/lib/campaigns/recipient-tracking';
import { AppError } from '@/lib/errors';
import { z } from 'zod';
import { CampaignStatus } from '@/db/schema/campaigns';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  templateId: z.string().uuid().nullable().optional(),
  audienceFilter: z.object({}).passthrough().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

const transitionSchema = z.object({
  status: z.enum(['scheduled', 'cancelled', 'processing', 'completed', 'partially_failed', 'failed']),
});

export async function GET(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const campaign = await getCampaignById(practiceId, params.campaignId);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const stats = await getCampaignStats(params.campaignId);

    return NextResponse.json({ data: { ...campaign, stats } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    // Status transition
    const transitionParsed = transitionSchema.safeParse(body);
    if (transitionParsed.success) {
      const practiceId = body.practiceId as string;
      if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });
      await requirePracticeMembership(session.user.id, practiceId);
      const updated = await transitionCampaign(practiceId, params.campaignId, transitionParsed.data.status as CampaignStatus);
      return NextResponse.json({ data: updated });
    }

    // Field update
    const updateParsed = updateSchema.safeParse(body);
    if (!updateParsed.success) {
      return NextResponse.json({ error: 'Validation error', details: updateParsed.error.flatten() }, { status: 400 });
    }

    const practiceId = body.practiceId as string;
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });
    await requirePracticeMembership(session.user.id, practiceId);

    const { scheduledAt, templateId, ...rest } = updateParsed.data;
    const updated = await updateCampaign(practiceId, params.campaignId, {
      ...rest,
      templateId: templateId ?? undefined,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);
    await softDeleteCampaign(practiceId, params.campaignId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
