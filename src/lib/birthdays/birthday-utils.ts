import { localDateTimeToInstant } from '@/lib/appointment-reminders/reminder-utils';

export type BirthdayRange = 'today' | 'tomorrow' | 'next7' | 'thisMonth' | 'custom';

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

export function getBirthdaySuppressionReason(input: {
  patientStatus: string;
  dateOfBirth: string | null;
  hasConsent: boolean;
  hasDestination: boolean;
}): string | null {
  if (input.patientStatus !== 'Patient') return 'Patient is no longer active';
  if (!parseDateKey(input.dateOfBirth ?? undefined)) {
    return 'Patient birthdate is unavailable';
  }
  if (!input.hasConsent) return 'Patient opted out';
  if (!input.hasDestination) return 'Patient has no contact for this channel';
  return null;
}

export function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
  };
}

export function dateKey({ year, month, day }: LocalDateParts): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

export function getBirthdayInYear(dateOfBirth: string | null, year: number): LocalDateParts | null {
  if (!dateOfBirth) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const month = Number(match[2]);
  const birthDay = Number(match[3]);
  const parsed = new Date(Date.UTC(Number(match[1]), month - 1, birthDay));
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== birthDay
  ) {
    return null;
  }
  const day = month === 2 && birthDay === 29 && !isLeapYear(year) ? 28 : birthDay;
  return { year, month, day };
}

export function getNextBirthdayOccurrence(input: {
  dateOfBirth: string | null;
  daysBefore: number;
  localDeliveryTime: string;
  timeZone: string;
  now: Date;
}): { birthdayYear: number; scheduledFor: Date; birthdayDate: LocalDateParts } | null {
  if (!input.dateOfBirth) return null;
  const today = getLocalDateParts(input.now, input.timeZone);
  for (const year of [today.year, today.year + 1]) {
    const birthdayDate = getBirthdayInYear(input.dateOfBirth, year);
    if (!birthdayDate) return null;
    const deliveryDate = addLocalDays(birthdayDate, -input.daysBefore);
    const scheduledFor = localDateTimeToInstant(deliveryDate, input.localDeliveryTime, input.timeZone);
    if (scheduledFor > input.now || dateKey(deliveryDate) === dateKey(today)) {
      return { birthdayYear: year, scheduledFor, birthdayDate };
    }
  }
  return null;
}

export function getBirthdayDateKeys(
  start: LocalDateParts,
  end: LocalDateParts
): string[] {
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  if (endKey < startKey) throw new RangeError('End date must be on or after start date');
  const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));
  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (dayCount > 366) throw new RangeError('Birthday date range cannot exceed 366 days');

  const dates = new Set<string>();
  for (let offset = 0; offset < dayCount; offset++) {
    const day = new Date(startDate.getTime() + offset * 86_400_000);
    const key = `${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
    dates.add(key);
    if (key === '02-28' && !isLeapYear(day.getUTCFullYear())) dates.add('02-29');
  }
  return Array.from(dates);
}

export function getBirthdayDateRange(
  range: BirthdayRange,
  now: Date,
  timeZone: string,
  customStart?: string,
  customEnd?: string
): { start: LocalDateParts; end: LocalDateParts } {
  const today = getLocalDateParts(now, timeZone);
  if (range === 'today') return { start: today, end: today };
  if (range === 'tomorrow') {
    const tomorrow = addLocalDays(today, 1);
    return { start: tomorrow, end: tomorrow };
  }
  if (range === 'next7') return { start: today, end: addLocalDays(today, 6) };
  if (range === 'thisMonth') {
    const nextMonth = new Date(Date.UTC(today.year, today.month, 1));
    const end = new Date(nextMonth.getTime() - 86_400_000);
    return {
      start: { year: today.year, month: today.month, day: 1 },
      end: { year: end.getUTCFullYear(), month: end.getUTCMonth() + 1, day: end.getUTCDate() },
    };
  }
  if (range === 'custom') {
    const start = parseDateKey(customStart);
    const end = parseDateKey(customEnd);
    if (!start || !end) throw new RangeError('Custom birthday range requires valid start and end dates');
    return { start, end };
  }
  return { start: today, end: today };
}

export function getBirthdayObservedDate(dateOfBirth: string, year: number): LocalDateParts {
  const result = getBirthdayInYear(dateOfBirth, year);
  if (!result) throw new RangeError('Invalid date of birth');
  return result;
}

export function parseDateKey(value: string | undefined): LocalDateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
