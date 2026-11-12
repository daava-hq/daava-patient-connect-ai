import { assertSampleDataEnvironment } from './sample-data-environment.mjs';

assertSampleDataEnvironment(process.env.APP_ENVIRONMENT);

if (!process.env.APPOINTMENT_REMINDERS_CRON_SECRET) {
  throw new Error('APPOINTMENT_REMINDERS_CRON_SECRET must be set to run the local sample cron.');
}

const appUrl = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000');
if (!['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
  throw new Error('The local sample cron only calls an app running on this machine.');
}

const cronUrls = [
  new URL('/api/cron/appointment-reminders?sampleData=true', appUrl),
  new URL('/api/cron/birthdays?sampleData=true', appUrl),
  new URL('/api/cron/campaigns?sampleData=true', appUrl),
];
const intervalMs = 2 * 60 * 1000;
let tick = 0;

async function runCronTick() {
  tick += 1;
  const results = [];

  for (const cronUrl of cronUrls) {
    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.APPOINTMENT_REMINDERS_CRON_SECRET}` },
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(`${cronUrl.pathname} returned HTTP ${response.status}: ${result.error || 'Unknown error'}`);
    }
    results.push({ endpoint: cronUrl.pathname, data: result.data });
  }

  console.info(`Sample engagement cron tick ${tick}: ${JSON.stringify(results)}`);
}

async function main() {
  console.info(`Running sample-only engagement cron every 2 minutes at ${appUrl.origin}. Press Ctrl+C to stop.`);
  while (true) {
    const startedAt = Date.now();
    await runCronTick();
    const delayMs = Math.max(0, intervalMs - (Date.now() - startedAt));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

main().catch((error) => {
  console.error('Local sample engagement cron stopped:', error);
  process.exitCode = 1;
});
