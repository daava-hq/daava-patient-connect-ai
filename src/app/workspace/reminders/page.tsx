'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Eye, Plus, Send, Settings2, X } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import {
  REMINDER_INTERVAL_OPTIONS,
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
  description: string | null;
  scheduleId: string;
  scheduleName: string;
  interval: ReminderIntervalValue;
  channel: 'sms' | 'email';
  reminderAt: string;
  reminderStatus: string;
  lastErrorMessage: string | null;
  eligible: boolean;
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
  schedules: ReminderSchedule[];
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
  unresolved: string[];
  isValid: boolean;
}

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
  const [formOpen, setFormOpen] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [filterSchedule, setFilterSchedule] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'eligible' | 'ineligible'>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'failed'>('all');
  const [search, setSearch] = useState('');
  const [previewAppointmentId, setPreviewAppointmentId] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const scheduleDialogRef = useRef<HTMLElement | null>(null);
  const templateDialogRef = useRef<HTMLElement | null>(null);

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
        localStorage.getItem('selectedClinicId') ||
        localStorage.getItem('selected_practice_id') ||
        '';
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
    if (!formOpen || templateDialogOpen) return;
    return manageDialogFocus(scheduleDialogRef.current, () => setFormOpen(false));
  }, [formOpen, templateDialogOpen]);

  useEffect(() => {
    if (!templateDialogOpen) return;
    return manageDialogFocus(templateDialogRef.current, () => setTemplateDialogOpen(false));
  }, [templateDialogOpen]);

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
  const filteredUpcoming = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.upcoming.filter((reminder) => {
      if (filterSchedule !== 'all' && reminder.scheduleId !== filterSchedule) return false;
      if (audienceFilter === 'eligible' && !reminder.eligible) return false;
      if (audienceFilter === 'ineligible' && reminder.eligible) return false;
      return reminder.patientName.toLowerCase().includes(search.toLowerCase());
    });
  }, [audienceFilter, dashboard, filterSchedule, search]);
  const filteredHistory = useMemo(
    () => dashboard?.history.filter((reminder) => historyFilter === 'all' || reminder.status === 'failed') ?? [],
    [dashboard, historyFilter]
  );
  const selectedTemplate = templates.find((template) => template.id === form.templateId);
  const selectedPracticeTimezone = dashboard?.practice.timezone ?? 'UTC';

  function openCreateForm() {
    setEditingScheduleId(null);
    setPreviewOnly(false);
    setForm(EMPTY_FORM);
    setPreview(null);
    setPreviewAppointmentId(dashboard?.upcoming[0]?.appointmentId ?? '');
    setFormOpen(true);
  }

  function openEditForm(schedule: ReminderSchedule) {
    setEditingScheduleId(schedule.id);
    setPreviewOnly(false);
    setForm({
      name: schedule.name,
      interval: schedule.interval,
      channel: schedule.channel,
      localSendTime: schedule.localSendTime,
      templateId: schedule.templateId ?? '',
      enabled: schedule.enabled,
    });
    setPreview(null);
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
      setFormOpen(false);
      await loadDashboard(practiceId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save reminder schedule', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleSchedule(schedule: ReminderSchedule) {
    if (!practiceId) return;
    try {
      const response = await fetch(`/api/appointment-reminders/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, enabled: !schedule.enabled }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to update schedule');
      await loadDashboard(practiceId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update schedule', 'error');
    }
  }

  async function requestPreview() {
    if (!practiceId || !form.templateId || !previewAppointmentId) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const response = await fetch('/api/appointment-reminders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, appointmentId: previewAppointmentId, templateId: form.templateId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to preview template');
      setPreview(json.data as PreviewResult);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to preview template', 'error');
    } finally {
      setPreviewing(false);
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

  async function sendManually(reminder: UpcomingReminder) {
    if (!practiceId) return;
    try {
      const response = await fetch('/api/appointment-reminders/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          scheduleId: reminder.scheduleId,
          appointmentId: reminder.appointmentId,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to execute reminder');
      const status = json.data.status as string;
      showToast(
        status === 'sent' ? 'Reminder accepted by the messaging provider' : json.data.lastErrorMessage || status,
        status === 'sent' ? 'success' : 'error'
      );
      await loadDashboard(practiceId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to execute reminder', 'error');
    }
  }

  return (
    <main className={styles.page}>
      <PageHeader
        title="Appointment Reminders"
        description="Configure and track appointment messages using locally synchronized appointments."
        actions={
          <button type="button" className={styles.primaryButton} onClick={openCreateForm} disabled={!practiceId}>
            <Plus size={17} aria-hidden="true" /> Add schedule
          </button>
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
          <div className={styles.providerNotice} role="status">
            <strong>Provider status:</strong>{' '}
            {dashboard.providerAvailability.sms || dashboard.providerAvailability.email
              ? 'At least one messaging provider is configured.'
              : 'SMS and email providers are not configured. Reminder execution is safely disabled until a provider is available.'}
            <span> Times use {dashboard.practice.timezone}.</span>
          </div>

          <section className={styles.statsGrid} aria-label="Reminder report">
            <Stat label="Scheduled" value={dashboard.stats.scheduled} />
            <Stat label="Attempted" value={dashboard.stats.attempted} />
            <Stat label="Sent" value={dashboard.stats.sent} />
            <Stat label="Delivered" value={dashboard.stats.delivered} />
            <Stat label="Failed" value={dashboard.stats.failed} />
            <Stat label="Skipped" value={dashboard.stats.skipped} />
          </section>

          <section className={styles.section} aria-labelledby="settings-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="settings-heading">Reminder settings</h2>
                <p>Each enabled schedule targets future, locally synchronized scheduled appointments.</p>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={openCreateForm}>
                <Settings2 size={16} aria-hidden="true" /> Configure schedule
              </button>
            </div>
            {dashboard.schedules.length === 0 ? (
              <p className={styles.emptyInline}>No schedules yet. Add one to start preparing reminders.</p>
            ) : (
              <div className={styles.scheduleGrid}>
                {dashboard.schedules.map((schedule) => (
                  <article className={styles.scheduleCard} key={schedule.id}>
                    <div className={styles.scheduleTitle}>
                      <div>
                        <h3>{schedule.name}</h3>
                        <span className={styles.mutedText}>
                          {intervalLabel(schedule.interval)} · {schedule.channel.toUpperCase()} · {schedule.localSendTime} local
                        </span>
                      </div>
                      <span className={`${styles.statusBadge} ${schedule.enabled ? styles.enabled : styles.disabled}`}>
                        {schedule.enabled ? 'Enabled' : 'Paused'}
                      </span>
                    </div>
                    <p className={styles.templateSummary}>Template: {schedule.templateName ?? 'Unavailable'}</p>
                    <div className={styles.cardActions}>
                      <button type="button" className={styles.textButton} onClick={() => openEditForm(schedule)}>Edit</button>
                      <button type="button" className={styles.textButton} onClick={() => void toggleSchedule(schedule)}>
                        {schedule.enabled ? 'Pause' : 'Enable'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="upcoming-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="upcoming-heading">Upcoming reminders</h2>
                <p>Appointment status is checked again immediately before dispatch; “Scheduled” does not mean attendance is confirmed.</p>
              </div>
            </div>
            <div className={styles.filters}>
              <label>
                Schedule
                <select value={filterSchedule} onChange={(event) => setFilterSchedule(event.target.value)}>
                  <option value="all">All schedules</option>
                  {dashboard.schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Audience
                <select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value as typeof audienceFilter)}>
                  <option value="all">All patients</option>
                  <option value="eligible">Consent and contact available</option>
                  <option value="ineligible">Missing consent or contact</option>
                </select>
              </label>
              <label>
                Patient search
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient" />
              </label>
            </div>
            {filteredUpcoming.length === 0 ? (
              <p className={styles.emptyInline}>No upcoming reminder matches these filters.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Appointment</th>
                      <th>Reminder</th>
                      <th>Channel</th>
                      <th>Eligibility</th>
                      <th><span className={styles.visuallyHidden}>Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUpcoming.map((reminder) => (
                      <tr key={`${reminder.appointmentId}-${reminder.scheduleId}`}>
                        <td>
                          <strong>{reminder.patientName}</strong>
                          <span className={styles.tableSubtext}>{reminder.scheduleName}</span>
                        </td>
                        <td>{formatDate(reminder.scheduledAt, selectedPracticeTimezone)}</td>
                        <td>{formatDate(reminder.reminderAt, selectedPracticeTimezone)}</td>
                        <td>{reminder.channel.toUpperCase()}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${reminder.eligible ? styles.enabled : styles.disabled}`}>
                            {reminder.eligible ? 'Eligible' : 'Consent/contact required'}
                          </span>
                          <span className={styles.tableSubtext}>{reminder.reminderStatus}</span>
                        </td>
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                              setEditingScheduleId(null);
                              setPreviewOnly(true);
                              setForm({
                                ...EMPTY_FORM,
                                name: reminder.scheduleName,
                                channel: reminder.channel,
                                templateId: dashboard.schedules.find((schedule) => schedule.id === reminder.scheduleId)?.templateId ?? '',
                              });
                              setPreviewAppointmentId(reminder.appointmentId);
                              setPreview(null);
                              setFormOpen(true);
                            }}
                            aria-label={`Preview reminder for ${reminder.patientName}`}
                          >
                            <Eye size={16} aria-hidden="true" /> Preview
                          </button>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => void sendManually(reminder)}
                            disabled={
                              !reminder.eligible ||
                              !dashboard.providerAvailability[reminder.channel] ||
                              ['sent', 'delivered', 'processing'].includes(reminder.reminderStatus)
                            }
                            aria-label={`Send reminder manually to ${reminder.patientName}`}
                            title={!dashboard.providerAvailability[reminder.channel] ? 'Messaging provider is not configured' : undefined}
                          >
                            <Send size={16} aria-hidden="true" /> Send now
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.section} aria-labelledby="history-heading">
            <div className={styles.sectionHeader}>
              <div>
                <h2 id="history-heading">Delivery history</h2>
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
              <p className={styles.emptyInline}>
                {historyFilter === 'failed' ? 'No failed reminders.' : 'No reminder delivery history yet.'}
              </p>
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
          </section>
        </>
      )}

      {formOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFormOpen(false);
        }}>
          <section ref={scheduleDialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="schedule-dialog-title">
                  {previewOnly ? 'Preview appointment reminder' : editingScheduleId ? 'Edit reminder schedule' : 'Add reminder schedule'}
                </h2>
                <p>{previewOnly ? 'Review the selected template with this appointment context.' : 'Choose an appointment reminder template and practice-local send time.'}</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setFormOpen(false)} aria-label="Close schedule form">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={saveSchedule} className={styles.form}>
              {!previewOnly && <label>
                Schedule name
                <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="24-hour SMS reminder" />
              </label>}
              {!previewOnly && <div className={styles.formRow}>
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
                  <select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as 'sms' | 'email', templateId: '' })}>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </label>
              </div>}
              {!previewOnly && <label>
                Same-day send time ({selectedPracticeTimezone})
                <input type="time" required value={form.localSendTime} onChange={(event) => setForm({ ...form, localSendTime: event.target.value })} />
              </label>}
              {!previewOnly && <div className={styles.templatePicker}>
                <div>
                  <strong>{selectedTemplate?.name ?? 'No template selected'}</strong>
                  <span>{selectedTemplate ? `${selectedTemplate.isSystem ? 'System template' : 'Practice template'} · ${selectedTemplate.status}` : 'Select from Appointment Reminders templates.'}</span>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={() => setTemplateDialogOpen(true)}>
                  Choose template
                </button>
              </div>}

              <label>
                Preview appointment
                <select value={previewAppointmentId} onChange={(event) => setPreviewAppointmentId(event.target.value)}>
                  <option value="">Select an upcoming appointment</option>
                  {previewAppointments.map((appointment) => (
                    <option key={appointment.appointmentId} value={appointment.appointmentId}>
                      {appointment.patientName} · {formatDate(appointment.scheduledAt, selectedPracticeTimezone)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={styles.secondaryButton} onClick={() => void requestPreview()} disabled={!form.templateId || !previewAppointmentId || previewing}>
                <Eye size={16} aria-hidden="true" /> {previewing ? 'Rendering…' : 'Preview message'}
              </button>
              {preview && (
                <div className={`${styles.previewBox} ${preview.isValid ? '' : styles.previewInvalid}`} aria-live="polite">
                  <strong>{preview.templateName} · {preview.channel.toUpperCase()}</strong>
                  {preview.subject && <p><b>Subject:</b> {preview.subject}</p>}
                  <pre>{preview.body || 'Template has no message body.'}</pre>
                  {!preview.isValid && (
                    <p className={styles.errorText}>
                      Missing or invalid variables: {preview.unresolved.join(', ') || 'message body'}
                    </p>
                  )}
                </div>
              )}
              {!previewOnly && <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                Enable automated scheduling
              </label>}
              {!previewOnly && <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving || !form.templateId}>
                  {saving ? 'Saving…' : editingScheduleId ? 'Save changes' : 'Create schedule'}
                </button>
              </div>}
            </form>
          </section>
        </div>
      )}

      {templateDialogOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTemplateDialogOpen(false);
        }}>
          <section ref={templateDialogRef} className={styles.templateDialog} role="dialog" aria-modal="true" aria-labelledby="template-dialog-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="template-dialog-title">Appointment reminder templates</h2>
                <p>Only templates from the centralized Appointment Reminders category are listed.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setTemplateDialogOpen(false)} aria-label="Close template selector">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {compatibleTemplates.length === 0 ? (
              <p className={styles.emptyInline}>No {form.channel.toUpperCase()} templates available. Create one in the <Link href="/workspace/templates">Templates library</Link>.</p>
            ) : (
              <div className={styles.templateList}>
                {compatibleTemplates.map((template) => (
                  <article className={styles.templateOption} key={template.id}>
                    <div>
                      <strong>{template.name}</strong>
                      <span>{template.isSystem ? 'System template' : 'Practice template'} · {template.status} · {template.channel.toUpperCase()}</span>
                    </div>
                    <div className={styles.templateActions}>
                      <button type="button" className={styles.textButton} onClick={() => {
                        setForm((current) => ({ ...current, templateId: template.id }));
                        setTemplateDialogOpen(false);
                        setPreview(null);
                      }}>Select</button>
                      {template.isSystem && (
                        <button type="button" className={styles.textButton} onClick={() => void cloneTemplate(template)}>Clone</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className={styles.templateFooter}>
              <Link href="/workspace/templates">Open Templates library</Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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
