import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { runRecallSync } from '@/jobs/sync-recalls';
import { AppError } from '@/lib/errors';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practiceId = params.id;
    const membership = await requirePracticeMembership(session.user.id, practiceId);
    if (!['owner', 'system-admin'].includes(membership.role.toLowerCase())) {
      return NextResponse.json({ error: 'Only practice owners can sync Open Dental data' }, { status: 403 });
    }

    const syncResult = await runRecallSync(practiceId);
    if (!syncResult.success) {
      return NextResponse.json({ error: syncResult.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        data: {
          count: syncResult.count,
          skippedCount: syncResult.skippedCount,
          message: 'Recall sync completed successfully',
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Recall synchronization failed' }, { status: 500 });
  }
}
