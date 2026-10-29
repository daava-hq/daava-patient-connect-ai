'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import DataTable from '@/components/ui/DataTable/DataTable';
import FilterBar from '@/components/ui/FilterBar/FilterBar';
import SearchInput from '@/components/ui/SearchInput/SearchInput';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Pagination from '@/components/ui/Pagination/Pagination';
import { RefreshCw, Database, Key } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard/SectionCard';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import Link from 'next/link';

interface OpenDentalPatientRow {
  PatNum: number;
  FName: string;
  LName: string;
  WirelessPhone?: string;
  HmPhone?: string;
  Email?: string;
  PatStatus?: string;
}

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const [patients, setPatients] = useState<OpenDentalPatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState<number | null>(null);

  const fetchedRef = useRef(false);

  const fetchOpenDentalPatients = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const practiceId = typeof window !== 'undefined' ? localStorage.getItem('selectedClinicId') || '' : '';
      const offset = (page - 1) * PAGE_SIZE;
      const query = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (practiceId) query.set('practiceId', practiceId);

      const res = await fetch(`/api/opendental/patients?${query.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch patients from Open Dental API');
      }
      const fetched = json.data || [];
      setPatients(fetched);
      if (json.total !== undefined) {
        setTotal(json.total);
      }
      if (fetched.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not reach Open Dental API.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on page load (guarded against double call in React strict mode)
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchOpenDentalPatients(1);
    }
  }, [fetchOpenDentalPatients]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchOpenDentalPatients(newPage);
  };

  const handleSyncToDatabase = async () => {
    setSyncing(true);
    setError('');
    try {
      let practiceId = typeof window !== 'undefined' ? localStorage.getItem('selectedClinicId') || '' : '';
      if (!practiceId) {
        const resList = await fetch('/api/practices');
        if (resList.ok) {
          const jsonList = await resList.json();
          if (jsonList.data && jsonList.data.length > 0) {
            practiceId = jsonList.data[0].id;
            localStorage.setItem('selectedClinicId', practiceId);
          }
        }
      }
      if (!practiceId) {
        throw new Error('No practice selected. Please choose a practice.');
      }

      const res = await fetch(`/api/practices/${practiceId}/sync`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Sync failed');
      }
      setSuccessMsg(`Successfully synchronized ${json.data.count} patients to database!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchOpenDentalPatients(currentPage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.FName?.toLowerCase().includes(q) ||
      p.LName?.toLowerCase().includes(q) ||
      p.Email?.toLowerCase().includes(q) ||
      p.WirelessPhone?.includes(q)
    );
  });

  const totalPages =
    total !== null && total > 0
      ? Math.max(1, Math.ceil(total / PAGE_SIZE))
      : hasMore
      ? currentPage + 1
      : currentPage;

  const columns = [
    {
      header: 'OD PatNum',
      accessorKey: (row: OpenDentalPatientRow) => `#${row.PatNum}`,
    },
    {
      header: 'Name',
      accessorKey: (row: OpenDentalPatientRow) => `${row.FName} ${row.LName}`,
    },
    {
      header: 'Mobile Phone',
      accessorKey: (row: OpenDentalPatientRow) => row.WirelessPhone || row.HmPhone || '—',
    },
    {
      header: 'Email',
      accessorKey: (row: OpenDentalPatientRow) => row.Email || '—',
    },
    {
      header: 'Status',
      accessorKey: (row: OpenDentalPatientRow) => (
        <StatusBadge status={row.PatStatus === 'Patient' ? 'success' : 'default'}>
          {row.PatStatus || 'Patient'}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Patients Directory"
        description="Patients retrieved live from Open Dental API (/patients/Simple?Offset=N) with server-side offset pagination."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Patients' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleSyncToDatabase}
              disabled={syncing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-surface)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem 1rem',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: 'pointer',
              }}
            >
              <Database size={16} />
              <span>{syncing ? 'Syncing...' : 'Sync to Database'}</span>
            </button>
            <button
              onClick={() => fetchOpenDentalPatients(currentPage)}
              disabled={loading}
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
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Refreshing...' : 'Refresh API'}</span>
            </button>
          </div>
        }
      />

      {successMsg && (
        <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgb(22 163 74 / 0.1)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
          {successMsg}
        </div>
      )}

      {(() => {
        const isKeysMissing = Boolean(
          error && (error.toLowerCase().includes('keys') || error.toLowerCase().includes('credentials') || error.toLowerCase().includes('not configured'))
        );

        if (isKeysMissing) {
          return (
            <SectionCard title="Open Dental Integration">
              <EmptyState
                icon={<Key size={32} />}
                title="Integration Keys Not Configured"
                description="Open Dental integration keys have not been added for this practice. Please configure your developer and customer keys in Practice Settings to view and sync patients."
                action={
                  <Link
                    href="/workspace/settings"
                    style={{
                      display: 'inline-block',
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-surface)',
                      padding: '0.5rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      textDecoration: 'none',
                    }}
                  >
                    Go to Practice Settings
                  </Link>
                }
              />
            </SectionCard>
          );
        }

        return (
          <>
            {error && (
              <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgb(220 38 38 / 0.1)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span>{error}</span>
              </div>
            )}

            {patients.length > 0 && !error && (
              <FilterBar>
                <div style={{ width: '100%', maxWidth: '24rem' }}>
                  <SearchInput
                    value={search}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                    placeholder="Search patients by name, email, phone..."
                  />
                </div>
              </FilterBar>
            )}

            <DataTable
              columns={columns}
              data={filteredPatients}
              keyExtractor={(row: OpenDentalPatientRow) => row.PatNum}
              emptyMessage={loading ? 'Fetching patients from Open Dental API...' : 'No patients found.'}
            />

            {patients.length > 0 && !error && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}
