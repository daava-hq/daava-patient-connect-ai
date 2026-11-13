'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import styles from './ChoosePracticePage.module.css';

interface PracticeOption {
  id: string;
  name: string;
  slug?: string;
  address?: string | null;
  phone?: string | null;
  organisationName?: string;
  role?: string;
}

export default function ChooseClinicPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<PracticeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    async function loadClinics() {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch('/api/practices');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Unable to load practice locations.');
        setClinics(json.data ?? []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unable to load practice locations.');
      } finally {
        setLoading(false);
      }
    }
    void loadClinics();
  }, [attempt, router]);

  const handleSelectClinic = (clinicId: string) => {
    localStorage.setItem('selectedClinicId', clinicId);
    window.dispatchEvent(new Event('practiceChanged'));
    router.push('/workspace/dashboard');
  };

  const renderRoleBadge = (role?: string) => {
    const r = role?.toLowerCase() || 'member';
    if (r === 'owner') return <StatusBadge status="info">Owner</StatusBadge>;
    if (r === 'admin' || r === 'org-admin' || r === 'system-admin') {
      const label = r === 'system-admin' ? 'System Admin' : r === 'org-admin' ? 'Org Admin' : 'Admin';
      return <StatusBadge status="info">{label}</StatusBadge>;
    }
    return <StatusBadge status="default">Member</StatusBadge>;
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="Select Practice Location"
        description="Choose a dental practice clinic to manage appointments, patients, and engagement."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Choose Practice' }]}
        actions={
          <Link
            href="/workspace/dashboard"
            className={styles.backLink}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
        }
      />

      {loading ? (
        <LoadingState text="Loading practice locations..." />
      ) : loadError ? (
        <ErrorState
          title="Unable to load practices"
          message={loadError}
          onRetry={() => setAttempt((current) => current + 1)}
        />
      ) : clinics.length === 0 ? (
        <EmptyState
          title="No practice locations assigned"
          description="Contact your organisation administrator if you need access to a practice."
          icon={<Building2 size={32} />}
        />
      ) : (
        <div className={styles.practiceList}>
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              onClick={() => handleSelectClinic(clinic.id)}
              className={styles.practiceCard}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectClinic(clinic.id);
                }
              }}
            >
              <div className={styles.practiceCardContent}>
                <div className={styles.practiceIcon}>
                  <Building2 size={24} />
                </div>
                <div className={styles.practiceDetails}>
                  <div className={styles.practiceTitleRow}>
                    <h3 className={styles.practiceName}>
                      {clinic.name}
                    </h3>
                    <div className={styles.practiceBadges}>
                      {renderRoleBadge(clinic.role)}
                      {clinic.slug === 'appointment-reminder-sample' && (
                        <StatusBadge status="warning">
                          Test Practice
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                  {clinic.organisationName && (
                    <p className={styles.organisationName}>
                      Organisation: {clinic.organisationName}
                    </p>
                  )}
                  {clinic.address && (
                    <p className={styles.practiceAddress}>
                      {clinic.address}
                    </p>
                  )}
                  {clinic.phone && (
                    <p className={styles.practicePhone}>
                      Phone: {clinic.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.launchAction}>
                <span>Launch</span>
                <ArrowRight size={18} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
