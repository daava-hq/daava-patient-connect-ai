import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getGroupAnnouncementDetails, transitionCampaign } from '@/lib/campaigns/campaign-service';

const cancelSchema = z.object({ practiceId: z.string().uuid() }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string; campaignId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const groupId = z.string().uuid().safeParse(params.groupId);
    const campaignId = z.string().uuid().safeParse(params.campaignId);
    if (!groupId.success || !campaignId.success) {
      return NextResponse.json({ error: 'Valid group and campaign IDs are required' }, { status: 400 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });

    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const announcement = await getGroupAnnouncementDetails(
      parsed.data.practiceId,
      groupId.data,
      campaignId.data,
    );
    if (!announcement) return NextResponse.json({ error: 'Group announcement not found' }, { status: 404 });
    if (announcement.campaign.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled group announcements can be cancelled' }, { status: 409 });
    }
    const campaign = await transitionCampaign(parsed.data.practiceId, campaignId.data, 'cancelled');
    return NextResponse.json({ data: campaign });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to cancel group announcement' }, { status: 500 });
  }
}
