'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';

interface Clinic {
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
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClinics() {
      try {
        const res = await fetch('/api/practices');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setClinics(json.data);
          }
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadClinics();
  }, []);

  const handleSelectClinic = (clinicId: string) => {
    localStorage.setItem('selectedClinicId', clinicId);
    window.dispatchEvent(new Event('practiceChanged'));
    router.push('/workspace/dashboard');
  };

  const renderRoleBadge = (role?: string) => {
    const r = role?.toLowerCase() || 'member';
    if (r === 'owner') return <span style={{ backgroundColor: 'rgb(37 99 235 / 0.1)', color: 'var(--color-primary)', border: '1px solid rgb(37 99 235 / 0.25)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>Owner</span>;
    if (r === 'admin' || r === 'org-admin' || r === 'system-admin') return <span style={{ backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)' }}>{r === 'system-admin' ? 'System Admin' : r === 'org-admin' ? 'Org Admin' : 'Admin'}</span>;
    return <span style={{ backgroundColor: '#f1f5f9', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' }}>Member</span>;
  };

  return (
    <div style={{ maxWidth: '44rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Select Practice Location"
        description="Choose a dental practice clinic to manage appointments, patients, and engagement."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Choose Practice' }]}
        actions={
          <Link
            href="/workspace/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              textDecoration: 'none',
              transition: 'background-color var(--transition-fast)',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
        }
      />

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          Loading practices...
        </div>
      ) : clinics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
          No practice locations assigned to your account.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              onClick={() => handleSelectClinic(clinic.id)}
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all var(--transition-fast)',
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelectClinic(clinic.id);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgb(37 99 235 / 0.1)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={24} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: 0 }}>
                      {clinic.name}
                    </h3>
                    {renderRoleBadge(clinic.role)}
                  </div>
                  {clinic.organisationName && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', margin: 0 }}>
                      Organisation: {clinic.organisationName}
                    </p>
                  )}
                  {clinic.address && (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
                      {clinic.address}
                    </p>
                  )}
                  {clinic.phone && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                      Phone: {clinic.phone}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  color: 'var(--color-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize: 'var(--font-size-sm)',
                  flexShrink: 0,
                }}
              >
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
