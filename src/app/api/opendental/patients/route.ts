import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { getOpenDentalPatients } from '@/lib/opendental/patients';
import { db } from '@/db';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { patients as patientsTable } from '@/db/schema/patients';
import { eq, sql } from 'drizzle-orm';
import { decrypt } from '@/lib/opendental/crypto';
import { upsertPatient } from '@/lib/patients/patient-repository';

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

    const [creds] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!creds) {
      return NextResponse.json(
        { error: 'Open Dental integration keys have not been added for this practice. Please configure them in Practice Settings.' },
        { status: 400 }
      );
    }

    const devKey = decrypt(creds.developerKeyEnc);
    const custKey = decrypt(creds.customerKeyEnc);

    const patients = await getOpenDentalPatients(devKey, custKey, {
      Offset: offset,
      Limit: limit,
    });

    const consentsByPatientId = new Map<number, { smsConsent: boolean; emailConsent: boolean }>();

    // Persist each patient so the list can display locally stored consent flags.
    for (const od of patients) {
      const savedPatient = await upsertPatient({
        practiceId,
        opendentalPatientId: od.PatNum,
        firstName: od.FName || 'Unknown',
        lastName: od.LName || 'Unknown',
        dateOfBirth: od.Birthdate ? od.Birthdate.split('T')[0] : null,
        phoneHome: od.HmPhone || null,
        phoneMobile: od.WirelessPhone || null,
        email: od.Email || null,
        status: od.PatStatus || 'Patient',
        opendentalUpdatedAt: od.DateTStamp ? new Date(od.DateTStamp) : null,
      });

      if (!savedPatient) {
        throw new Error('Failed to save an Open Dental patient');
      }

      consentsByPatientId.set(od.PatNum, {
        smsConsent: savedPatient.smsConsent,
        emailConsent: savedPatient.emailConsent,
      });
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(patientsTable)
      .where(eq(patientsTable.practiceId, practiceId));

    const dbCount = Number(count) || 0;
    const total = patients.length < limit
      ? offset + patients.length
      : Math.max(dbCount, offset + limit + limit);

    const data = patients.map((patient) => {
      const consents = consentsByPatientId.get(patient.PatNum);
      if (!consents) {
        throw new Error('Failed to load consent state for an Open Dental patient');
      }

      return { ...patient, ...consents };
    });

    return NextResponse.json({ data, total }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
