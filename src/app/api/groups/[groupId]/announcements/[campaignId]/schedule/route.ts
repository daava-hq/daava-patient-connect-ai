import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { scheduleGroupAnnouncement } from '@/lib/campaigns/campaign-service';

const scheduleSchema = z.object({
  practiceId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
  sendNow: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (!value.sendNow && !value.scheduledAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledAt'], message: 'Choose a scheduled time or send now' });
  }
});

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
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const scheduledAt = parsed.data.sendNow
      ? new Date(Date.now() + 5000)
      : new Date(parsed.data.scheduledAt!);
    const campaign = await scheduleGroupAnnouncement(
      parsed.data.practiceId,
      groupId.data,
      campaignId.data,
      scheduledAt,
    );
    return NextResponse.json({ data: campaign }, { status: 202 });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unable to schedule group announcement' }, { status: 500 });
  }
}
