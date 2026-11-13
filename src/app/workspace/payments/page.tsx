'use client';

import { useCallback, useEffect, useState } from 'react';
import { DollarSign, Send } from 'lucide-react';
import DataTable from '@/components/ui/DataTable/DataTable';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import styles from './PaymentsPage.module.css';

interface PaymentBalance {
  id: string;
  patientName: string;
  email: string | null;
  phoneMobile: string | null;
  balance: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function PaymentsPage() {
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [balances, setBalances] = useState<PaymentBalance[]>([]);
  const [balancesPracticeId, setBalancesPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  const fetchBalances = useCallback(async (selectedPracticeId: string, signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await fetch(
        `/api/payments/balances?practiceId=${encodeURIComponent(selectedPracticeId)}`,
        { signal },
      );
      const body = await response.json() as ApiResponse<PaymentBalance[]>;
      if (!response.ok) throw new Error(body.error || 'Failed to load balances');
      if (!Array.isArray(body.data)) throw new Error('Balance data is unavailable.');
      setBalances(body.data);
      setBalancesPracticeId(selectedPracticeId);
    } catch (error) {
      if (signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Failed to load balances');
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
      setBalances([]);
      setBalancesPracticeId('');
      setLoadError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void fetchBalances(practiceId, controller.signal);
    return () => controller.abort();
  }, [fetchBalances, practiceId, reloadVersion]);

  const columns = [
    { header: 'Patient Name', accessorKey: (balance: PaymentBalance) => <strong>{balance.patientName}</strong> },
    { header: 'Email', accessorKey: (balance: PaymentBalance) => balance.email || '—' },
    { header: 'Mobile', accessorKey: (balance: PaymentBalance) => balance.phoneMobile || '—' },
    {
      header: 'Balance',
      accessorKey: (balance: PaymentBalance) => (
        <strong className={styles.balanceAmount}>{currencyFormatter.format(Number(balance.balance))}</strong>
      ),
    },
    {
      header: 'Actions',
      accessorKey: (balance: PaymentBalance) => (
        <button
          type="button"
          className={styles.unavailableAction}
          disabled
          aria-disabled="true"
          aria-label={`Send payment link to ${balance.patientName}`}
          aria-describedby="paymentLinkAvailability"
          title="Payment link delivery is not configured"
        >
          <Send size={14} aria-hidden="true" />
          Send Link
        </button>
      ),
    },
  ];
  const isLoadingPractice = practiceId === null
    || loading
    || (!!practiceId && balancesPracticeId !== practiceId && !loadError);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Payment Reminders & Requests"
        description="Review outstanding patient balances and payment request availability."
      />

      {isLoadingPractice ? (
        <LoadingState text="Loading outstanding balances..." />
      ) : !practiceId ? (
        <EmptyState
          icon={<DollarSign size={32} aria-hidden="true" />}
          title="Select a practice"
          description="Choose a practice in the workspace before viewing patient balances."
        />
      ) : loadError ? (
        <ErrorState
          title="Balances could not be loaded"
          message={loadError}
          onRetry={() => setReloadVersion((version) => version + 1)}
        />
      ) : balances.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={32} aria-hidden="true" />}
          title="No outstanding balances"
          description="No patient balances are currently outstanding or synced for this practice."
        />
      ) : (
        <>
          <p className={styles.availabilityNotice} id="paymentLinkAvailability" role="status">
            Payment link delivery is not configured. Balances are read-only; payment requests cannot be sent yet.
          </p>
          <DataTable
            columns={columns}
            data={balances}
            keyExtractor={(balance) => balance.id}
          />
        </>
      )}
    </main>
  );
}
