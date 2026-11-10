'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface PracticeListResponse {
  data?: Array<{ id: string }>;
  error?: string;
}

interface PracticeRouteGateProps {
  mode: 'entry' | 'workspace';
  children?: React.ReactNode;
}

type GateState =
  | { pathname: string; status: 'checking' }
  | { pathname: string; status: 'allowed' }
  | { pathname: string; status: 'error'; message: string };

export default function PracticeRouteGate({ mode, children }: PracticeRouteGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GateState>({ pathname, status: 'checking' });
  const isChoosingPractice = mode === 'workspace' && pathname === '/workspace/choose-practice';

  const validateSelectedPractice = useCallback(async () => {
    setState({ pathname, status: 'checking' });
    try {
      const response = await fetch('/api/practices', { cache: 'no-store' });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      const body = await response.json() as PracticeListResponse;
      if (!response.ok) throw new Error(body.error || 'Unable to load your practices.');
      if (!Array.isArray(body.data)) throw new Error('The practice list response is invalid.');

      const selectedPracticeId = localStorage.getItem('selectedClinicId');
      const selectedPracticeIsAvailable = Boolean(
        selectedPracticeId && body.data.some((practice) => practice.id === selectedPracticeId),
      );

      if (!selectedPracticeIsAvailable) {
        if (selectedPracticeId) {
          localStorage.removeItem('selectedClinicId');
          window.dispatchEvent(new Event('practiceChanged'));
        }
        router.replace('/workspace/choose-practice');
        return;
      }

      if (mode === 'entry') {
        router.replace('/workspace/dashboard');
        return;
      }

      setState({ pathname, status: 'allowed' });
    } catch (error) {
      setState({
        pathname,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unable to verify your selected practice.',
      });
    }
  }, [mode, pathname, router]);

  useEffect(() => {
    if (isChoosingPractice) return;
    void validateSelectedPractice();
  }, [attempt, isChoosingPractice, validateSelectedPractice]);

  if (isChoosingPractice) return <>{children}</>;

  if (state.pathname !== pathname || state.status === 'checking') {
    return <main role="status">Checking your practice selection…</main>;
  }

  if (state.status === 'error') {
    return (
      <main role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={() => setAttempt((current) => current + 1)}>Try again</button>
      </main>
    );
  }

  if (mode === 'entry') {
    return <main role="status">Opening your practice workspace…</main>;
  }

  return <>{children}</>;
}
