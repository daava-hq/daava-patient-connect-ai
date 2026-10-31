import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { resolveAudience } from '@/lib/campaigns/audience-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const previewSchema = z.object({
  practiceId: z.string().uuid(),
  filter: z.object({
    groupIds: z.array(z.string().uuid()).optional(),
    consentSms: z.boolean().optional(),
    consentEmail: z.boolean().optional(),
    patientStatuses: z.array(z.string()).optional(),
    birthdayMonth: z.number().int().min(1).max(12).optional(),
    appointmentAfter: z.string().datetime().optional(),
    appointmentBefore: z.string().datetime().optional(),
    patientIds: z.array(z.string().uuid()).optional(),
  }).default({}),
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

    const { practiceId, filter } = parsed.data;
    await requirePracticeMembership(session.user.id, filter ? practiceId : practiceId);

    const audience = await resolveAudience(practiceId, filter);
    return NextResponse.json({ data: { count: audience.length, preview: audience.slice(0, 20) } });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
