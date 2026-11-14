'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Cake,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Gift,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Settings2,
  X,
  Users,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatCard from '@/components/ui/StatCard/StatCard';
import TemplatePickerDialog from '@/components/feature/TemplatePicker/TemplatePickerDialog';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './Birthdays.module.css';

type BirthdayRange = 'today' | 'tomorrow' | 'next7' | 'thisMonth';
type Channel = 'sms' | 'email';
type Tab = 'overview' | 'scheduled' | 'calendar' | 'campaigns' | 'history' | 'reports';

interface BirthdayItem {
  id: string;
  firstName: string;
  lastName: string;
  birthdayDate: string;
  daysUntil: number;
  smsEligible: boolean;
  emailEligible: boolean;
}

interface BirthdayTemplate {
  id: string;
  name: string;
  channel: Channel;
  content: Record<string, unknown>;
  variables: string[];
  status: string;
  isSystem: boolean;
}

interface BirthdayCampaign {
  id: string;
  name: string;
  channel: Channel;
  templateId: string | null;
  daysBefore: number;
  localDeliveryTime: string;
  offerText: string | null;
  eligibilityRules: { minimumAge?: number; maximumAge?: number };
  enabled: boolean;
  templateName: string | null;
  templateStatus: string | null;
}

interface BirthdayHistory {
  id: string;
  campaignName: string;
  channel: Channel;
  firstName: string;
  lastName: string;
  birthdayYear: number;
  scheduledFor: string;
  sentAt: string | null;
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed' | 'skipped';
  lastErrorMessage: string | null;
}

interface ScheduledBirthdayMessage {
  id: string;
  campaignName: string;
  channel: Channel;
  firstName: string;
  lastName: string;
  birthdayDate: string | null;
  scheduledFor: string;
  eligible: boolean;
  status: 'scheduled' | 'processing' | 'sent' | 'delivered' | 'failed' | 'skipped';
}

interface BirthdayDashboard {
  timezone: string;
  selectedRange: { start: string; end: string };
  metrics: {
    today: number;
    tomorrow: number;
    next7Days: number;
    thisMonth: number;
    patientsMissingBirthdate: number;
  };
  birthdays: BirthdayItem[];
  todayBirthdays: BirthdayItem[];
  upcomingBirthdays: BirthdayItem[];
  campaigns: BirthdayCampaign[];
  history: BirthdayHistory[];
  scheduledMessages: ScheduledBirthdayMessage[];
  report: Record<string, number>;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface BirthdayCampaignDraft {
  name: string;
  channel: Channel;
  templateId: string;
  daysBefore: number;
  localDeliveryTime: string;
  offerText: string;
  minimumAge: string;
  maximumAge: string;
  enabled: boolean;
}

const EMPTY_DRAFT: BirthdayCampaignDraft = {
  name: '',
  channel: 'sms',
  templateId: '',
  daysBefore: 0,
  localDeliveryTime: '09:00',
  offerText: '',
  minimumAge: '',
  maximumAge: '',
  enabled: false,
};

const RANGE_OPTIONS: { value: BirthdayRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next7', label: 'Next 7 days' },
  { value: 'thisMonth', label: 'This month' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'campaigns', label: 'Campaign settings' },
  { value: 'scheduled', label: 'Scheduled messages' },
  { value: 'history', label: 'Delivery history' },
  { value: 'reports', label: 'Reports' },
];

function responseError<T>(response: Response, body: ApiResponse<T>, fallback: string): string {
  return response.ok ? '' : body.error || fallback;
}

function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getDateKeyInTimeZone(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function formatBirthdayDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)));
}

function getLocalMonth(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}`;
}

function monthRange(monthKey: string): { startDate: string; endDate: string } {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  };
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function BirthdaysPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState('');
  const [dashboard, setDashboard] = useState<BirthdayDashboard | null>(null);
  const [templates, setTemplates] = useState<BirthdayTemplate[]>([]);
  const [range, setRange] = useState<BirthdayRange>('next7');
  const [calendarMonth, setCalendarMonth] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'failed'>('all');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const templatePickerOpenRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BirthdayCampaignDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string; unresolved: string[] } | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const previewDialogRef = useRef<HTMLElement>(null);
  const previewRequestIdRef = useRef(0);

  const clearPreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setPreviewing(false);
    setPreview(null);
    setPreviewModalOpen(false);
  }, []);

  const closeCampaignEditor = useCallback(() => {
    clearPreview();
    setIsEditorOpen(false);
  }, [clearPreview]);

  useEffect(() => {
    if (!isEditorOpen) return;
    const activeDialog = previewModalOpen ? previewDialogRef.current : editorRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () => activeDialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? [];
    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (templatePickerOpenRef.current) return;
      if (event.key === 'Escape') {
        if (previewModalOpen) {
          setPreviewModalOpen(false);
        } else {
          closeCampaignEditor();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [closeCampaignEditor, isEditorOpen, previewModalOpen]);

  function openTemplatePicker() {
    templatePickerOpenRef.current = true;
    setTemplatePickerOpen(true);
  }

  function closeTemplatePicker() {
    templatePickerOpenRef.current = false;
    setTemplatePickerOpen(false);
  }

  const loadDashboard = useCallback(async (
    selectedPracticeId: string,
    selectedRange: BirthdayRange | 'custom',
    startDate?: string,
    endDate?: string,
    options: { background?: boolean } = {}
  ) => {
    if (!options.background) setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ practiceId: selectedPracticeId, range: selectedRange });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const response = await fetch(`/api/birthdays?${params}`);
      const body = await response.json() as ApiResponse<BirthdayDashboard>;
      const error = responseError(response, body, 'Failed to load birthday data');
      const data = body.data;
      if (error || !data) throw new Error(error || 'Birthday data is unavailable');
      setDashboard(data);
      setCalendarMonth((current) => current || getLocalMonth(data.timezone));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load birthday data';
      setLoadError(message);
      if (!options.background) showToast(message, 'error');
    } finally {
      if (!options.background) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const syncPractice = () => {
      const selectedPracticeId = localStorage.getItem('selectedClinicId') || '';
      setPracticeId(selectedPracticeId);
      if (selectedPracticeId) {
        setRange('next7');
        setCalendarMonth('');
        void loadDashboard(selectedPracticeId, 'next7');
      } else {
        setDashboard(null);
        setLoading(false);
      }
    };
    syncPractice();
    window.addEventListener('practiceChanged', syncPractice);
    window.addEventListener('storage', syncPractice);
    return () => {
      window.removeEventListener('practiceChanged', syncPractice);
      window.removeEventListener('storage', syncPractice);
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!practiceId) return;
    let active = true;
    async function loadTemplates() {
      try {
        const response = await fetch(`/api/birthdays/campaigns?practiceId=${practiceId}`);
        const body = await response.json() as ApiResponse<{ templates: BirthdayTemplate[] }>;
        const error = responseError(response, body, 'Failed to load birthday templates');
        if (error || !body.data) throw new Error(error || 'Birthday templates are unavailable');
        if (active) setTemplates(body.data.templates);
      } catch (error) {
        if (active) showToast(error instanceof Error ? error.message : 'Failed to load birthday templates', 'error');
      }
    }
    void loadTemplates();
    return () => { active = false; };
  }, [practiceId, showToast]);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.channel === draft.channel),
    [draft.channel, templates]
  );

  const refresh = useCallback(() => {
    if (!practiceId) return;
    void loadDashboard(practiceId, range);
  }, [loadDashboard, practiceId, range]);

  useEffect(() => {
    if (tab !== 'scheduled' || !practiceId) return;
    let active = true;
    let refreshInProgress = false;
    const refreshScheduledMessages = () => {
      if (!active || document.visibilityState !== 'visible' || refreshInProgress) return;
      refreshInProgress = true;
      void loadDashboard(practiceId, range, undefined, undefined, { background: true })
        .finally(() => { refreshInProgress = false; });
    };
    const intervalId = window.setInterval(refreshScheduledMessages, 60_000);
    document.addEventListener('visibilitychange', refreshScheduledMessages);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshScheduledMessages);
    };
  }, [loadDashboard, practiceId, range, tab]);

  function setSelectedRange(nextRange: BirthdayRange) {
    setRange(nextRange);
    if (practiceId) void loadDashboard(practiceId, nextRange);
  }

  function changeCalendarMonth(amount: number) {
    const [year, month] = calendarMonth.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(year, month - 1 + amount, 1));
    const nextKey = toMonthKey(nextMonth);
    setCalendarMonth(nextKey);
    const { startDate, endDate } = monthRange(nextKey);
    if (practiceId) void loadDashboard(practiceId, 'custom', startDate, endDate);
  }

  function startCreateCampaign() {
    setDraft(EMPTY_DRAFT);
    setEditingCampaignId(null);
    clearPreview();
    setIsEditorOpen(true);
  }

  function startEditCampaign(campaign: BirthdayCampaign) {
    setDraft({
      name: campaign.name,
      channel: campaign.channel,
      templateId: campaign.templateId ?? '',
      daysBefore: campaign.daysBefore,
      localDeliveryTime: campaign.localDeliveryTime,
      offerText: campaign.offerText ?? '',
      minimumAge: campaign.eligibilityRules.minimumAge?.toString() ?? '',
      maximumAge: campaign.eligibilityRules.maximumAge?.toString() ?? '',
      enabled: campaign.enabled,
    });
    setEditingCampaignId(campaign.id);
    clearPreview();
    setIsEditorOpen(true);
  }

  async function handleSaveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!practiceId || !draft.templateId) {
      showToast('Choose a birthday template before saving', 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editingCampaignId ? `/api/birthdays/campaigns/${editingCampaignId}` : '/api/birthdays/campaigns',
        {
          method: editingCampaignId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            practiceId,
            name: draft.name,
            channel: draft.channel,
            templateId: draft.templateId,
            daysBefore: Number(draft.daysBefore),
            localDeliveryTime: draft.localDeliveryTime,
            offerText: draft.offerText.trim() || null,
            eligibilityRules: {
              ...(draft.minimumAge !== '' ? { minimumAge: Number(draft.minimumAge) } : {}),
              ...(draft.maximumAge !== '' ? { maximumAge: Number(draft.maximumAge) } : {}),
            },
            enabled: draft.enabled,
          }),
        }
      );
      const body = await response.json() as ApiResponse<BirthdayCampaign>;
      const error = responseError(response, body, 'Failed to save birthday campaign');
      if (error) throw new Error(error);
      showToast(draft.enabled ? 'Birthday campaign saved and enabled' : 'Birthday campaign saved as disabled', 'success');
      closeCampaignEditor();
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save birthday campaign', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    if (!practiceId || !draft.templateId) {
      showToast('Choose a birthday template to preview', 'error');
      return;
    }
    const requestId = ++previewRequestIdRef.current;
    setPreviewing(true);
    setPreview(null);
    setPreviewModalOpen(false);
    try {
      const response = await fetch('/api/birthdays/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          templateId: draft.templateId,
          firstName: 'Taylor',
          birthdayDate: dashboard?.selectedRange.start,
          offer: draft.offerText || undefined,
        }),
      });
      const body = await response.json() as ApiResponse<{ subject: string; body: string; unresolved: string[] }>;
      const error = responseError(response, body, 'Failed to preview template');
      if (error || !body.data) throw new Error(error || 'Preview is unavailable');
      if (requestId === previewRequestIdRef.current) {
        setPreview(body.data);
        setPreviewModalOpen(true);
      }
    } catch (error) {
      if (requestId === previewRequestIdRef.current) {
        showToast(error instanceof Error ? error.message : 'Failed to preview template', 'error');
      }
    } finally {
      if (requestId === previewRequestIdRef.current) setPreviewing(false);
    }
  }

  async function handleDeleteCampaign(campaignId: string, name: string) {
    if (!practiceId || !window.confirm(`Remove "${name}"? Its delivery history will be retained.`)) return;
    try {
      const response = await fetch(
        `/api/birthdays/campaigns/${campaignId}?practiceId=${encodeURIComponent(practiceId)}`,
        { method: 'DELETE' }
      );
      const body = await response.json() as ApiResponse<unknown>;
      const error = responseError(response, body, 'Failed to remove birthday campaign');
      if (error) throw new Error(error);
      showToast('Birthday campaign removed', 'success');
      refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove birthday campaign', 'error');
    }
  }

  async function cloneTemplate(template: BirthdayTemplate) {
    if (!practiceId) return;
    try {
      const response = await fetch(`/api/templates/${template.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const body = await response.json() as ApiResponse<{ id: string }>;
      const error = responseError(response, body, 'Failed to clone birthday template');
      if (error || !body.data) throw new Error(error || 'Cloned birthday template is unavailable');

      const templatesResponse = await fetch(`/api/birthdays/campaigns?practiceId=${encodeURIComponent(practiceId)}`);
      const templatesBody = await templatesResponse.json() as ApiResponse<{ templates: BirthdayTemplate[] }>;
      const templatesError = responseError(templatesResponse, templatesBody, 'Failed to reload birthday templates');
      if (templatesError || !templatesBody.data) {
        throw new Error(templatesError || 'Birthday templates are unavailable');
      }
      setTemplates(templatesBody.data.templates);
      closeTemplatePicker();
      showToast('Template cloned. Publish it in the Templates library before using it in a campaign.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to clone birthday template', 'error');
    }
  }

  const selectedTemplate = templates.find((template) => template.id === draft.templateId);
  const filteredHistory = useMemo(
    () => dashboard?.history.filter((item) => historyFilter === 'all' || item.status === 'failed') ?? [],
    [dashboard, historyFilter]
  );
  const calendarEvents = dashboard?.birthdays ?? [];
  const [calendarYear, calendarMonthNumber] = calendarMonth.split('-').map(Number);
  const daysInCalendarMonth = calendarMonth ? new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate() : 0;
  const firstDayOffset = calendarMonth ? (new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay() + 6) % 7 : 0;
  const calendarCells = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInCalendarMonth }, (_, index) => index + 1),
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title="Birthday Engagement"
        description="Celebrate patients with thoughtful, consent-aware birthday greetings."
        actions={
          <div className={styles.headerActions}>
            <Link className={styles.secondaryButton} href="/workspace/templates?category=birthdays">
              <Gift size={16} /> Birthday templates
            </Link>
            <button className={styles.primaryButton} onClick={startCreateCampaign} disabled={!practiceId}>
              <Plus size={17} /> New campaign
            </button>
          </div>
        }
      />

      {!practiceId ? (
        <div className={styles.emptyState}>
          <Cake size={32} />
          <h2>Select a practice to view birthdays</h2>
          <p>Birthday information is scoped to the currently selected practice.</p>
        </div>
      ) : (
        <>
          <section className={styles.metricGrid} aria-label="Birthday metrics">
            <StatCard icon={<Cake size={20} aria-hidden="true" />} label="Today" value={dashboard?.metrics.today ?? '—'} />
            <StatCard icon={<Clock3 size={20} aria-hidden="true" />} label="Tomorrow" value={dashboard?.metrics.tomorrow ?? '—'} />
            <StatCard icon={<Users size={20} aria-hidden="true" />} label="Next 7 days" value={dashboard?.metrics.next7Days ?? '—'} />
            <StatCard icon={<CalendarDays size={20} aria-hidden="true" />} label="This month" value={dashboard?.metrics.thisMonth ?? '—'} />
          </section>

          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label="Birthday engagement views">
              {TABS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  className={tab === item.value ? styles.activeTab : styles.tab}
                  onClick={() => {
                    setTab(item.value);
                    if (item.value === 'overview' || item.value === 'scheduled') refresh();
                    if (item.value === 'calendar' && calendarMonth) {
                      const { startDate, endDate } = monthRange(calendarMonth);
                      void loadDashboard(practiceId, 'custom', startDate, endDate);
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loadError && <div className={styles.errorBanner} role="alert">{loadError}</div>}
          {loading && <p className={styles.loading}>Loading birthday information…</p>}
          {!loading && !loadError && dashboard && (
            <section className={styles.contentPanel} role="tabpanel">
              {tab === 'overview' && (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Upcoming birthdays</h2>
                      <p>Patients with known birthdays in the selected range. Birth years are not displayed.</p>
                    </div>
                    <div className={styles.rangeControls}>
                      <label htmlFor="birthdayRange">Show</label>
                      <select
                        id="birthdayRange"
                        value={range}
                        onChange={(event) => setSelectedRange(event.target.value as BirthdayRange)}
                      >
                        {RANGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {range === 'next7' ? (
                    <>
                      <div>
                        <h3 className={styles.subheading}>Today</h3>
                        <BirthdayList birthdays={dashboard.todayBirthdays} />
                      </div>
                      <div>
                        <h3 className={styles.subheading}>Coming up</h3>
                        <BirthdayList birthdays={dashboard.upcomingBirthdays.filter((birthday) => birthday.daysUntil > 0)} />
                      </div>
                    </>
                  ) : (
                    <BirthdayList birthdays={dashboard.birthdays} />
                  )}
                </>
              )}

              {tab === 'scheduled' && (
                <>
                  <div className={`${styles.sectionHeading} ${styles.scheduledHeader}`}>
                    <div>
                      <h2>Scheduled birthday messages</h2>
                      <p>
                        Upcoming deliveries are calculated from enabled campaigns for active patients.
                        The worker persists them automatically; contact and consent are checked again before sending.
                      </p>
                    </div>
                    <span className={styles.timezoneBadge}>Practice time: {dashboard.timezone}</span>
                  </div>
                  <ScheduledMessagesTable
                    messages={dashboard.scheduledMessages}
                    timezone={dashboard.timezone}
                  />
                </>
              )}

              {tab === 'calendar' && (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Monthly birthday calendar</h2>
                      <p>Calendar dates use the selected practice timezone: {dashboard.timezone}.</p>
                    </div>
                    <div className={styles.monthControls}>
                      <button aria-label="Previous month" onClick={() => changeCalendarMonth(-1)}><ChevronLeft size={18} /></button>
                      <strong>{monthLabel(calendarMonth)}</strong>
                      <button aria-label="Next month" onClick={() => changeCalendarMonth(1)}><ChevronRight size={18} /></button>
                    </div>
                  </div>
                  <div className={styles.calendar}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <div className={styles.weekday} key={day}>{day}</div>
                    ))}
                    {calendarCells.map((day, index) => {
                      if (day === null) return <div className={styles.calendarBlank} key={`blank-${index}`} />;
                      const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
                      const names = calendarEvents.filter((item) => item.birthdayDate === date);
                      return (
                        <div className={styles.calendarDay} key={date}>
                          <span className={styles.dayNumber}>{day}</span>
                          {names.slice(0, 3).map((birthday) => (
                            <span className={styles.calendarName} key={birthday.id}>
                              {birthday.firstName} {birthday.lastName}
                            </span>
                          ))}
                          {names.length > 3 && <span className={styles.moreNames}>+{names.length - 3} more</span>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {tab === 'campaigns' && (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Birthday campaign settings</h2>
                      <p>Campaigns remain disabled until an administrator explicitly enables them.</p>
                    </div>
                    <button className={styles.primaryButton} onClick={startCreateCampaign}>
                      <Plus size={17} /> New campaign
                    </button>
                  </div>
                  {dashboard.campaigns.length === 0 ? (
                    <div className={styles.emptyInline}>
                      <Settings2 size={26} />
                      <strong>No birthday campaigns configured</strong>
                      <span>Create a campaign to choose a template, channel, and local delivery time.</span>
                    </div>
                  ) : (
                    <div className={styles.campaignList}>
                      {dashboard.campaigns.map((campaign) => (
                        <article className={styles.campaignCard} key={campaign.id}>
                          <div className={styles.campaignInfo}>
                            <h3>{campaign.name}</h3>
                            <p>
                              {campaign.channel === 'sms' ? 'SMS' : 'Email'} · {campaign.templateName ?? 'Template unavailable'} ·
                              {' '}{campaign.daysBefore === 0 ? 'On birthday' : `${campaign.daysBefore} days before`} at {campaign.localDeliveryTime} · All eligible patients
                            </p>
                          </div>
                          <span className={campaign.enabled ? styles.enabledBadge : styles.disabledBadge}>
                            {campaign.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <div className={styles.campaignActions}>
                            <button className={styles.iconButton} aria-label={`Edit ${campaign.name}`} onClick={() => startEditCampaign(campaign)}>
                              <Pencil size={16} />
                            </button>
                            <button className={styles.deleteButton} onClick={() => void handleDeleteCampaign(campaign.id, campaign.name)}>
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <p className={styles.notice}>
                    <strong>Delivery safeguards:</strong> only active patients with a known birthday, a matching contact method, and current channel consent are eligible. Consent is rechecked immediately before each send.
                  </p>
                </>
              )}

              {tab === 'history' && (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Delivery history</h2>
                      <p>Recent scheduled messages and their latest processing status.</p>
                    </div>
                    <label className={styles.field}>
                      History
                      <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}>
                        <option value="all">All attempts</option>
                        <option value="failed">Failed reminders</option>
                      </select>
                    </label>
                  </div>
                  <HistoryTable
                    history={filteredHistory}
                    timezone={dashboard.timezone}
                    emptyMessage={historyFilter === 'failed' ? 'No failed birthday reminders' : 'No birthday delivery history yet'}
                  />
                </>
              )}

              {tab === 'reports' && (
                <>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Birthday engagement report</h2>
                      <p>Counts represent durable birthday message occurrences; sent means accepted by the provider.</p>
                    </div>
                  </div>
                  <div className={styles.reportGrid}>
                    <StatCard
                      icon={<CalendarClock size={20} aria-hidden="true" />}
                      label="Scheduled"
                      value={(dashboard.report.scheduled ?? 0).toLocaleString()}
                    />
                    <StatCard
                      icon={<Eye size={20} aria-hidden="true" />}
                      label="Attempted"
                      value={(dashboard.report.attempted ?? 0).toLocaleString()}
                    />
                    <StatCard
                      icon={<Send size={20} aria-hidden="true" />}
                      label="Sent"
                      value={(dashboard.report.sent ?? 0).toLocaleString()}
                    />
                    <StatCard
                      icon={<Mail size={20} aria-hidden="true" />}
                      label="Delivered"
                      value={(dashboard.report.delivered ?? 0).toLocaleString()}
                    />
                    <StatCard
                      icon={<X size={20} aria-hidden="true" />}
                      label="Failed"
                      value={(dashboard.report.failed ?? 0).toLocaleString()}
                    />
                    <StatCard
                      icon={<ChevronRight size={20} aria-hidden="true" />}
                      label="Skipped"
                      value={(dashboard.report.skipped ?? 0).toLocaleString()}
                    />
                  </div>
                  <p className={styles.notice}>Provider delivery receipts are not currently integrated, so a sent message is not a confirmed delivery.</p>
                </>
              )}
            </section>
          )}

        </>
      )}

      <TemplatePickerDialog
        open={templatePickerOpen}
        title="Birthday templates"
        description={`Only published ${draft.channel.toUpperCase()} templates from the Birthdays category are listed.`}
        templates={filteredTemplates}
        selectedTemplateId={draft.templateId}
        onClose={closeTemplatePicker}
        onSelect={(template) => {
          setDraft((current) => ({ ...current, templateId: template.id }));
          closeTemplatePicker();
          clearPreview();
        }}
        onClone={(template) => void cloneTemplate(template)}
        libraryHref="/workspace/templates?category=birthdays"
        emptyMessage={`No published ${draft.channel.toUpperCase()} birthday templates available. Create one in the`}
      />

      {isEditorOpen && (
        <div className={styles.modalBackdrop}>
          <section ref={editorRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="campaignEditorTitle">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="campaignEditorTitle">{editingCampaignId ? 'Edit birthday campaign' : 'Create birthday campaign'}</h2>
                <p>Schedule messages in the practice timezone: {dashboard?.timezone ?? 'loading'}.</p>
              </div>
              <button className={styles.iconButton} aria-label="Close campaign settings" onClick={closeCampaignEditor}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCampaign} className={styles.form}>
              <label className={styles.field}>
                Campaign name
                <input required maxLength={255} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <label className={styles.field}>
                Channel
                <select
                  value={draft.channel}
                  onChange={(event) => {
                    clearPreview();
                    setDraft({ ...draft, channel: event.target.value as Channel, templateId: '' });
                  }}
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <div className={styles.templatePicker}>
                <div>
                  <strong>{selectedTemplate?.name ?? 'No template selected'}</strong>
                  <span>
                    {selectedTemplate
                      ? `${selectedTemplate.isSystem ? 'System template' : 'Practice template'} · ${selectedTemplate.status} · ${selectedTemplate.channel.toUpperCase()}`
                      : `Select a published ${draft.channel.toUpperCase()} template from Birthday templates.`}
                  </span>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={openTemplatePicker}>
                  Choose template
                </button>
              </div>
              <div className={styles.formRow}>
                <label className={styles.field}>
                  Send
                  <select value={draft.daysBefore} onChange={(event) => setDraft({ ...draft, daysBefore: Number(event.target.value) })}>
                    {[0, 1, 2, 3, 7, 14, 30].map((days) => (
                      <option key={days} value={days}>{days === 0 ? 'On the birthday' : `${days} days before`}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Local delivery time ({dashboard?.timezone ?? 'loading'})
                  <input type="time" required value={draft.localDeliveryTime} onChange={(event) => setDraft({ ...draft, localDeliveryTime: event.target.value })} />
                </label>
              </div>
              <label className={styles.field}>
                Optional birthday offer
                <input maxLength={500} value={draft.offerText} onChange={(event) => setDraft({ ...draft, offerText: event.target.value })} placeholder="Used by {{birthday.offer}} templates" />
              </label>
              <fieldset className={styles.rulesFieldset}>
                <legend>Optional eligibility rules</legend>
                <div className={styles.formRow}>
                  <label className={styles.field}>
                    Minimum age
                    <input type="number" min={0} max={120} value={draft.minimumAge} onChange={(event) => setDraft({ ...draft, minimumAge: event.target.value })} />
                  </label>
                  <label className={styles.field}>
                    Maximum age
                    <input type="number" min={0} max={120} value={draft.maximumAge} onChange={(event) => setDraft({ ...draft, maximumAge: event.target.value })} />
                  </label>
                </div>
              </fieldset>
              <label className={styles.enableControl}>
                <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
                <span>
                  <strong>Enable scheduled birthday messages</strong>
                  <small>When enabled, the protected scheduler will create and dispatch future messages.</small>
                </span>
              </label>
              {selectedTemplate && (
                <p className={styles.templateHint}>
                  <Link href="/workspace/templates?category=birthdays" target="_blank" rel="noreferrer">Customize or manage birthday templates</Link>
                </p>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => void handlePreview()} disabled={!draft.templateId || previewing}>
                  {previewing ? 'Rendering…' : 'Preview message'}
                </button>
                <span className={styles.actionSpacer} />
                <button type="button" className={styles.secondaryButton} onClick={closeCampaignEditor}>Cancel</button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving || !draft.templateId}
                >
                  {saving ? 'Saving…' : 'Save campaign'}
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
            className={`${styles.modal} ${styles.messagePreviewModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="birthday-message-preview-title"
            tabIndex={-1}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="birthday-message-preview-title">Birthday message preview</h2>
                <p>{selectedTemplate?.name ?? 'Birthday template'} · {draft.channel.toUpperCase()}</p>
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
            <div className={styles.preview}>
              {preview.subject && <strong>{preview.subject}</strong>}
              <pre>{preview.body}</pre>
              {preview.unresolved.length > 0 && (
                <p className={styles.previewWarning}>Unresolved variables: {preview.unresolved.join(', ')}</p>
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
    </div>
  );
}

function BirthdayList({ birthdays }: { birthdays: BirthdayItem[] }) {
  if (birthdays.length === 0) {
    return (
      <div className={styles.emptyInline}>
        <Cake size={26} />
        <strong>No birthdays in this date range</strong>
        <span>Try another range. Patients without birthdates are safely excluded.</span>
      </div>
    );
  }
  return (
    <div className={styles.birthdayList}>
      {birthdays.map((birthday) => (
        <article className={styles.birthdayRow} key={`${birthday.id}-${birthday.birthdayDate}`}>
          <span className={styles.avatar}>{birthday.firstName.charAt(0).toUpperCase()}</span>
          <div className={styles.birthdayPerson}>
            <strong>{birthday.firstName} {birthday.lastName}</strong>
            <span>{formatBirthdayDate(birthday.birthdayDate)}</span>
          </div>
          <div className={styles.eligibility}>
            <span title={birthday.smsEligible ? 'SMS consent and phone available' : 'SMS unavailable or opted out'} className={birthday.smsEligible ? styles.allowed : styles.unavailable}><MessageSquareText size={15} /> SMS</span>
            <span title={birthday.emailEligible ? 'Email consent and address available' : 'Email unavailable or opted out'} className={birthday.emailEligible ? styles.allowed : styles.unavailable}><Mail size={15} /> Email</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function ScheduledMessagesTable({
  messages,
  timezone,
}: {
  messages: ScheduledBirthdayMessage[];
  timezone: string;
}) {
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [scheduledDateFilter, setScheduledDateFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ScheduledBirthdayMessage['status']>('all');
  const [patientSearch, setPatientSearch] = useState('');

  const campaignNames = useMemo(
    () => Array.from(new Set(messages.map((message) => message.campaignName))).sort((a, b) => a.localeCompare(b)),
    [messages],
  );
  const filteredMessages = useMemo(() => {
    const searchTerm = patientSearch.trim().toLowerCase();
    return messages.filter((message) => {
      if (campaignFilter !== 'all' && message.campaignName !== campaignFilter) return false;
      if (channelFilter !== 'all' && message.channel !== channelFilter) return false;
      if (statusFilter !== 'all' && message.status !== statusFilter) return false;
      if (
        scheduledDateFilter &&
        getDateKeyInTimeZone(message.scheduledFor, timezone) !== scheduledDateFilter
      ) return false;
      if (
        searchTerm &&
        !`${message.firstName} ${message.lastName}`.toLowerCase().includes(searchTerm)
      ) return false;
      return true;
    });
  }, [campaignFilter, channelFilter, messages, patientSearch, scheduledDateFilter, statusFilter, timezone]);

  return (
    <>
      <div className={styles.scheduleFilters}>
        <label className={styles.field}>
          Campaign
          <select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}>
            <option value="all">All campaigns</option>
            {campaignNames.map((campaignName) => (
              <option key={campaignName} value={campaignName}>{campaignName}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Scheduled date
          <input
            type="date"
            value={scheduledDateFilter}
            onChange={(event) => setScheduledDateFilter(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          Channel
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as 'all' | Channel)}>
            <option value="all">All channels</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label className={styles.field}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | ScheduledBirthdayMessage['status'])}
          >
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </label>
        <label className={styles.field}>
          Patient search
          <input
            type="search"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Search patient"
          />
        </label>
      </div>
      {filteredMessages.length === 0 ? (
        <div className={styles.emptyInline}>
          <Clock3 size={26} />
          <strong>
            {messages.length === 0
              ? 'No scheduled birthday messages'
              : 'No scheduled birthday messages match these filters'}
          </strong>
          <span>
            {messages.length === 0
              ? 'Enable a campaign to schedule messages for eligible patients.'
              : 'Adjust or clear your filters to see scheduled messages.'}
          </span>
        </div>
      ) : (
        <div className={styles.scheduledTableWrap}>
          <table className={styles.scheduledTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Birthday</th>
                <th>Campaign name</th>
                <th>Scheduled message</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message) => (
                <tr key={message.id}>
                  <td><strong>{message.firstName} {message.lastName}</strong></td>
                  <td>{message.birthdayDate ? formatBirthdayDate(message.birthdayDate) : '—'}</td>
                  <td>{message.campaignName}</td>
                  <td>{formatTime(message.scheduledFor, timezone)}</td>
                  <td>{message.channel.toUpperCase()}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${message.status === 'scheduled' ? styles.pending : styles[message.status]}`}>
                      {message.status === 'scheduled' ? 'Scheduled' : message.status}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${message.eligible ? styles.enabledBadge : styles.disabledBadge}`}>
                      {message.eligible ? 'Eligible' : 'Consent/contact required'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HistoryTable({
  history,
  timezone,
  emptyMessage,
}: {
  history: BirthdayHistory[];
  timezone: string;
  emptyMessage: string;
}) {
  if (history.length === 0) {
    return <div className={styles.emptyInline}><Clock3 size={26} /><strong>{emptyMessage}</strong></div>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.historyTable}>
        <thead>
          <tr><th>Patient</th><th>Campaign</th><th>Channel</th><th>Scheduled</th><th>Status</th><th>Details</th></tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.id}>
              <td>{item.firstName} {item.lastName}</td>
              <td>{item.campaignName}</td>
              <td>{item.channel.toUpperCase()}</td>
              <td>{formatTime(item.scheduledFor, timezone)}</td>
              <td><span className={`${styles.statusBadge} ${styles[item.status]}`}>{item.status}</span></td>
              <td>{item.lastErrorMessage ?? (item.sentAt ? `Accepted ${formatTime(item.sentAt, timezone)}` : '—')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
