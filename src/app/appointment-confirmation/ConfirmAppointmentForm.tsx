'use client';

import { useState } from 'react';
import styles from './confirmation.module.css';

interface ConfirmAppointmentFormProps {
  token: string;
  alreadyConfirmed: boolean;
}

export default function ConfirmAppointmentForm({
  token,
  alreadyConfirmed,
}: ConfirmAppointmentFormProps) {
  const [confirmed, setConfirmed] = useState(alreadyConfirmed);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirmAppointment() {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/appointment-reminders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json() as { data?: { confirmed: boolean }; error?: string };
      if (!response.ok || !result.data?.confirmed) {
        setError(result.error || 'Unable to confirm this appointment. Please contact the practice.');
        return;
      }
      setConfirmed(true);
    } catch {
      setError('Unable to confirm this appointment. Please try again or contact the practice.');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return <p className={styles.success} role="status">Your appointment is confirmed.</p>;
  }

  return (
    <div className={styles.actions}>
      <button
        className={styles.confirmButton}
        type="button"
        onClick={confirmAppointment}
        disabled={submitting}
      >
        {submitting ? 'Confirming...' : 'Confirm appointment'}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
