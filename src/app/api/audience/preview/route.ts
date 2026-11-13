import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { countAudience, resolveAudience } from '@/lib/campaigns/audience-service';
import { AppError } from '@/lib/errors';
import { ensurePracticeGroups, ensureRecallAudienceGroups } from '@/lib/groups/group-repository';
import { withRecallAudienceDefaults } from '@/lib/campaigns/recall-audience';
import { z } from 'zod';

const previewSchema = z.object({
  practiceId: z.string().uuid(),
  type: z.enum(['standard', 'recall']).default('standard'),
  channel: z.enum(['sms', 'email']).optional(),
  filter: z.object({
    groupIds: z.array(z.string().uuid()).max(100).optional(),
    consentSms: z.boolean().optional(),
    consentEmail: z.boolean().optional(),
    patientStatuses: z.array(z.string()).optional(),
    birthdayMonth: z.number().int().min(1).max(12).optional(),
    appointmentAfter: z.string().datetime().optional(),
    appointmentBefore: z.string().datetime().optional(),
    patientIds: z.array(z.string().uuid()).optional(),
  }).strict().default({}),
}).superRefine((value, context) => {
  if (value.type === 'recall') {
    if (!value.channel) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['channel'], message: 'Recall preview requires a channel' });
    }
    if (!value.filter.groupIds?.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['filter', 'groupIds'], message: 'Select at least one due-recall group' });
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId } = parsed.data;
    if (parsed.data.type === 'recall' && !parsed.data.channel) {
      return NextResponse.json({ error: 'Recall preview requires a channel' }, { status: 400 });
    }
    const filter = parsed.data.type === 'recall' && parsed.data.channel
      ? withRecallAudienceDefaults(parsed.data.channel, parsed.data.filter)
      : parsed.data.filter;
    await requirePracticeMembership(session.user.id, practiceId);
    if (parsed.data.type === 'recall') {
      await ensureRecallAudienceGroups(practiceId, filter.groupIds ?? []);
    } else {
      await ensurePracticeGroups(practiceId, filter.groupIds ?? []);
    }

    const [count, previewPatients] = await Promise.all([
      countAudience(practiceId, filter),
      resolveAudience(practiceId, filter, 20),
    ]);
    const preview = previewPatients.map(({ firstName, lastName }) => ({ firstName, lastName }));
    return NextResponse.json({ data: { count, preview } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
