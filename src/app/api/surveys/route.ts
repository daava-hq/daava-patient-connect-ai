import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeMembership } from '@/lib/auth/guards';
import { getPracticeSurveys, createSurvey } from '@/lib/surveys/survey-repository';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const createSurveySchema = z.object({
  practiceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(z.object({ id: z.string(), text: z.string(), type: z.string() })).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const practiceId = new URL(req.url).searchParams.get('practiceId');
    if (!practiceId) return NextResponse.json({ error: 'practiceId is required' }, { status: 400 });

    await requirePracticeMembership(session.user.id, practiceId);

    const surveys = await getPracticeSurveys(practiceId);
    return NextResponse.json({ data: surveys });
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
    const parsed = createSurveySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { practiceId, ...rest } = parsed.data;
    await requirePracticeMembership(session.user.id, practiceId);

    const survey = await createSurvey({ practiceId, ...rest });
    return NextResponse.json({ data: survey }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
