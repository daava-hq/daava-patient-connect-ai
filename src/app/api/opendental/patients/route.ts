import { NextRequest, NextResponse } from 'next/server';
import { getOpenDentalPatients } from '@/lib/opendental/patients';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
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

    return NextResponse.json({ data: patients }, { status: 200 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
