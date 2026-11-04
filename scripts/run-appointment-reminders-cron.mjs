import { assertSampleDataEnvironment } from './sample-data-environment.mjs';

assertSampleDataEnvironment(process.env.APP_ENVIRONMENT);

if (!process.env.APPOINTMENT_REMINDERS_CRON_SECRET) {
  throw new Error('APPOINTMENT_REMINDERS_CRON_SECRET must be set to run the local reminder cron.');
}

const appUrl = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000');
if (!['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
  throw new Error('The local reminder cron only calls an app running on this machine.');
}

const cronUrl = new URL('/api/cron/appointment-reminders?sampleData=true', appUrl);
const intervalMs = 2 * 60 * 1000;
let tick = 0;

async function runCronTick() {
  tick += 1;
  const response = await fetch(cronUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.APPOINTMENT_REMINDERS_CRON_SECRET}` },
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Reminder cron returned HTTP ${response.status}: ${result.error || 'Unknown error'}`);
  }

  console.info(
    `Sample reminder cron tick ${tick}: ${result.data.practicesProcessed} practice(s); ` +
      `${result.data.reminders.sent} reminder(s) accepted, ${result.data.reminders.failed} failed, ` +
      `${result.data.reminders.skipped} skipped.`
  );
}

async function main() {
  console.info(`Running sample-only appointment reminder cron every 2 minutes at ${cronUrl.origin}. Press Ctrl+C to stop.`);
  while (true) {
    const startedAt = Date.now();
    await runCronTick();
    const delayMs = Math.max(0, intervalMs - (Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

main().catch((error) => {
  console.error('Local appointment reminder cron stopped:', error);
  process.exitCode = 1;
});
