'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Cake,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
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
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import styles from './Birthdays.module.css';

type BirthdayRange = 'today' | 'tomorrow' | 'next7' | 'thisMonth' | 'custom';
type Channel = 'sms' | 'email';
type Tab = 'overview' | 'calendar' | 'campaigns' | 'history' | 'reports';

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
  { value: 'custom', label: 'Custom range' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'campaigns', label: 'Campaign settings' },
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
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [calendarMonth, setCalendarMonth] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BirthdayCampaignDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string; unresolved: string[] } | null>(null);
  const editorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isEditorOpen) return;
    const editor = editorRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () => editor?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? [];
    getFocusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsEditorOpen(false);
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
  }, [isEditorOpen]);

  const loadDashboard = useCallback(async (
    selectedPracticeId: string,
    selectedRange: BirthdayRange,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
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
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const syncPractice = () => {
      const selectedPracticeId = localStorage.getItem('selectedClinicId') || '';
      setPracticeId(selectedPracticeId);
      if (selectedPracticeId) {
        setRange('next7');
        setCalendarMonth('');
        setCustomStart('');
        setCustomEnd('');
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
    if (range === 'custom') {
      void loadDashboard(practiceId, range, customStart || undefined, customEnd || undefined);
    } else {
      void loadDashboard(practiceId, range);
    }
  }, [customEnd, customStart, loadDashboard, practiceId, range]);

  function setSelectedRange(nextRange: BirthdayRange) {
    setRange(nextRange);
    if (practiceId && nextRange !== 'custom') void loadDashboard(practiceId, nextRange);
  }

  function startCreateCampaign() {
    setDraft(EMPTY_DRAFT);
    setEditingCampaignId(null);
    setPreview(null);
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
    setPreview(null);
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
      setIsEditorOpen(false);
      setPreview(null);
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
      setPreview(body.data);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to preview template', 'error');
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

  function changeCalendarMonth(amount: number) {
    const [year, month] = calendarMonth.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(year, month - 1 + amount, 1));
    const nextKey = toMonthKey(nextMonth);
    setCalendarMonth(nextKey);
    setRange('custom');
    const { startDate, endDate } = monthRange(nextKey);
    if (practiceId) void loadDashboard(practiceId, 'custom', startDate, endDate);
  }

  const selectedTemplate = templates.find((template) => template.id === draft.templateId);
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
          <div className={styles.metricGrid}>
            <MetricCard icon={<Cake />} label="Today" value={dashboard?.metrics.today} />
            <MetricCard icon={<Clock3 />} label="Tomorrow" value={dashboard?.metrics.tomorrow} />
            <MetricCard icon={<Users />} label="Next 7 days" value={dashboard?.metrics.next7Days} />
            <MetricCard icon={<CalendarDays />} label="This month" value={dashboard?.metrics.thisMonth} />
          </div>

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
                    if (item.value === 'calendar' && calendarMonth) {
                      const { startDate, endDate } = monthRange(calendarMonth);
                      setRange('custom');
                      void loadDashboard(practiceId, 'custom', startDate, endDate);
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {(tab === 'overview' || tab === 'calendar') && (
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
            )}
          </div>

          {range === 'custom' && (tab === 'overview' || tab === 'calendar') && (
            <div className={styles.customRange}>
              <label>
                From
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </label>
              <button className={styles.secondaryButton} onClick={refresh} disabled={!customStart || !customEnd}>Apply range</button>
            </div>
          )}

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
                    <span className={styles.timezoneBadge}>Practice time: {dashboard.timezone}</span>
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
                    <div className={styles.headerActions}>
                      <button className={styles.primaryButton} onClick={startCreateCampaign}>
                        <Plus size={16} /> Configure schedule
                      </button>
                      <Link className={styles.secondaryButton} href="/workspace/templates?category=birthdays">
                        Manage birthday templates
                      </Link>
                    </div>
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
                              {' '}{campaign.daysBefore === 0 ? 'On birthday' : `${campaign.daysBefore} days before`} at {campaign.localDeliveryTime}
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
                  </div>
                  <HistoryTable history={dashboard.history} timezone={dashboard.timezone} />
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
                    <ReportCard icon={<Send />} label="Sent" value={dashboard.report.sent ?? 0} />
                    <ReportCard icon={<Clock3 />} label="Pending / processing" value={(dashboard.report.pending ?? 0) + (dashboard.report.processing ?? 0)} />
                    <ReportCard icon={<MessageSquareText />} label="Skipped" value={dashboard.report.skipped ?? 0} />
                    <ReportCard icon={<Mail />} label="Failed" value={dashboard.report.failed ?? 0} />
                  </div>
                  <p className={styles.notice}>Provider delivery receipts are not currently integrated, so a sent message is not a confirmed delivery.</p>
                </>
              )}
            </section>
          )}

          {dashboard && (
            <div className={styles.footerNote}>
              <span>{dashboard.metrics.patientsMissingBirthdate} active patients do not have a birthdate on file and are excluded.</span>
              <Link href="/workspace/templates?category=birthdays">Browse or create birthday templates</Link>
            </div>
          )}
        </>
      )}

      {isEditorOpen && (
        <div className={styles.modalBackdrop}>
          <section ref={editorRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="campaignEditorTitle">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="campaignEditorTitle">{editingCampaignId ? 'Edit birthday campaign' : 'Create birthday campaign'}</h2>
                <p>Schedule messages in the practice timezone: {dashboard?.timezone ?? 'loading'}.</p>
              </div>
              <button className={styles.iconButton} aria-label="Close campaign settings" onClick={() => setIsEditorOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCampaign} className={styles.form}>
              <label className={styles.field}>
                Campaign name
                <input required maxLength={255} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <div className={styles.formRow}>
                <label className={styles.field}>
                  Channel
                  <select
                    value={draft.channel}
                    onChange={(event) => setDraft({ ...draft, channel: event.target.value as Channel, templateId: '' })}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Birthday template
                  <select required value={draft.templateId} onChange={(event) => setDraft({ ...draft, templateId: event.target.value })}>
                    <option value="">Select a published {draft.channel.toUpperCase()} template</option>
                    {filteredTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}{template.isSystem ? ' · system' : ''}</option>
                    ))}
                  </select>
                </label>
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
                  Local delivery time
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
                Selected: {selectedTemplate.name}. <Link href="/workspace/templates?category=birthdays" target="_blank" rel="noreferrer">Clone, customize, or save templates</Link>
                </p>
              )}
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => void handlePreview()} disabled={!draft.templateId}>
                  Preview message
                </button>
                <span className={styles.actionSpacer} />
                <button type="button" className={styles.secondaryButton} onClick={() => setIsEditorOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={saving || !draft.templateId}>
                  {saving ? 'Saving…' : 'Save campaign'}
                </button>
              </div>
            </form>
            {preview && (
              <div className={styles.preview} aria-live="polite">
                <h3>Message preview</h3>
                {preview.subject && <strong>{preview.subject}</strong>}
                <pre>{preview.body}</pre>
                {preview.unresolved.length > 0 && (
                  <p className={styles.previewWarning}>Unresolved variables: {preview.unresolved.join(', ')}</p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value?: number }) {
  return (
    <article className={styles.metricCard}>
      <span className={styles.metricIcon}>{icon}</span>
      <div>
        <span className={styles.metricLabel}>{label}</span>
        <strong className={styles.metricValue}>{value ?? '—'}</strong>
      </div>
    </article>
  );
}

function ReportCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className={styles.reportCard}>
      <span className={styles.metricIcon}>{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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

function HistoryTable({ history, timezone }: { history: BirthdayHistory[]; timezone: string }) {
  if (history.length === 0) {
    return <div className={styles.emptyInline}><Clock3 size={26} /><strong>No birthday delivery history yet</strong></div>;
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
