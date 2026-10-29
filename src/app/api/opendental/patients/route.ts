import { NextRequest, NextResponse } from 'next/server';
import { getOpenDentalPatients } from '@/lib/opendental/patients';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { patients as patientsTable } from '@/db/schema/patients';
import { eq, sql } from 'drizzle-orm';
import { decrypt } from '@/lib/opendental/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let practiceId = searchParams.get('practiceId');
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!practiceId) {
      const [defaultPractice] = await db
        .select({ id: practices.id })
        .from(practices)
        .limit(1);
      practiceId = defaultPractice?.id || 'c678c32c-2eeb-47ae-95ff-3938bc40e54b';
    }

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

    // Auto-upsert fetched patients into local database for accurate count and offline caching
    for (const od of patients) {
      await db
        .insert(patientsTable)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [patientsTable.practiceId, patientsTable.opendentalPatientId],
          set: {
            firstName: od.FName || 'Unknown',
            lastName: od.LName || 'Unknown',
            dateOfBirth: od.Birthdate ? od.Birthdate.split('T')[0] : null,
            phoneHome: od.HmPhone || null,
            phoneMobile: od.WirelessPhone || null,
            email: od.Email || null,
            status: od.PatStatus || 'Patient',
            opendentalUpdatedAt: od.DateTStamp ? new Date(od.DateTStamp) : null,
            syncedAt: new Date(),
            updatedAt: new Date(),
          },
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

    return NextResponse.json({ data: patients, total }, { status: 200 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
