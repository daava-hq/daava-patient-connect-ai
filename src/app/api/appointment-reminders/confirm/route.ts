import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError } from '@/lib/errors';
import { confirmAppointmentFromEmail } from '@/lib/appointment-reminders/reminder-service';

const confirmationSchema = z.object({
  token: z.string().min(1).max(2048),
}).strict();

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  const parsed = confirmationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid confirmation token is required' }, { status: 400 });
  }

  try {
    const data = await confirmAppointmentFromEmail(parsed.data.token);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: 'Unable to confirm this appointment. Please contact the practice.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
