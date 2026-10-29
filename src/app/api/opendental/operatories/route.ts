import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getOpenDentalOperatories } from '@/lib/opendental/providers';
import { db } from '@/db';
import { practiceOpendentalCredentials } from '@/db/schema/practice_credentials';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/opendental/crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const practiceId = searchParams.get('practiceId');

    if (!practiceId) {
      return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });
    }

    const [creds] = await db
      .select()
      .from(practiceOpendentalCredentials)
      .where(eq(practiceOpendentalCredentials.practiceId, practiceId))
      .limit(1);

    if (!creds) {
      return NextResponse.json(
        { error: 'Open Dental integration keys have not been added for this practice.' },
        { status: 400 }
      );
    }

    const devKey = decrypt(creds.developerKeyEnc);
    const custKey = decrypt(creds.customerKeyEnc);

    const operatories = await getOpenDentalOperatories(devKey, custKey);
    return NextResponse.json({ data: operatories }, { status: 200 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
