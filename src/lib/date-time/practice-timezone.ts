import { localDateTimeToInstant } from '@/lib/appointment-reminders/reminder-utils';

export function toPracticeInstant(value: string, timeZone: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match) return undefined;

  return localDateTimeToInstant(
    { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) },
    match[4],
    timeZone,
  ).toISOString();
}

export function fromPracticeInstant(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}T${values.get('hour')}:${values.get('minute')}`;
}

export function formatPracticeDateTime(value: string, timeZone: string): string {
  const instant = toPracticeInstant(value, timeZone);
  if (!instant) return value;

  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(instant));
}
