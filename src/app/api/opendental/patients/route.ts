import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getPracticePatients } from '@/lib/patients/patient-repository';

const querySchema = z.object({
  practiceId: z.string().uuid(),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedQuery = querySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams)
    );
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.flatten() }, { status: 400 });
    }

    const { practiceId, offset, limit } = parsedQuery.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const result = await getPracticePatients(practiceId, { limit, offset });
    return NextResponse.json({
      data: result.patients.map((patient) => ({
        PatNum: patient.opendentalPatientId,
        FName: patient.firstName,
        LName: patient.lastName,
        Birthdate: patient.dateOfBirth ?? undefined,
        HmPhone: patient.phoneHome ?? undefined,
        WirelessPhone: patient.phoneMobile ?? undefined,
        Email: patient.email ?? undefined,
        PatStatus: patient.status,
        smsConsent: patient.smsConsent,
        emailConsent: patient.emailConsent,
      })),
      total: result.total,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
