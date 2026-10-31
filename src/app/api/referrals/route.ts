import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { getPracticeReferrals, createReferral, updateReferralStatus } from '@/lib/referrals/referral-repository';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const createReferralSchema = z.object({
  practiceId: z.string().uuid(),
  patientId: z.string().uuid(),
  referrerName: z.string().optional(),
  referredTo: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const referrals = await getPracticeReferrals(practiceId);
    return NextResponse.json({ data: referrals });
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
    const parsed = createReferralSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...rest } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const referral = await createReferral({ practiceId, ...rest });
    return NextResponse.json({ data: referral }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { practiceId, referralId, status } = body;
    if (!practiceId || !referralId || !status) {
      return NextResponse.json({ error: 'practiceId, referralId, and status are required' }, { status: 400 });
    }

    await requirePracticeMembership(session.user.id, practiceId);
    const updated = await updateReferralStatus(practiceId, referralId, status);
    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
