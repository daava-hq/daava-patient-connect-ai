import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { deleteBirthdayCampaign, updateBirthdayCampaign } from '@/lib/birthdays/birthday-service';
import { birthdayCampaignSchema } from '@/lib/birthdays/birthday-validation';

const practiceIdSchema = z.string().uuid();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const campaignId = z.string().uuid().safeParse(params.campaignId);
    if (!campaignId.success) {
      return NextResponse.json({ error: 'A valid campaignId is required' }, { status: 400 });
    }
    const parsed = birthdayCampaignSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const campaign = await updateBirthdayCampaign(
      parsed.data.practiceId,
      campaignId.data,
      parsed.data
    );
    return NextResponse.json({ data: campaign });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to update birthday campaign' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const campaignId = z.string().uuid().safeParse(params.campaignId);
    if (!campaignId.success) {
      return NextResponse.json({ error: 'A valid campaignId is required' }, { status: 400 });
    }
    const practiceId = practiceIdSchema.safeParse(req.nextUrl.searchParams.get('practiceId'));
    if (!practiceId.success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }
    await requirePracticeAdmin(session.user.id, practiceId.data);
    await deleteBirthdayCampaign(practiceId.data, campaignId.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to delete birthday campaign' }, { status: 500 });
  }
}
