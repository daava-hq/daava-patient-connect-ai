import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { runPatientSync } from '@/jobs/sync-patients';
import { AppError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    await requirePracticeMembership(session.user.id, practiceId);

    const syncResult = await runPatientSync(practiceId);

    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error }, { status: 400 });
    }

    return NextResponse.json({ data: { count: syncResult.count, message: 'Sync completed successfully' } }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
