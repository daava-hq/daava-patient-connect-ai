import type { Metadata } from 'next';
import { AppError } from '@/lib/errors';
import { getAppointmentConfirmationDetails } from '@/lib/appointment-reminders/reminder-service';
import ConfirmAppointmentForm from './ConfirmAppointmentForm';
import styles from './confirmation.module.css';

export const metadata: Metadata = {
  title: 'Confirm your appointment | Patient Connect',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

interface AppointmentConfirmationPageProps {
  searchParams: { token?: string | string[] };
}

export default async function AppointmentConfirmationPage({
  searchParams,
}: AppointmentConfirmationPageProps) {
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  if (!token) return <UnavailableMessage />;

  let details;
  try {
    details = await getAppointmentConfirmationDetails(token);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return <UnavailableMessage message={error.message} />;
  }

  const scheduledAt = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: details.timezone,
  }).format(details.scheduledAt);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Appointment reminder</p>
        <h1>Confirm your appointment</h1>
        <p className={styles.details}>
          Your appointment at <strong>{details.practiceName}</strong> is scheduled for{' '}
          <strong>{scheduledAt}</strong>.
        </p>
        <ConfirmAppointmentForm token={token} alreadyConfirmed={details.alreadyConfirmed} />
      </section>
    </main>
  );
}

function UnavailableMessage({ message = 'This appointment confirmation link is invalid or has expired.' }) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>Appointment confirmation unavailable</h1>
        <p className={styles.details}>{message}</p>
        <p className={styles.help}>Please contact your dental practice if you need help.</p>
      </section>
    </main>
  );
}
