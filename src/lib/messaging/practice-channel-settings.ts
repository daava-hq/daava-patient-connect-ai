import 'server-only';
import { db } from '@/db';
import { practices } from '@/db/schema/practices';
import { eq } from 'drizzle-orm';

export type MessageChannel = 'email' | 'sms';

export async function isPracticeChannelEnabled(
  practiceId: string,
  channel: MessageChannel
): Promise<boolean> {
  const [practice] = await db
    .select({
      emailEnabled: practices.emailEnabled,
      smsEnabled: practices.smsEnabled,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);

  if (!practice) return false;
  return channel === 'email' ? practice.emailEnabled : practice.smsEnabled;
}
