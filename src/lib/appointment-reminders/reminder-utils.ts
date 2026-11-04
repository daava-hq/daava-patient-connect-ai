import type {
  MessagingAdapter,
  SendMessageOptions,
  SendMessageResult,
} from '@/lib/messaging/adapter';

export const REMINDER_INTERVAL_OPTIONS = [
  { value: '7_days', label: '7 days before', offsetMinutes: 7 * 24 * 60 },
  { value: '3_days', label: '3 days before', offsetMinutes: 3 * 24 * 60 },
  { value: '24_hours', label: '24 hours before', offsetMinutes: 24 * 60 },
  { value: 'same_day', label: 'Same day', offsetMinutes: 0 },
] as const;

export type ReminderIntervalValue = (typeof REMINDER_INTERVAL_OPTIONS)[number]['value'];

const partsFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

function getDateParts(date: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
  };
}

function localDateTimeToInstant(
  dateParts: { year: number; month: number; day: number },
  time: string,
  timeZone: string
): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError('Reminder send time must use HH:mm format');

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const target = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = target + hours * 60 * 60_000;
    const local = getDateParts(new Date(probe), timeZone);
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - probe);
  }

  const candidates = Array.from(offsets, (offset) => {
    const instant = target - offset;
    const local = getDateParts(new Date(instant), timeZone);
    const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    return { instant, localAsUtc };
  });
  const exactCandidates = candidates
    .filter((candidate) => candidate.localAsUtc === target)
    .sort((left, right) => left.instant - right.instant);
  if (exactCandidates[0]) return new Date(exactCandidates[0].instant);

  const gapAdjustedCandidate = candidates
    .filter((candidate) => candidate.localAsUtc > target)
    .sort((left, right) => left.localAsUtc - right.localAsUtc)[0];
  if (gapAdjustedCandidate) return new Date(gapAdjustedCandidate.instant);

  throw new RangeError(`Could not resolve local reminder time in timezone ${timeZone}`);
}

export function calculateReminderTime(
  appointmentAt: Date,
  interval: ReminderIntervalValue,
  timeZone: string,
  localSendTime: string,
  now = new Date()
): Date {
  if (!Number.isFinite(appointmentAt.getTime())) throw new RangeError('Invalid appointment date');

  const localDate = getDateParts(appointmentAt, timeZone);
  if (interval === 'same_day') {
    const currentLocalDate = getDateParts(now, timeZone);
    if (
      localDate.year === currentLocalDate.year &&
      localDate.month === currentLocalDate.month &&
      localDate.day === currentLocalDate.day
    ) {
      return now;
    }
    return localDateTimeToInstant(localDate, localSendTime, timeZone);
  }
  if (interval === '24_hours') return new Date(appointmentAt.getTime() - 24 * 60 * 60_000);

  const daysBefore = interval === '7_days' ? 7 : interval === '3_days' ? 3 : undefined;
  if (daysBefore === undefined) throw new RangeError('Unsupported appointment reminder interval');
  const priorLocalDate = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day - daysBefore));
  const priorDate = {
    year: priorLocalDate.getUTCFullYear(),
    month: priorLocalDate.getUTCMonth() + 1,
    day: priorLocalDate.getUTCDate(),
  };
  return localDateTimeToInstant(priorDate, `${String(localDate.hour).padStart(2, '0')}:${String(localDate.minute).padStart(2, '0')}`, timeZone);
}

export function isEligibleAppointment(status: string, patientStatus: string): boolean {
  return status === 'Scheduled' && patientStatus === 'Patient';
}

export function getReminderSuppressionReason(input: {
  appointmentStatus: string;
  patientStatus: string;
  hasConsent: boolean;
  hasDestination: boolean;
}): string | null {
  if (!isEligibleAppointment(input.appointmentStatus, input.patientStatus)) {
    return 'Appointment or patient is no longer eligible';
  }
  if (!input.hasConsent) return 'Patient has opted out of this channel';
  if (!input.hasDestination) return 'Patient has no contact for this channel';
  return null;
}

export function isProviderSendAccepted(result: {
  success: boolean;
  providerMessageId?: string;
}): result is { success: true; providerMessageId: string } {
  return result.success && Boolean(result.providerMessageId);
}

export type ReminderProviderSendOutcome =
  | { accepted: true; providerMessageId: string }
  | { accepted: false; failureReason: string };

export async function sendReminderWithAdapter(
  adapter: Pick<MessagingAdapter, 'send'>,
  options: SendMessageOptions
): Promise<ReminderProviderSendOutcome> {
  let result: SendMessageResult;
  try {
    result = await adapter.send(options);
  } catch {
    return { accepted: false, failureReason: 'Messaging provider request failed' };
  }
  if (!isProviderSendAccepted(result)) {
    return { accepted: false, failureReason: 'Messaging provider did not accept the reminder' };
  }
  return { accepted: true, providerMessageId: result.providerMessageId };
}

export function isRenderedAppointmentTemplateValid(
  rendered: { subject: string; body: string; unresolved: string[] },
  channel: 'sms' | 'email'
): boolean {
  return rendered.unresolved.length === 0 &&
    rendered.body.trim().length > 0 &&
    (channel !== 'email' || rendered.subject.trim().length > 0);
}

export interface AppointmentTemplateContext {
  patient: {
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
    birthDate: string;
  };
  practice: {
    name: string;
    phone: string;
    address: string;
  };
  appointment: {
    date: string;
    time: string;
    provider: string;
    status: string;
  };
}

export function buildAppointmentTemplateContext(input: {
  patient: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    birthDate: string | null;
  };
  practice: { name: string; phone: string | null; address: string | null };
  appointment: { scheduledAt: Date; providerName: string | null; status: string };
  timeZone: string;
}): AppointmentTemplateContext {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: input.timeZone,
    dateStyle: 'long',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: input.timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });

  return {
    patient: {
      firstName: input.patient.firstName,
      lastName: input.patient.lastName,
      fullName: `${input.patient.firstName} ${input.patient.lastName}`.trim(),
      email: input.patient.email ?? '',
      phone: input.patient.phone ?? '',
      birthDate: input.patient.birthDate ?? '',
    },
    practice: {
      name: input.practice.name,
      phone: input.practice.phone ?? '',
      address: input.practice.address ?? '',
    },
    appointment: {
      date: dateFormatter.format(input.appointment.scheduledAt),
      time: timeFormatter.format(input.appointment.scheduledAt),
      provider: input.appointment.providerName ?? '',
      status: input.appointment.status,
    },
  };
}

export function renderAppointmentTemplateContent(
  content: Record<string, unknown>,
  context: AppointmentTemplateContext
): { subject: string; body: string; unresolved: string[] } {
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(context.patient)) variables[`patient.${key}`] = value;
  for (const [key, value] of Object.entries(context.practice)) variables[`practice.${key}`] = value;
  for (const [key, value] of Object.entries(context.appointment)) variables[`appointment.${key}`] = value;

  const unresolved = new Set<string>();
  const interpolate = (value: string): string =>
    value.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (placeholder, key: string) => {
      const replacement = variables[key];
      if (replacement === undefined || replacement.trim() === '') {
        unresolved.add(key);
        return placeholder;
      }
      return replacement;
    });

  visitTemplateValues(content, interpolate);
  const subject = typeof content.subject === 'string' ? interpolate(content.subject) : '';
  const body = typeof content.body === 'string' ? interpolate(content.body) : extractTemplateText(content, interpolate);
  return { subject, body, unresolved: Array.from(unresolved) };
}

function visitTemplateValues(value: unknown, interpolate: (text: string) => string): void {
  if (typeof value === 'string') {
    interpolate(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => visitTemplateValues(item, interpolate));
    return;
  }
  if (isRecord(value)) {
    Object.values(value).forEach((item) => visitTemplateValues(item, interpolate));
  }
}

function extractTemplateText(
  content: Record<string, unknown>,
  interpolate: (value: string) => string
): string {
  const lines: string[] = [];
  const sections = Array.isArray(content.sections) ? content.sections : [];

  for (const section of sections) {
    if (!isRecord(section) || !Array.isArray(section.blocks)) continue;
    for (const block of section.blocks) {
      if (!isRecord(block)) continue;
      const properties = isRecord(block.properties) ? block.properties : block;
      if (typeof properties.text === 'string') lines.push(interpolate(properties.text));
    }
  }

  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (typeof block.text === 'string') lines.push(interpolate(block.text));
    if (typeof block.url === 'string') interpolate(block.url);
  }

  return lines.join('\n\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
