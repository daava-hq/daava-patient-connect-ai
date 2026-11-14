'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Settings2,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatCard from '@/components/ui/StatCard/StatCard';
import TemplatePickerDialog from '@/components/feature/TemplatePicker/TemplatePickerDialog';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import EmailMessagePreview from '@/components/feature/EmailMessagePreview/EmailMessagePreview';
import {
  addDaysToDateKey,
  getAppointmentDateMetrics,
  REMINDER_INTERVAL_OPTIONS,
  getDateKeyInTimeZone,
  type ReminderIntervalValue,
} from '@/lib/appointment-reminders/reminder-utils';
import styles from './RemindersPage.module.css';

interface ReminderSchedule {
  id: string;
  name: string;
  interval: ReminderIntervalValue;
  channel: 'sms' | 'email';
  localSendTime: string;
  templateId: string | null;
  templateName: string | null;
  enabled: boolean;
}

interface UpcomingReminder {
  appointmentId: string;
  patientId: string;
  patientName: string;
  scheduledAt: string;
  appointmentStatus: string;
  scheduleId: string;
  scheduleName: string;
  interval: ReminderIntervalValue;
  channel: 'sms' | 'email';
  reminderAt: string;
  reminderStatus: string;
  lastErrorMessage: string | null;
  eligible: boolean;
  smsEligible: boolean;
  emailEligible: boolean;
}

interface UpcomingAppointmentSummary {
  appointmentId: string;
  patientName: string;
  scheduledAt: string;
  smsEligible: boolean;
  emailEligible: boolean;
}

interface ReminderHistory {
  id: string;
  patientName: string;
  appointmentAt: string;
  scheduleName: string;
  channel: 'sms' | 'email';
  status: string;
  attemptCount: number;
  attemptedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  providerMessageId: string | null;
  lastErrorMessage: string | null;
  scheduledFor: string;
  manual: boolean;
}

interface ReminderTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'email' | 'in_app';
  templateType: string;
  status: string;
  isSystem: boolean;
  practiceId: string | null;
}

interface ReminderDashboard {
  practice: { name: string; timezone: string };
  sampleDataResetAvailable: boolean;
  schedules: ReminderSchedule[];
  upcomingAppointments: UpcomingAppointmentSummary[];
  upcoming: UpcomingReminder[];
  history: ReminderHistory[];
  stats: {
    scheduled: number;
    attempted: number;
    sent: number;
    delivered: number;
    failed: number;
    skipped: number;
  };
  providerAvailability: { sms: boolean; email: boolean };
}

interface ScheduleForm {
  name: string;
  interval: ReminderIntervalValue;
  channel: 'sms' | 'email';
  localSendTime: string;
  templateId: string;
  enabled: boolean;
}

interface PreviewResult {
  templateName: string;
  channel: string;
  subject: string;
  body: string;
  html?: string;
  unresolved: string[];
  isValid: boolean;
}

type ReminderTab = 'overview' | 'settings' | 'scheduled' | 'history' | 'reports';
type AppointmentRange = 'today' | 'tomorrow' | 'next7' | 'thisMonth';

const TABS: { value: ReminderTab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'settings', label: 'Reminder settings' },
  { value: 'scheduled', label: 'Scheduled reminders' },
  { value: 'history', label: 'Delivery history' },
  { value: 'reports', label: 'Reports' },
];

const APPOINTMENT_RANGE_OPTIONS: { value: AppointmentRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'thisMonth', label: 'This month' },
];

const EMPTY_FORM: ScheduleForm = {
  name: '',
  interval: '24_hours',
  channel: 'sms',
  localSendTime: '09:00',
  templateId: '',
  enabled: true,
};

function formatDate(value: string, timeZone: string, includeTime = true) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value));
}

function intervalLabel(interval: ReminderIntervalValue) {
  return REMINDER_INTERVAL_OPTIONS.find((option) => option.value === interval)?.label ?? interval;
}

export default function RemindersPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState('');
  const [dashboard, setDashboard] = useState<ReminderDashboard | null>(null);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<ReminderTab>('overview');
  const [appointmentRange, setAppointmentRange] = useState<AppointmentRange>('thisMonth');
  const [formOpen, setFormOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [filterSchedule, setFilterSchedule] = useState('all');
  const [filterReminderDate, setFilterReminderDate] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'sms' | 'email'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'scheduled' | 'processing' | 'sent' | 'delivered' | 'failed' | 'skipped'
  >('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [previewAppointmentId, setPreviewAppointmentId] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const scheduleDialogRef = useRef<HTMLElement | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const previewRequestIdRef = useRef(0);

  const clearPreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setPreviewing(false);
    setPreview(null);
    setPreviewModalOpen(false);
  }, []);

  const closeScheduleForm = useCallback(() => {
    clearPreview();
    setFormOpen(false);
  }, [clearPreview]);

  const loadDashboard = useCallback(async (selectedPracticeId: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const [dashboardResponse, templateResponse] = await Promise.all([
        fetch(`/api/appointment-reminders?practiceId=${encodeURIComponent(selectedPracticeId)}`),
        fetch(`/api/appointment-reminders/templates?practiceId=${encodeURIComponent(selectedPracticeId)}`),
      ]);
      const dashboardJson = await dashboardResponse.json();
      const templateJson = await templateResponse.json();
      if (!dashboardResponse.ok) throw new Error(dashboardJson.error || 'Failed to load reminder data');
      if (!templateResponse.ok) throw new Error(templateJson.error || 'Failed to load reminder templates');
      setDashboard(dashboardJson.data as ReminderDashboard);
      setTemplates(templateJson.data as ReminderTemplate[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load appointment reminders';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const syncSelectedPractice = () => {
      const selectedPracticeId =
        localStorage.getItem('selectedClinicId') || '';
      setPracticeId(selectedPracticeId);
      if (!selectedPracticeId) setLoading(false);
    };

    syncSelectedPractice();
    window.addEventListener('practiceChanged', syncSelectedPractice);
    window.addEventListener('storage', syncSelectedPractice);
    return () => {
      window.removeEventListener('practiceChanged', syncSelectedPractice);
      window.removeEventListener('storage', syncSelectedPractice);
    };
  }, []);

  useEffect(() => {
    if (practiceId) void loadDashboard(practiceId);
  }, [practiceId, loadDashboard]);

  useEffect(() => {
    if (!formOpen || templateDialogOpen || previewModalOpen) return;
    return manageDialogFocus(scheduleDialogRef.current, closeScheduleForm);
  }, [closeScheduleForm, formOpen, previewModalOpen, templateDialogOpen]);

  useEffect(() => {
    if (!previewModalOpen) return;
    return manageDialogFocus(previewDialogRef.current, () => setPreviewModalOpen(false));
  }, [previewModalOpen]);

  const compatibleTemplates = useMemo(
    () => templates.filter((template) => template.channel === form.channel),
    [templates, form.channel]
  );
  const previewAppointments = useMemo(() => {
    const appointmentsById = new Map(
      (dashboard?.upcoming ?? []).map((appointment) => [appointment.appointmentId, appointment])
    );
    return Array.from(appointmentsById.values());
  }, [dashboard]);
  const selectedPracticeTimezone = dashboard?.practice.timezone ?? 'UTC';
  const filteredUpcoming = useMemo(() => {
    if (!dashboard) return [];
    const searchTerm = search.trim().toLowerCase();
    return dashboard.upcoming.filter((reminder) => {
      if (filterSchedule !== 'all' && reminder.scheduleId !== filterSchedule) return false;
      if (channelFilter !== 'all' && reminder.channel !== channelFilter) return false;
      if (
        statusFilter !== 'all' &&
        (statusFilter === 'scheduled'
          ? reminder.reminderStatus !== 'scheduled' && reminder.reminderStatus !== 'due'
          : reminder.reminderStatus !== statusFilter)
      ) return false;
      if (
        filterReminderDate &&
        getDateKeyInTimeZone(new Date(reminder.reminderAt), selectedPracticeTimezone) !== filterReminderDate
      ) return false;
      return !searchTerm || reminder.patientName.toLowerCase().includes(searchTerm);
    });
  }, [channelFilter, dashboard, filterReminderDate, filterSchedule, search, selectedPracticeTimezone, statusFilter]);
  const appointmentMetrics = useMemo(
    () => getAppointmentDateMetrics(dashboard?.upcomingAppointments ?? [], new Date(), selectedPracticeTimezone),
    [dashboard, selectedPracticeTimezone]
  );
  const upcomingAppointments = useMemo(
    () => dashboard?.upcomingAppointments ?? [],
    [dashboard]
  );
  const filteredUpcomingAppointments = useMemo(() => {
    const today = getDateKeyInTimeZone(new Date(), selectedPracticeTimezone);
    const tomorrow = addDaysToDateKey(today, 1);
    const nextSevenDays = addDaysToDateKey(today, 6);
    const month = today.slice(0, 7);

    return upcomingAppointments.filter((appointment) => {
      const appointmentDate = getDateKeyInTimeZone(
        new Date(appointment.scheduledAt),
        selectedPracticeTimezone
      );
      if (appointmentRange === 'today') return appointmentDate === today;
      if (appointmentRange === 'tomorrow') return appointmentDate === tomorrow;
      if (appointmentRange === 'next7') return appointmentDate >= today && appointmentDate <= nextSevenDays;
      return appointmentDate.startsWith(month);
    });
  }, [appointmentRange, selectedPracticeTimezone, upcomingAppointments]);
  const filteredHistory = useMemo(
    () => dashboard?.history.filter((reminder) => historyFilter === 'all' || reminder.status === 'failed') ?? [],
    [dashboard, historyFilter]
  );
  const selectedTemplate = templates.find((template) => template.id === form.templateId);

  function openCreateForm() {
    setEditingScheduleId(null);
    setForm(EMPTY_FORM);
    clearPreview();
    setPreviewAppointmentId(dashboard?.upcoming[0]?.appointmentId ?? '');
    setFormOpen(true);
  }

  function openEditForm(schedule: ReminderSchedule) {
    setEditingScheduleId(schedule.id);
    setForm({
      name: schedule.name,
      interval: schedule.interval,
      channel: schedule.channel,
      localSendTime: schedule.localSendTime,
      templateId: schedule.templateId ?? '',
      enabled: schedule.enabled,
    });
    clearPreview();
    setPreviewAppointmentId(dashboard?.upcoming[0]?.appointmentId ?? '');
    setFormOpen(true);
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!practiceId || !form.templateId) return;
    setSaving(true);
    try {
      const response = await fetch(
        editingScheduleId
          ? `/api/appointment-reminders/${editingScheduleId}`
          : '/api/appointment-reminders',
        {
          method: editingScheduleId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ practiceId, ...form }),
        }
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to save reminder schedule');
      showToast(editingScheduleId ? 'Reminder schedule updated' : 'Reminder schedule created', 'success');
      closeScheduleForm();
      await loadDashboard(practiceId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save reminder schedule', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(schedule: ReminderSchedule) {
    if (!practiceId) return;
    const confirmed = window.confirm(
      `Delete "${schedule.name}"? Its reminder occurrences and delivery history will also be permanently deleted.`
    );
    if (!confirmed) return;

    setDeletingScheduleId(schedule.id);
    try {
      const response = await fetch(`/api/appointment-reminders/${schedule.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to delete reminder schedule');
      setFilterSchedule('all');
      showToast('Reminder schedule deleted', 'success');
      await loadDashboard(practiceId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete reminder schedule', 'error');
    } finally {
      setDeletingScheduleId(null);
    }
  }

  async function requestPreview() {
    if (!practiceId || !form.templateId || !previewAppointmentId) return;
    const requestId = ++previewRequestIdRef.current;
    setPreviewing(true);
    setPreview(null);
    setPreviewModalOpen(false);
    try {
      const response = await fetch('/api/appointment-reminders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, appointmentId: previewAppointmentId, templateId: form.templateId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to preview template');
      if (requestId === previewRequestIdRef.current) {
        setPreview(json.data as PreviewResult);
        setPreviewModalOpen(true);
      }
    } catch (error) {
      if (requestId === previewRequestIdRef.current) {
        showToast(error instanceof Error ? error.message : 'Unable to preview template', 'error');
      }
    } finally {
      if (requestId === previewRequestIdRef.current) setPreviewing(false);
    }
  }

  async function cloneTemplate(template: ReminderTemplate) {
    if (!practiceId) return;
    try {
      const response = await fetch(`/api/templates/${template.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to clone template');
      await loadDashboard(practiceId);
      setTemplateDialogOpen(false);
      showToast('Template cloned. Publish it in the Templates library before using it in a schedule.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to clone template', 'error');
    }
  }

  const upcomingFilters = (
    <div className={styles.filters}>
      <label>
        Schedule
        <select value={filterSchedule} onChange={(event) => setFilterSchedule(event.target.value)}>
          <option value="all">All schedules</option>
          {dashboard?.schedules.filter((schedule) => schedule.enabled).map((schedule) => (
            <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
          ))}
        </select>
      </label>
      <label>
        Scheduled date
        <input
          type="date"
          value={filterReminderDate}
          onChange={(event) => setFilterReminderDate(event.target.value)}
        />
      </label>
      <label>
        Channel
        <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as typeof channelFilter)}>
          <option value="all">All channels</option>
          <option value="sms">SMS</option>
          <option value="email">Email</option>
        </select>
      </label>
      <label>
        Status
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="processing">Processing</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </label>
      <label>
        Patient search
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient" />
      </label>
    </div>
  );

  return (
    <main className={styles.page}>
      <PageHeader
        title="Appointment Reminders"
        description="Manage appointment reminder schedules and track upcoming deliveries."
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} href="/workspace/templates?category=appointment-reminders">
              <Bell size={16} aria-hidden="true" /> Reminder templates
            </Link>
            <button type="button" className={styles.primaryButton} onClick={openCreateForm} disabled={!practiceId}>
              <Plus size={17} aria-hidden="true" /> New reminder
            </button>
          </div>
        }
      />

      {!practiceId && !loading && (
        <section className={styles.emptyState} aria-live="polite">
          <Bell size={32} aria-hidden="true" />
          <h2>Select a practice</h2>
          <p>Choose a practice in the workspace before setting up appointment reminders.</p>
        </section>
      )}

      {loading && <p className={styles.statusMessage} role="status">Loading appointment reminders…</p>}
      {loadError && !loading && (
        <section className={styles.errorState} role="alert">
          <p>{loadError}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => void loadDashboard(practiceId)}>
            Try again
          </button>
        </section>
      )}

      {dashboard && !loading && (
        <>
          <section className={styles.metricGrid} aria-label="Appointment metrics">
            <StatCard
              icon={<CalendarDays size={20} aria-hidden="true" />}
              label="Today"
              value={appointmentMetrics.today}
            />
            <StatCard
              icon={<Clock3 size={20} aria-hidden="true" />}
              label="Tomorrow"
              value={appointmentMetrics.tomorrow}
            />
            <StatCard
              icon={<CalendarClock size={20} aria-hidden="true" />}
              label="Next 7 days"
              value={appointmentMetrics.next7Days}
            />
            <StatCard
              icon={<CalendarDays size={20} aria-hidden="true" />}
              label="This month"
              value={appointmentMetrics.thisMonth}
            />
          </section>

          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label="Appointment reminders views">
              {TABS.map((item) => (
                <button
                  key={item.value}
                  id={`reminder-tab-${item.value}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  aria-controls="reminder-panel"
                  className={tab === item.value ? styles.activeTab : styles.tab}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <section
            className={styles.section}
            id="reminder-panel"
            role="tabpanel"
            aria-labelledby={`reminder-tab-${tab}`}
            tabIndex={0}
          >
            {tab === 'overview' && (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Upcoming appointments</h2>
                    <p>Appointments in the selected date range. Times use the practice timezone.</p>
                  </div>
                  <div className={styles.rangeControls}>
                    <label htmlFor="appointmentRange">Show</label>
                    <select
                      id="appointmentRange"
                      value={appointmentRange}
                      onChange={(event) => setAppointmentRange(event.target.value as AppointmentRange)}
                    >
                      {APPOINTMENT_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {filteredUpcomingAppointments.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <CalendarClock size={26} aria-hidden="true" />
                    <strong>No upcoming appointments</strong>
                    <span>No appointments are scheduled in this date range.</span>
                  </div>
                ) : (
                  <div className={styles.appointmentList}>
                    {filteredUpcomingAppointments.map((appointment) => (
                      <article className={styles.appointmentRow} key={appointment.appointmentId}>
                        <span className={styles.avatar} aria-hidden="true">
                          {appointment.patientName.charAt(0).toUpperCase()}
                        </span>
                        <div className={styles.appointmentPerson}>
                          <strong>{appointment.patientName}</strong>
                          <span>{formatDate(appointment.scheduledAt, selectedPracticeTimezone)}</span>
                        </div>
                        <div className={styles.eligibility}>
                          <span
                            title={appointment.smsEligible ? 'SMS consent and phone available' : 'SMS unavailable or opted out'}
                            className={appointment.smsEligible ? styles.allowed : styles.unavailable}
                          >
                            <MessageSquareText size={15} aria-hidden="true" />
                            SMS
                            <span className={styles.visuallyHidden}>
                              {appointment.smsEligible ? ' consent and phone available' : ' unavailable or opted out'}
                            </span>
                          </span>
                          <span
                            title={appointment.emailEligible ? 'Email consent and address available' : 'Email unavailable or opted out'}
                            className={appointment.emailEligible ? styles.allowed : styles.unavailable}
                          >
                            <Mail size={15} aria-hidden="true" />
                            Email
                            <span className={styles.visuallyHidden}>
                              {appointment.emailEligible ? ' consent and address available' : ' unavailable or opted out'}
                            </span>
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'settings' && (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Reminder settings</h2>
                    <p>Each enabled schedule targets otherwise-eligible future appointments.</p>
                  </div>
                  <button type="button" className={styles.primaryButton} onClick={openCreateForm}>
                    <Plus size={17} aria-hidden="true" /> New reminder
                  </button>
                </div>
                {dashboard.schedules.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <Settings2 size={26} aria-hidden="true" />
                    <strong>No reminder schedules configured</strong>
                    <span>Create a schedule to prepare reminders for eligible appointments.</span>
                  </div>
                ) : (
                  <div className={styles.scheduleList}>
                    {dashboard.schedules.map((schedule) => (
                      <article className={styles.scheduleRow} key={schedule.id}>
                        <div className={styles.scheduleInfo}>
                          <h3>{schedule.name}</h3>
                          <p>
                            {intervalLabel(schedule.interval)} · {schedule.channel.toUpperCase()} · {schedule.localSendTime} local ·
                            {' '}Template: {schedule.templateName ?? 'Unavailable'} · All eligible appointments
                          </p>
                        </div>
                        <span className={`${styles.statusBadge} ${schedule.enabled ? styles.enabled : styles.scheduleDisabled}`}>
                          {schedule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div className={styles.scheduleActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => openEditForm(schedule)}
                            disabled={deletingScheduleId !== null}
                            aria-label={`Edit ${schedule.name}`}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => void deleteSchedule(schedule)}
                            disabled={deletingScheduleId !== null}
                            aria-label={`Remove ${schedule.name}`}
                          >
                            {deletingScheduleId === schedule.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <p className={styles.notice}>
                  Reminder delivery is subject to appointment status, patient contact details, communication consent, and provider availability.
                </p>
              </>
            )}

            {tab === 'scheduled' && (
              <>
                <div className={`${styles.sectionHeader} ${styles.scheduledHeader}`}>
                  <div>
                    <h2>Scheduled reminders</h2>
                    <p>Projected delivery times for future appointments with enabled schedules; status is checked again before dispatch.</p>
                  </div>
                  <span className={styles.timezoneBadge}>Practice time: {dashboard.practice.timezone}</span>
                </div>
                {upcomingFilters}
                {filteredUpcoming.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <CalendarClock size={26} aria-hidden="true" />
                    <strong>No scheduled reminders match these filters</strong>
                    <span>Enable a reminder schedule or adjust your filters.</span>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Appointment</th>
                          <th>Schedule</th>
                          <th>Scheduled reminder</th>
                          <th>Channel</th>
                          <th>Status</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUpcoming.map((reminder) => (
                          <tr key={`${reminder.appointmentId}-${reminder.scheduleId}`}>
                            <td><strong>{reminder.patientName}</strong></td>
                            <td>
                              {formatDate(reminder.scheduledAt, selectedPracticeTimezone)}
                              <span className={styles.tableSubtext}>{reminder.appointmentStatus}</span>
                            </td>
                            <td>{reminder.scheduleName}</td>
                            <td>{formatDate(reminder.reminderAt, selectedPracticeTimezone)}</td>
                            <td>{reminder.channel.toUpperCase()}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${
                                reminder.reminderStatus === 'scheduled' || reminder.reminderStatus === 'due'
                                  ? styles.pending
                                  : styles[reminder.reminderStatus] ?? ''
                              }`}>
                                {reminder.reminderStatus}
                              </span>
                            </td>
                            <td>
                              <span className={`${styles.statusBadge} ${reminder.eligible ? styles.enabled : styles.disabled}`}>
                                {reminder.eligible ? 'Eligible' : 'Consent/contact required'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === 'history' && (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Delivery history</h2>
                    <p>“Sent” means accepted by a configured provider; delivered status is shown only when provider data confirms it.</p>
                  </div>
                  <label className={styles.compactFilter}>
                    History
                    <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}>
                      <option value="all">All attempts</option>
                      <option value="failed">Failed reminders</option>
                    </select>
                  </label>
                </div>
                {filteredHistory.length === 0 ? (
                  <div className={styles.emptyInline}>
                    <Clock3 size={26} aria-hidden="true" />
                    <strong>{historyFilter === 'failed' ? 'No failed reminders' : 'No reminder delivery history yet'}</strong>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Schedule</th>
                          <th>Channel</th>
                          <th>Status</th>
                          <th>Attempted</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((reminder) => (
                          <tr key={reminder.id}>
                            <td>
                              <strong>{reminder.patientName}</strong>
                              <span className={styles.tableSubtext}>{formatDate(reminder.appointmentAt, selectedPracticeTimezone)}</span>
                            </td>
                            <td>{reminder.scheduleName}{reminder.manual ? ' · Manual' : ''}</td>
                            <td>{reminder.channel.toUpperCase()}</td>
                            <td><span className={`${styles.statusBadge} ${styles[reminder.status] ?? ''}`}>{reminder.status}</span></td>
                            <td>{reminder.attemptedAt ? formatDate(reminder.attemptedAt, selectedPracticeTimezone) : '—'}</td>
                            <td className={styles.errorDetail}>{reminder.lastErrorMessage ?? reminder.providerMessageId ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === 'reports' && (
              <>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Appointment reminder report</h2>
                    <p>Counts represent reminder occurrences; sent means accepted by the messaging provider.</p>
                  </div>
                </div>
                <section className={styles.reportGrid} aria-label="Reminder report">
                  <StatCard
                    icon={<CalendarClock size={20} aria-hidden="true" />}
                    label="Scheduled"
                    value={dashboard.stats.scheduled.toLocaleString()}
                  />
                  <StatCard
                    icon={<Eye size={20} aria-hidden="true" />}
                    label="Attempted"
                    value={dashboard.stats.attempted.toLocaleString()}
                  />
                  <StatCard
                    icon={<Send size={20} aria-hidden="true" />}
                    label="Sent"
                    value={dashboard.stats.sent.toLocaleString()}
                  />
                  <StatCard
                    icon={<Mail size={20} aria-hidden="true" />}
                    label="Delivered"
                    value={dashboard.stats.delivered.toLocaleString()}
                  />
                  <StatCard
                    icon={<X size={20} aria-hidden="true" />}
                    label="Failed"
                    value={dashboard.stats.failed.toLocaleString()}
                  />
                  <StatCard
                    icon={<ChevronRight size={20} aria-hidden="true" />}
                    label="Skipped"
                    value={dashboard.stats.skipped.toLocaleString()}
                  />
                </section>
                <p className={styles.notice}>
                  Provider delivery receipts are not currently integrated, so a sent message is not a confirmed delivery.
                </p>
              </>
            )}
          </section>
        </>
      )}

      {formOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeScheduleForm();
        }}>
          <section ref={scheduleDialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="schedule-dialog-title">
                  {editingScheduleId ? 'Edit reminder schedule' : 'Add reminder schedule'}
                </h2>
                <p>Choose a template and practice-local send time. All eligible appointments are included.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={closeScheduleForm} aria-label="Close schedule form">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={saveSchedule} className={styles.form}>
              <label>
                Schedule name
                <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="24-hour SMS reminder" />
              </label>
              <div className={styles.formRow}>
                <label>
                  Interval
                  <select value={form.interval} onChange={(event) => setForm({ ...form, interval: event.target.value as ReminderIntervalValue })}>
                    {REMINDER_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Channel
                  <select value={form.channel} onChange={(event) => {
                    clearPreview();
                    setForm({ ...form, channel: event.target.value as 'sms' | 'email', templateId: '' });
                  }}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </label>
              </div>
              <label>
                Local delivery time ({selectedPracticeTimezone})
                <input type="time" required value={form.localSendTime} onChange={(event) => setForm({ ...form, localSendTime: event.target.value })} />
              </label>
              <div className={styles.templatePicker}>
                <div>
                  <strong>{selectedTemplate?.name ?? 'No template selected'}</strong>
                  <span>{selectedTemplate ? `${selectedTemplate.isSystem ? 'System template' : 'Practice template'} · ${selectedTemplate.status}` : 'Select from Appointment Reminders templates.'}</span>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={() => setTemplateDialogOpen(true)}>
                  Choose template
                </button>
              </div>
              <label>
                Preview appointment
                <select value={previewAppointmentId} onChange={(event) => {
                  clearPreview();
                  setPreviewAppointmentId(event.target.value);
                }}>
                  <option value="">Select an upcoming appointment</option>
                  {previewAppointments.map((appointment) => (
                    <option key={appointment.appointmentId} value={appointment.appointmentId}>
                      {appointment.patientName} · {formatDate(appointment.scheduledAt, selectedPracticeTimezone)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.enableControl}>
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                <span>
                  <strong>Enable scheduled reminders</strong>
                  <small>When enabled, this schedule will prepare and dispatch reminders for eligible appointments.</small>
                </span>
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => void requestPreview()} disabled={!form.templateId || !previewAppointmentId || previewing}>
                  <Eye size={16} aria-hidden="true" /> {previewing ? 'Rendering…' : 'Preview message'}
                </button>
                <span className={styles.actionSpacer} />
                <button type="button" className={styles.secondaryButton} onClick={closeScheduleForm}>Cancel</button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving || !form.templateId}
                >
                  {saving ? 'Saving…' : editingScheduleId ? 'Save changes' : 'Create schedule'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {previewModalOpen && preview && (
        <div
          className={`${styles.modalBackdrop} ${styles.previewBackdrop}`}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewModalOpen(false);
          }}
        >
          <section
            ref={previewDialogRef}
            className={`${styles.modal} ${styles.previewModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-preview-title"
            tabIndex={-1}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="reminder-preview-title">Reminder message preview</h2>
                <p>{preview.templateName} · {preview.channel.toUpperCase()}</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setPreviewModalOpen(false)}
                aria-label="Close message preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className={`${styles.previewBox} ${preview.isValid ? '' : styles.previewInvalid}`}>
              {preview.subject && <p><b>Subject:</b> {preview.subject}</p>}
              {preview.channel === 'email' && preview.html ? (
                <EmailMessagePreview html={preview.html} />
              ) : (
                <pre>{preview.body || 'Template has no message body.'}</pre>
              )}
              {!preview.isValid && (
                <p className={styles.errorText}>
                  Missing or invalid variables: {preview.unresolved.join(', ') || 'message body'}
                </p>
              )}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setPreviewModalOpen(false)}>
                Close preview
              </button>
            </div>
          </section>
        </div>
      )}

      <TemplatePickerDialog
        open={templateDialogOpen}
        title="Appointment reminder templates"
        description="Only templates from the centralized Appointment Reminders category are listed."
        templates={compatibleTemplates}
        selectedTemplateId={form.templateId}
        onClose={() => setTemplateDialogOpen(false)}
        onSelect={(template) => {
          setForm((current) => ({ ...current, templateId: template.id }));
          setTemplateDialogOpen(false);
          clearPreview();
        }}
        onClone={(template) => void cloneTemplate(template)}
        libraryHref="/workspace/templates?category=appointment-reminders"
        emptyMessage={`No ${form.channel.toUpperCase()} templates available. Create one in the`}
      />
    </main>
  );
}

function manageDialogFocus(dialog: HTMLElement | null, onEscape: () => void) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
  focusable[0]?.focus();

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== 'Tab' || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown);
    previous?.focus();
  };
}
