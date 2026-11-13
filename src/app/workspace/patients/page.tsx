'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import DataTable from '@/components/ui/DataTable/DataTable';
import FilterBar from '@/components/ui/FilterBar/FilterBar';
import SearchInput from '@/components/ui/SearchInput/SearchInput';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import Pagination from '@/components/ui/Pagination/Pagination';
import { Key, Mail, Phone } from 'lucide-react';
import SectionCard from '@/components/ui/SectionCard/SectionCard';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import Link from 'next/link';
import { formatDob } from '@/lib/patients/patient-utils';
import type { OpenDentalPatient, OpenDentalPatientDetails } from '@/lib/opendental/types';
import styles from './PatientsPage.module.css';

type PatientDirectoryRow = OpenDentalPatient &
  Pick<OpenDentalPatientDetails, 'emailConsent' | 'smsConsent'>;

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientDirectoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const filteredPatients = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${p.FName || ''} ${p.LName || ''}`.toLowerCase();
    const reverseName = `${p.LName || ''}, ${p.FName || ''}`.toLowerCase();
    const formattedDob = formatDob(p.Birthdate).toLowerCase();
    return (
      p.FName?.toLowerCase().includes(q) ||
      p.LName?.toLowerCase().includes(q) ||
      fullName.includes(q) ||
      reverseName.includes(q) ||
      p.Email?.toLowerCase().includes(q) ||
      p.WirelessPhone?.includes(q) ||
      p.HmPhone?.includes(q) ||
      p.Birthdate?.includes(q) ||
      formattedDob.includes(q) ||
      String(p.PatNum).includes(q)
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
      accessorKey: (row: PatientDirectoryRow) => `#${row.PatNum}`,
    },
    {
      header: 'Last Name',
      accessorKey: (row: PatientDirectoryRow) => row.LName || '—',
    },
    {
      header: 'First Name',
      accessorKey: (row: PatientDirectoryRow) => row.FName || '—',
    },
    {
      header: 'DOB',
      accessorKey: (row: PatientDirectoryRow) => formatDob(row.Birthdate),
    },
    {
      header: 'Mobile Phone',
      accessorKey: (row: PatientDirectoryRow) => row.WirelessPhone || row.HmPhone || '—',
    },
    {
      header: 'Email',
      accessorKey: (row: PatientDirectoryRow) => row.Email || '—',
    },
    {
      header: 'Consent Status',
      accessorKey: (row: PatientDirectoryRow) => (
        <span className={styles.consentIndicators}>
          {row.Email?.trim() && typeof row.emailConsent === 'boolean' && (
            <span
              role="img"
              aria-label={`Email consent: ${row.emailConsent ? 'yes' : 'no'}`}
              title={`Email consent: ${row.emailConsent ? 'yes' : 'no'}`}
            >
              <Mail
                size={16}
                aria-hidden="true"
                className={row.emailConsent ? styles.consentYes : styles.consentNo}
              />
            </span>
          )}
          {row.WirelessPhone?.trim() && typeof row.smsConsent === 'boolean' && (
            <span
              role="img"
              aria-label={`Phone consent: ${row.smsConsent ? 'yes' : 'no'}`}
              title={`Phone consent: ${row.smsConsent ? 'yes' : 'no'}`}
            >
              <Phone
                size={16}
                aria-hidden="true"
                className={row.smsConsent ? styles.consentYes : styles.consentNo}
              />
            </span>
          )}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: (row: PatientDirectoryRow) => (
        <StatusBadge status={row.PatStatus === 'Patient' ? 'success' : 'default'}>
          {row.PatStatus || 'Patient'}
        </StatusBadge>
      ),
    },
  ];

  const isKeysMissing = Boolean(
    error &&
      ['keys', 'credentials', 'not configured'].some((term) =>
        error.toLowerCase().includes(term)
      )
  );

  return (
    <div>
      <PageHeader
        title="Patients Directory"
        description="Patients retrieved live from Open Dental API (/patients/Simple?Offset=N) with server-side offset pagination."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Patients' }]}
      />

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          {isKeysMissing && (
            <div>
              <Link href="/workspace/settings" className={styles.settingsLink}>
                Go to Practice Settings → Open Dental Integration
              </Link>
            </div>
          )}
        </div>
      )}

      {isKeysMissing ? (
        <SectionCard title="Open Dental Integration">
          <EmptyState
            icon={<Key size={32} />}
            title="Integration Keys Not Configured"
            description="Open Dental integration keys have not been added for this practice. Please configure your developer and customer keys in Practice Settings to view and sync patients."
            action={
              <Link href="/workspace/settings" className={styles.integrationLink}>
                Go to Practice Settings
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          {patients.length > 0 && !error && (
            <FilterBar>
              <div className={styles.searchControl}>
                <SearchInput
                  value={search}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search patients by name, DOB, email, phone..."
                />
              </div>
            </FilterBar>
          )}

          <DataTable
            columns={columns}
            data={filteredPatients}
            keyExtractor={(row: PatientDirectoryRow) => row.PatNum}
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
      )}
    </div>
  );
}
