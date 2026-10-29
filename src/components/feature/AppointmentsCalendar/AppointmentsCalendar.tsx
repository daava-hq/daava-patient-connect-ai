'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './AppointmentsCalendar.module.css';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  Database,
  X,
  Key,
} from 'lucide-react';
import { CalendarColumn, OpenDentalAppointment } from '@/lib/opendental/types';
import SectionCard from '@/components/ui/SectionCard/SectionCard';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import Link from 'next/link';

// Default columns matching practice operatories for immediate rendering
const DEFAULT_COLUMNS: CalendarColumn[] = [
  {
    id: 'provider-1-operatory-1',
    name: 'Dr. Brian Albert',
    shortName: 'B. Albert',
    providerNum: 1,
    operatoryNum: 1,
    operatoryName: 'Dr. Brian Albert',
    role: 'Doctor',
  },
  {
    id: 'provider-3-operatory-2',
    name: 'Dr. Sarah Lexington',
    shortName: 'S. Lexington',
    providerNum: 3,
    operatoryNum: 2,
    operatoryName: 'Dr. Sarah Lexington',
    role: 'Doctor',
  },
  {
    id: 'operatory-3',
    name: 'Doctor Overflow',
    shortName: 'Doctor Overflow',
    providerNum: 0,
    operatoryNum: 3,
    operatoryName: 'Doctor Overflow',
    role: 'Doctor',
  },
  {
    id: 'provider-2-operatory-5',
    name: 'Tina Jones',
    shortName: 'Tina',
    providerNum: 2,
    operatoryNum: 5,
    operatoryName: 'Tina',
    role: 'Hygienist',
  },
  {
    id: 'provider-4-operatory-6',
    name: 'Bruce Bently',
    shortName: 'Bruce',
    providerNum: 4,
    operatoryNum: 6,
    operatoryName: 'Bruce',
    role: 'Hygienist',
  },
];

const START_HOUR = 6; // 6 AM
const END_HOUR = 20; // 8 PM
const TOTAL_HOURS = END_HOUR - START_HOUR + 1; // 15 hours
const SLOTS_PER_HOUR = 6; // 10 minutes each (:00, :10, :20, :30, :40, :50)
const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR; // 90 slots
const SLOT_HEIGHT = 32; // px per 10-minute slot

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${ampm}`;
}

function formatPopoverDate(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const datePart = dateTimeStr.split(' ')[0] || dateTimeStr.split('T')[0];
  const dateObj = new Date(datePart + 'T00:00:00');
  if (isNaN(dateObj.getTime())) return datePart;
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${weekday}, ${m}/${d}/${y}`;
}

function formatPopoverTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const timePart = dateTimeStr.includes('T') ? dateTimeStr.split('T')[1] : dateTimeStr.split(' ')[1];
  if (!timePart) return '';
  const [hStr, mStr] = timePart.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${(mStr || '00').padStart(2, '0')} ${ampm}`;
}

function calculateAge(birthdate?: string, refDate?: string): number | null {
  if (!birthdate || birthdate.startsWith('0001')) return null;
  const birth = new Date(birthdate + 'T00:00:00');
  const ref = refDate ? new Date(refDate.split(' ')[0] + 'T00:00:00') : new Date();
  if (isNaN(birth.getTime()) || isNaN(ref.getTime())) return null;

  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export default function AppointmentsCalendar() {
  // Load today's date by default
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString);
  const [columns, setColumns] = useState<CalendarColumn[]>(DEFAULT_COLUMNS);
  const [appointments, setAppointments] = useState<OpenDentalAppointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<OpenDentalAppointment | null>(null);
  const [hoveredApptId, setHoveredApptId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchedRef = useRef(false);

  const fetchCalendarData = useCallback(async (dateStr: string, refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const practiceId = typeof window !== 'undefined' ? localStorage.getItem('selectedClinicId') || '' : '';
      const query = new URLSearchParams({
        date: dateStr,
      });
      if (practiceId) query.set('practiceId', practiceId);
      if (refresh) query.set('refresh', 'true');

      const res = await fetch(`/api/opendental/appointments?${query.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch daily schedule from Open Dental API');
      }
      setAppointments(json.data || []);
      if (Array.isArray(json.columns) && json.columns.length > 0) {
        setColumns(json.columns);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not reach Open Dental API.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchCalendarData(selectedDate);
    }
  }, [selectedDate, fetchCalendarData]);

  const handleDateChange = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + days);
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    const nextStr = `${year}-${month}-${day}`;
    setSelectedDate(nextStr);
    fetchCalendarData(nextStr);
  };

  const handleToday = () => {
    const todayStr = getTodayString();
    setSelectedDate(todayStr);
    fetchCalendarData(todayStr);
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

      const res = await fetch(
        `/api/practices/${practiceId}/sync-appointments`,
        {
          method: 'POST',
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Appointment sync failed');
      }
      setSuccessMsg(
        `Successfully synchronized ${json.data.count} appointments to database!`
      );
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchCalendarData(selectedDate, true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  // Helper to parse appointment start time and height
  const getAppointmentPosition = (appt: OpenDentalAppointment) => {
    if (!appt.AptDateTime) return null;
    const timePart = appt.AptDateTime.includes('T')
      ? appt.AptDateTime.split('T')[1]
      : appt.AptDateTime.split(' ')[1];
    if (!timePart) return null;

    const [hourStr, minStr] = timePart.split(':');
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);

    if (isNaN(hour) || isNaN(min)) return null;

    const minutesFromCalendarStart = (hour - START_HOUR) * 60 + min;
    if (minutesFromCalendarStart < 0 || minutesFromCalendarStart >= TOTAL_HOURS * 60) {
      return null;
    }

    const top = (minutesFromCalendarStart / 10) * SLOT_HEIGHT;
    const duration =
      appt.durationMinutes && appt.durationMinutes > 0 ? appt.durationMinutes : 30;
    const height = Math.max((duration / 10) * SLOT_HEIGHT - 2, 28);

    return {
      top,
      height,
      startMinutes: minutesFromCalendarStart,
      duration,
      endMinutes: minutesFromCalendarStart + duration,
    };
  };

  // Pre-generate grid slots for time column and operatory columns
  const slotRows = Array.from({ length: TOTAL_SLOTS }, (_, index) => {
    const isHourSlot = index % SLOTS_PER_HOUR === 0;
    const hourIndex = Math.floor(index / SLOTS_PER_HOUR);
    const minuteInHour = (index % SLOTS_PER_HOUR) * 10;
    const currentHour = START_HOUR + hourIndex;

    return {
      index,
      isHourSlot,
      hourLabel: isHourSlot ? formatHourLabel(currentHour) : `:${minuteInHour.toString().padStart(2, '0')}`,
      timeText: isHourSlot ? formatHourLabel(currentHour) : `:${minuteInHour}`,
    };
  });

  return (
    <div className={styles.container}>
      <PageHeader
        title="Appointment Calendar"
        description={`Operatory Schedule | Date: ${selectedDate}`}
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Appointments' }]}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
              onClick={() => fetchCalendarData(selectedDate, true)}
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
        <div className={`${styles.alertBox} ${styles.alertSuccess}`} role="status">
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
                description="Open Dental integration keys have not been added for this practice. Please configure your developer and customer keys in Practice Settings to view the appointment calendar."
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
              <div className={`${styles.alertBox} ${styles.alertError}`} role="alert">
                <span>{error}</span>
              </div>
            )}

            {/* Appointment Status Legends Bar (Open Dental AptStatus spec) */}
            <div className={styles.legendBar}>
              <span className={styles.legendTitle}>Status Legends:</span>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendScheduledDot}`} />
                  <span>Scheduled</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendCompleteDot}`} />
                  <span>Complete</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendBrokenDot}`} />
                  <span>Broken</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendUnschedDot}`} />
                  <span>UnschedList</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendAsapDot}`} />
                  <span>ASAP</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendPlannedDot}`} />
                  <span>Planned</span>
                </div>
              </div>
            </div>

            {/* Date Navigation Bar */}
            <div className={styles.calendarNav}>
              <div className={styles.dateTitle}>
                <CalendarIcon size={20} className={styles.calendarIcon} />
                <h2>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
              </div>
              <div className={styles.navControls}>
                <button
                  onClick={() => handleDateChange(-1)}
                  className={styles.navBtn}
                  aria-label="Previous day"
                >
                  <ChevronLeft size={18} />
                </button>
                <button onClick={handleToday} className={styles.todayBtn}>
                  Today
                </button>
                <button
                  onClick={() => handleDateChange(1)}
                  className={styles.navBtn}
                  aria-label="Next day"
                >
                  <ChevronRight size={18} />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  className={styles.dateInput}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      fetchCalendarData(e.target.value);
                    }
                  }}
                  aria-label="Select date"
                />
              </div>
            </div>

            {/* Calendar Schedule Grid with Operatory / Provider Headers */}
            <div className={styles.calendarWrapper}>
              {loading && (
                <div className={styles.loadingOverlay}>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Loading calendar schedule...</span>
                </div>
              )}

              <div className={styles.scrollArea}>
                <div className={styles.calendarTable}>
                  {/* Header row: TIME + Operatories/Providers */}
                  <div className={styles.headerRow}>
                    <div className={styles.timeHeaderCell}>TIME</div>
                    {columns.map((col) => {
                      const isDoctor = col.role === 'Doctor';
                      const showSubtitle = Boolean(
                        isDoctor && col.name && col.name !== col.shortName
                      );

                      return (
                        <div key={col.id} className={styles.colHeaderCell}>
                          <div className={styles.colHeaderTitle}>{col.shortName}</div>
                          {showSubtitle && (
                            <div className={styles.colHeaderSubtitle}>{col.name}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Calendar Body: Left TIME column + Operatory vertical tracks */}
                  <div className={styles.bodyContainer}>
                      {/* Left Time Column with 6 AM to 8 PM in 10-minute intervals */}
                      <div className={styles.timeColumn}>
                        {slotRows.map((slot) => (
                          <div
                            key={slot.index}
                            className={`${styles.timeSlotLabel} ${
                              slot.isHourSlot ? styles.hourSeparator : styles.minorSeparator
                            }`}
                          >
                            <span className={slot.isHourSlot ? styles.hourText : styles.minorText}>
                              {slot.timeText}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Columns container */}
                      <div className={styles.columnsContainer}>
                        {columns.map((col, colIdx) => {
                          // Find all appointments for this column
                          // Match primarily by OperatoryNum, fallback by ProvNum if Op=0
                          const colAppts = appointments.filter((a) => {
                            if (Number(a.Op) === col.operatoryNum) return true;
                            if (
                              (!a.Op || Number(a.Op) === 0) &&
                              (Number(a.ProvNum) === col.providerNum ||
                                Number(a.ProvHyg) === col.providerNum)
                            ) {
                              return true;
                            }
                            if (
                              colIdx === 0 &&
                              (!a.Op || Number(a.Op) === 0) &&
                              (!a.ProvNum || Number(a.ProvNum) === 0)
                            ) {
                              return true;
                            }
                            return false;
                          });

                          return (
                            <div key={col.id} className={styles.operatoryColumn}>
                              {/* Horizontal 10-minute grid slot lines */}
                              {slotRows.map((slot) => (
                                <div
                                  key={slot.index}
                                  className={`${styles.gridSlot} ${
                                    slot.isHourSlot ? styles.gridSlotHour : styles.gridSlotMinor
                                  }`}
                                />
                              ))}

                              {/* Render appointment cards */}
                              {colAppts.map((appt) => {
                                const pos = getAppointmentPosition(appt);
                                if (!pos) return null;

                                const isHovered = hoveredApptId === appt.AptNum;
                                const status = appt.AptStatus || 'Scheduled';
                                const cardStatusClass =
                                  status === 'Complete' || status === 'Completed'
                                    ? styles.apptCardComplete
                                    : status === 'Broken'
                                    ? styles.apptCardBroken
                                    : status === 'UnschedList'
                                    ? styles.apptCardUnsched
                                    : status === 'ASAP'
                                    ? styles.apptCardAsap
                                    : status === 'Planned'
                                    ? styles.apptCardPlanned
                                    : styles.apptCardScheduled;
                                const isNP = appt.IsNewPatient === 'true' || appt.IsNewPatient === true;
                                const patDisplay = isNP && appt.patientName && !appt.patientName.startsWith('NP-')
                                  ? `NP-${appt.patientName}`
                                  : (appt.patientName || `Patient #${appt.PatNum}`);
                                const patientLastName = appt.patientDetails?.LName || (appt.patientName ? appt.patientName.split(',')[0]?.trim() : `Patient #${appt.PatNum}`);
                                const patientFirstName = appt.patientDetails?.FName || (appt.patientName ? appt.patientName.split(',')[1]?.trim() : '');
                                const duration = appt.durationMinutes || 30;
                                const procs = appt.ProcDescript || 'Flo, Ex, Pro';
                                const calculatedAge = calculateAge(appt.patientDetails?.Birthdate, appt.AptDateTime);
                                const isRightColumn = colIdx >= columns.length - 2;

                                const cardStyle: React.CSSProperties = {
                                  top: `${pos.top}px`,
                                  height: `${pos.height}px`,
                                  left: '4px',
                                  right: '4px',
                                  width: 'calc(100% - 8px)',
                                };

                                return (
                                  <div
                                    key={appt.AptNum}
                                    className={`${styles.apptCard} ${cardStatusClass} ${isHovered ? styles.apptCardHovered : ''}`}
                                    style={cardStyle}
                                    onClick={() => setSelectedAppt(appt)}
                                    onMouseEnter={() => setHoveredApptId(appt.AptNum)}
                                    onMouseLeave={() => setHoveredApptId(null)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        setSelectedAppt(appt);
                                      }
                                    }}
                                    aria-label="Appointment card"
                                  >
                                    <div className={styles.apptCardHeader}>Booked</div>
                                    <div className={styles.apptPatientName}>{patDisplay}</div>
                                    <div className={styles.apptDurationStatus}>
                                      {duration} min · {status}
                                    </div>
                                    <div className={styles.apptProcs}>{procs}</div>

                                    {/* Hover details flyout matching reference screenshot */}
                                    {isHovered && (
                                      <div
                                        className={`${styles.hoverPopover} ${
                                          isRightColumn ? styles.hoverPopoverLeft : styles.hoverPopoverRight
                                        }`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className={styles.popoverTop}>
                                          <div className={styles.popoverTopLeft}>
                                            <div className={styles.popoverPatientName}>
                                              <span>{isNP ? `NP-${patientLastName},` : `${patientLastName},`}</span>
                                              <span>{patientFirstName}</span>
                                            </div>
                                            <div className={styles.patientPicBox}>
                                              <span className={styles.patientPicText}>Patient Picture</span>
                                              <span className={styles.patientPicText}>Unavailable</span>
                                            </div>
                                          </div>

                                          <div className={styles.popoverTopRight}>
                                            <div>{formatPopoverDate(appt.AptDateTime)}</div>
                                            <div>{formatPopoverTime(appt.AptDateTime)}</div>
                                            <div>{duration} Min</div>
                                            <div>{appt.provAbbr || col.shortName}</div>
                                            <div>Production: $0.00</div>
                                          </div>
                                        </div>

                                        <div className={styles.popoverMiddle}>
                                          <div className={styles.popoverStatus}>
                                            {appt.confirmed || (appt.Confirmed === 19 ? 'Unconfirmed' : 'Confirmed')}
                                          </div>
                                          {Array.isArray(appt.diseases) && appt.diseases.length > 0 && (
                                            <div className={styles.popoverAlerts}>
                                              {appt.diseases.map((disease, dIdx) => (
                                                <div key={dIdx} className={styles.popoverAlertItem}>
                                                  {disease}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <div className={styles.popoverProc}>{appt.ProcDescript || 'Ex'}</div>
                                        </div>

                                        <div className={styles.popoverDivider} />

                                        <div className={styles.popoverBottom}>
                                          <div className={styles.popoverPatNum}>{appt.PatNum}</div>
                                          <div>{appt.patientDetails?.PatStatus || 'Patient'}</div>
                                          {calculatedAge !== null && <div>Age: {calculatedAge}</div>}
                                          <div>Hm: {appt.patientDetails?.HmPhone || ''}</div>
                                          <div>Wk: {appt.patientDetails?.WkPhone || ''}</div>
                                          <div>Cell: {appt.patientDetails?.WirelessPhone || ''}</div>
                                          <div>Confirm Method: —</div>
                                          <div>Contact Method: —</div>
                                          <div>Recall Method: —</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </>
        );
      })()}
    </div>
  );
}

