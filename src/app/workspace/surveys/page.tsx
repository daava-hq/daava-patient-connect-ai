'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ClipboardList, Plus, X } from 'lucide-react';
import DataTable from '@/components/ui/DataTable/DataTable';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './SurveysPage.module.css';

interface SurveyRecord {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export default function SurveysPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [surveysPracticeId, setSurveysPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const wasModalOpen = useRef(false);

  const fetchSurveys = useCallback(async (selectedPracticeId: string, signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    try {
      const searchParams = new URLSearchParams({ practiceId: selectedPracticeId });
      const response = await fetch(`/api/surveys?${searchParams.toString()}`, { signal });
      const body = await response.json() as ApiResponse<SurveyRecord[]>;
      if (!response.ok) throw new Error(body.error || 'Failed to load surveys');
      if (!Array.isArray(body.data)) throw new Error('Survey data is unavailable.');
      if (signal.aborted) return;
      setSurveys(body.data);
      setSurveysPracticeId(selectedPracticeId);
    } catch (error) {
      if (signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Failed to load surveys');
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
      setSurveys([]);
      setSurveysPracticeId('');
      setLoadError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void fetchSurveys(practiceId, controller.signal);
    return () => controller.abort();
  }, [fetchSurveys, practiceId, reloadVersion]);

  useEffect(() => {
    if (isModalOpen) {
      wasModalOpen.current = true;
      titleInputRef.current?.focus();
    } else if (wasModalOpen.current) {
      wasModalOpen.current = false;
      createButtonRef.current?.focus();
    }
  }, [isModalOpen]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!practiceId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, title, description }),
      });
      const body = await response.json() as ApiResponse<unknown>;
      if (!response.ok) throw new Error(body.error || 'Failed to create survey');

      showToast('Survey created successfully', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setReloadVersion((version) => version + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create survey', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isSubmitting) {
      event.preventDefault();
      setIsModalOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements?.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const columns = [
    { header: 'Survey Title', accessorKey: (survey: SurveyRecord) => <strong className={styles.surveyTitle}>{survey.title}</strong> },
    { header: 'Description', accessorKey: (survey: SurveyRecord) => survey.description || '—' },
    { header: 'Created', accessorKey: (survey: SurveyRecord) => new Date(survey.createdAt).toLocaleDateString() },
  ];
  const isLoadingPractice = practiceId === null
    || loading
    || (!!practiceId && surveysPracticeId !== practiceId && !loadError);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Post-Visit Surveys"
        description="Create and track post-visit satisfaction survey records."
        actions={
          <button
            ref={createButtonRef}
            type="button"
            className={styles.primaryButton}
            disabled={!practiceId}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />
            New Survey
          </button>
        }
      />

      {isLoadingPractice ? (
        <LoadingState text="Loading surveys..." />
      ) : !practiceId ? (
        <EmptyState
          icon={<ClipboardList size={32} aria-hidden="true" />}
          title="Select a practice"
          description="Choose a practice in the workspace before viewing surveys."
        />
      ) : loadError ? (
        <ErrorState
          title="Surveys could not be loaded"
          message={loadError}
          onRetry={() => setReloadVersion((version) => version + 1)}
        />
      ) : surveys.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={32} aria-hidden="true" />}
          title="No surveys created yet"
          description="Create your first survey record for post-visit feedback."
        />
      ) : (
        <DataTable
          columns={columns}
          data={surveys}
          keyExtractor={(survey) => survey.id}
        />
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-dialog-title"
            onKeyDown={handleDialogKeyDown}
          >
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle} id="survey-dialog-title">Create Patient Survey</h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close create survey dialog"
                disabled={isSubmitting}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.formField}>
                <label htmlFor="surveyTitle">Survey Title</label>
                <input
                  ref={titleInputRef}
                  id="surveyTitle"
                  type="text"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g., Post-Visit Satisfaction Survey"
                />
              </div>
              <div className={styles.formField}>
                <label htmlFor="surveyDescription">Description</label>
                <textarea
                  id="surveyDescription"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Survey'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
