import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getCampaignById, transitionCampaign } from '@/lib/campaigns/campaign-service';

const cancelSchema = z.object({ practiceId: z.string().uuid() }).strict();

export async function POST(req: NextRequest, { params }: { params: { campaignId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const campaign = await getCampaignById(parsed.data.practiceId, params.campaignId);
    if (!campaign || campaign.type !== 'recall') {
      return NextResponse.json({ error: 'Recall campaign not found' }, { status: 404 });
    }
    if (campaign.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled Recall campaigns can be cancelled' }, { status: 409 });
    }
    const cancelled = await transitionCampaign(parsed.data.practiceId, params.campaignId, 'cancelled');
    return NextResponse.json({ data: cancelled });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to cancel Recall campaign' }, { status: 500 });
  }
}
