'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './SampleDataReset.module.css';

interface ReminderDashboardResponse {
  sampleDataResetAvailable?: boolean;
}

export default function SampleDataReset() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState('');
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const syncSelectedPractice = useCallback(() => {
    const selectedPracticeId =
      localStorage.getItem('selectedClinicId') || '';
    setAvailable(false);
    setCheckError('');
    setPracticeId(selectedPracticeId);
  }, []);

  useEffect(() => {
    syncSelectedPractice();
    window.addEventListener('practiceChanged', syncSelectedPractice);
    window.addEventListener('storage', syncSelectedPractice);
    return () => {
      window.removeEventListener('practiceChanged', syncSelectedPractice);
      window.removeEventListener('storage', syncSelectedPractice);
    };
  }, [syncSelectedPractice]);

  useEffect(() => {
    if (!practiceId) {
      setAvailable(false);
      setCheckError('');
      setChecking(false);
      return;
    }

    let active = true;
    setChecking(true);
    setCheckError('');
    fetch(`/api/appointment-reminders?practiceId=${encodeURIComponent(practiceId)}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || 'Unable to check sample data availability');
        return json.data as ReminderDashboardResponse;
      })
      .then((data) => {
        if (active) setAvailable(data.sampleDataResetAvailable === true);
      })
      .catch((error: unknown) => {
        if (active) {
          setAvailable(false);
          setCheckError(error instanceof Error ? error.message : 'Unable to check sample data availability');
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [practiceId, retryKey]);

  async function resetSampleData() {
    if (!practiceId) return;
    const confirmed = window.confirm(
      'Reset all sample modules for Appointment Reminder Sample Practice? This replaces its patients, appointments, groups, birthdays, newsletters, announcements, and reminder history. Newsletter and announcement records are drafts, and birthday campaigns are disabled. If an appointment reminder schedule and cron are enabled, sample emails may be sent to prem@daava.ai. Other practices are not affected.'
    );
    if (!confirmed) return;

    setResetting(true);
    setResetError('');
    try {
      const response = await fetch('/api/appointment-reminders/sample-data/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to refresh sample data');
      showToast(
        'Sample patients, appointments, groups, birthdays, newsletters, and announcements were refreshed. The reset itself sent no messages.',
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh sample data';
      setResetError(message);
      showToast(message, 'error');
    } finally {
      setResetting(false);
    }
  }

  if (!available && !checkError) return null;

  return (
    <section className={styles.card} aria-labelledby="sample-data-heading">
      {available ? (
        <>
          <div className={styles.content}>
            <h2 id="sample-data-heading">Sample practice data</h2>
            <p>
              Refreshes test patients, appointments, groups, birthdays, newsletters, and group announcements
              for Appointment Reminder Sample Practice. Newsletter and announcement campaigns remain drafts,
              and the birthday campaign is disabled.
            </p>
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={() => void resetSampleData()}
            disabled={resetting}
          >
            <RotateCcw size={16} aria-hidden="true" />
            {resetting ? 'Refreshing…' : 'Refresh / reset sample data'}
          </button>
          {resetError && <p className={styles.error} role="alert">{resetError}</p>}
        </>
      ) : (
        <div className={styles.content} role="alert">
          <h2 id="sample-data-heading">Sample data status</h2>
          <p>{checkError}</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => setRetryKey((current) => current + 1)}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Try again'}
          </button>
        </div>
      )}
    </section>
  );
}
