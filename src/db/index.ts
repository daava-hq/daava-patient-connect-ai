import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as organisations from './schema/organisations';
import * as practices from './schema/practices';
import * as users from './schema/users';
import * as practiceMembers from './schema/practice_members';
import * as practiceCredentials from './schema/practice_credentials';
import * as patients from './schema/patients';
import * as appointments from './schema/appointments';
import * as groups from './schema/groups';
import * as messageTemplates from './schema/message_templates';
import * as campaigns from './schema/campaigns';
import * as campaignRecipients from './schema/campaign_recipients';
import * as campaignJobRuns from './schema/campaign_job_runs';
import * as surveys from './schema/surveys';
import * as referrals from './schema/referrals';
import * as payments from './schema/payments';
import * as templates from './schema/templates';
import * as appointmentReminders from './schema/appointment_reminders';

const client = postgres(env.DATABASE_URL, {
  user: process.env.USER || 'premkumark',
  database: 'patient_connect2',
});

export const db = drizzle(client, {
  schema: {
    ...organisations,
    ...practices,
    ...users,
    ...practiceMembers,
    ...practiceCredentials,
    ...patients,
    ...appointments,
    ...groups,
    ...messageTemplates,
    ...campaigns,
    ...campaignRecipients,
    ...campaignJobRuns,
    ...surveys,
    ...referrals,
    ...payments,
    ...templates,
    ...appointmentReminders,
  },
});
