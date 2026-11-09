import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/options';
import { requirePracticeAdmin, requirePracticeMembership } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import {
  createBirthdayCampaign,
  getBirthdayCampaigns,
  getBirthdayTemplateOptions,
} from '@/lib/birthdays/birthday-service';
import { birthdayCampaignSchema } from '@/lib/birthdays/birthday-validation';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const practiceId = z.string().uuid().safeParse(req.nextUrl.searchParams.get('practiceId'));
    if (!practiceId.success) {
      return NextResponse.json({ error: 'A valid practiceId is required' }, { status: 400 });
    }
    await requirePracticeMembership(session.user.id, practiceId.data);
    const [campaigns, templates] = await Promise.all([
      getBirthdayCampaigns(practiceId.data),
      getBirthdayTemplateOptions(practiceId.data),
    ]);
    return NextResponse.json({ data: { campaigns, templates } });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to load birthday campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = birthdayCampaignSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }
    await requirePracticeAdmin(session.user.id, parsed.data.practiceId);
    const campaign = await createBirthdayCampaign(parsed.data.practiceId, session.user.id, parsed.data);
    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Unable to create birthday campaign' }, { status: 500 });
  }
}
