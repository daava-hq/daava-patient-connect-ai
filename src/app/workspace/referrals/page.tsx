'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users2 } from 'lucide-react';
import DataTable from '@/components/ui/DataTable/DataTable';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import styles from './ReferralsPage.module.css';

interface ReferralRecord {
  id: string;
  patientId: string;
  patientName: string;
  referredTo: string;
  referrerName: string | null;
  status: string;
  createdAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

function getStatusVariant(status: string): StatusVariant {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'consulted':
      return 'info';
    case 'pending':
      return 'warning';
    case 'declined':
      return 'error';
    default:
      return 'default';
  }
}

export default function ReferralsPage() {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [referralsPracticeId, setReferralsPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  const fetchReferrals = useCallback(async (selectedPracticeId: string, signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    try {
      const searchParams = new URLSearchParams({ practiceId: selectedPracticeId });
      const response = await fetch(`/api/referrals?${searchParams.toString()}`, { signal });
      const body = await response.json() as ApiResponse<ReferralRecord[]>;
      if (!response.ok) throw new Error(body.error || 'Failed to load referrals');
      if (!Array.isArray(body.data)) throw new Error('Referral data is unavailable.');
      if (signal.aborted) return;
      setReferrals(body.data);
      setReferralsPracticeId(selectedPracticeId);
    } catch (error) {
      if (signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Failed to load referrals');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncPractice = () => setPracticeId(localStorage.getItem('selectedClinicId') || '');
    syncPractice();
    window.addEventListener('practiceChanged', syncPractice);
    window.addEventListener('storage', syncPractice);
    return () => {
      window.removeEventListener('practiceChanged', syncPractice);
      window.removeEventListener('storage', syncPractice);
    };
  }, []);

  useEffect(() => {
    if (practiceId === null) return;
    if (!practiceId) {
      setReferrals([]);
      setReferralsPracticeId('');
      setLoadError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void fetchReferrals(practiceId, controller.signal);
    return () => controller.abort();
  }, [fetchReferrals, practiceId, reloadVersion]);

  const columns = [
    {
      header: 'Patient Name',
      accessorKey: (referral: ReferralRecord) => <strong className={styles.patientName}>{referral.patientName}</strong>,
    },
    { header: 'Referred To', accessorKey: (referral: ReferralRecord) => referral.referredTo },
    { header: 'Referrer', accessorKey: (referral: ReferralRecord) => referral.referrerName || '—' },
    {
      header: 'Status',
      accessorKey: (referral: ReferralRecord) => (
        <StatusBadge status={getStatusVariant(referral.status)}>{referral.status}</StatusBadge>
      ),
    },
    {
      header: 'Date',
      accessorKey: (referral: ReferralRecord) => new Date(referral.createdAt).toLocaleDateString(),
    },
  ];
  const isLoadingPractice = practiceId === null
    || loading
    || (!!practiceId && referralsPracticeId !== practiceId && !loadError);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Patient Referrals"
        description="Track inbound and outbound specialist and patient referrals."
      />

      {isLoadingPractice ? (
        <LoadingState text="Loading referrals..." />
      ) : !practiceId ? (
        <EmptyState
          icon={<Users2 size={32} aria-hidden="true" />}
          title="Select a practice"
          description="Choose a practice in the workspace before viewing referrals."
        />
      ) : loadError ? (
        <ErrorState
          title="Referrals could not be loaded"
          message={loadError}
          onRetry={() => setReloadVersion((version) => version + 1)}
        />
      ) : referrals.length === 0 ? (
        <EmptyState
          icon={<Users2 size={32} aria-hidden="true" />}
          title="No referral records yet"
          description="Track your patient referrals and specialist networks here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={referrals}
          keyExtractor={(referral) => referral.id}
        />
      )}
    </main>
  );
}
