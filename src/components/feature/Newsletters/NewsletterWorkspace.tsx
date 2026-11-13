'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  Plus,
  Save,
  Send,
  Smartphone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatCard from '@/components/ui/StatCard/StatCard';
import TemplatePickerDialog from '@/components/feature/TemplatePicker/TemplatePickerDialog';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import {
  parseNewsletterDocument,
  renderNewsletterDocument,
  type NewsletterDocument,
} from '@/lib/newsletters/newsletter-content';
import {
  formatPracticeDateTime,
  fromPracticeInstant,
  toPracticeInstant,
} from '@/lib/date-time/practice-timezone';
import styles from './NewsletterWorkspace.module.css';

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  templateType: string;
  channel: string;
  status: string;
  isSystem: boolean;
  content: unknown;
}

interface GroupItem {
  id: string;
  name: string;
  groupType: 'static' | 'dynamic';
  memberCount: number;
}

interface CampaignItem {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  bouncedCount: number;
  failedCount: number;
}

interface PracticeStats {
  campaigns: Record<string, number>;
  recipients: Record<string, number>;
  events: Record<string, number>;
}

interface AudienceOptions {
  groupIds?: string[];
  patientIds?: string[];
  patientStatuses?: string[];
  birthdayMonth?: number;
  appointmentAfter?: string;
  appointmentBefore?: string;
}

interface NewsletterStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
}

interface NewsletterRecipient {
  recipientId: string;
  status: string;
  updatedAt: string;
}

interface NewsletterReportCampaign {
  name: string;
  status: string;
  scheduledAt: string | null;
}

const EMPTY_STATS: NewsletterStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  failed: 0,
  skipped: 0,
  opened: 0,
  clicked: 0,
};

const HISTORY_PAGE_SIZE = 25;

const SAMPLE_VARIABLES = {
  'patient.firstName': 'Jordan',
  'patient.lastName': 'Example',
  'patient.fullName': 'Jordan Example',
  'patient.email': 'jordan@example.test',
  'patient.phone': '(555) 010-2000',
  'practice.name': 'Your Dental Practice',
  'practice.phone': '(555) 010-1000',
  'practice.email': 'hello@example.test',
  'practice.address': '123 Main Street',
  'practice.website': 'https://example.test',
  'campaign.name': 'Practice Newsletter',
};

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export default function NewsletterWorkspace() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState('');
  const [practiceTimezone, setPracticeTimezone] = useState('UTC');
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<PracticeStats>({
    campaigns: {},
    recipients: {},
    events: {},
  });
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportCampaign, setReportCampaign] = useState<NewsletterReportCampaign | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportStats, setReportStats] = useState<NewsletterStats>(EMPTY_STATS);
  const [reportRecipients, setReportRecipients] = useState<NewsletterRecipient[]>([]);
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [content, setContent] = useState<NewsletterDocument | null>(null);
  const [audienceMode, setAudienceMode] = useState<'all' | 'groups' | 'custom'>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [appointmentAfter, setAppointmentAfter] = useState('');
  const [appointmentBefore, setAppointmentBefore] = useState('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<Array<{ firstName: string; lastName: string }>>([]);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState('');
  const editorDialogRef = useRef<HTMLElement | null>(null);
  const previewDialogRef = useRef<HTMLElement | null>(null);
  const reportDialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );
  const loadWorkspace = useCallback(async (pId: string, pageNumber: number) => {
    setLoading(true);
    try {
      const [newsletterResponse, templateResponse, groupResponse, practiceResponse] = await Promise.all([
        fetch(`/api/newsletters?practiceId=${pId}&page=${pageNumber}&limit=${HISTORY_PAGE_SIZE}`),
        fetch(`/api/templates?practiceId=${pId}&type=newsletter&channel=email`),
        fetch(`/api/groups?practiceId=${pId}&page=1&limit=100&includeArchived=false`),
        fetch(`/api/practices/${pId}`),
      ]);
      const [newsletterJson, templateJson, groupJson, practiceJson] = await Promise.all([
        newsletterResponse.json(),
        templateResponse.json(),
        groupResponse.json(),
        practiceResponse.json(),
      ]);
      if (!newsletterResponse.ok) throw new Error(newsletterJson.error || 'Unable to load newsletters');
      if (!templateResponse.ok) throw new Error(templateJson.error || 'Unable to load newsletter templates');
      if (!groupResponse.ok) throw new Error(groupJson.error || 'Unable to load patient groups');
      if (!practiceResponse.ok) throw new Error(practiceJson.error || 'Unable to load practice settings');

      setCampaigns(newsletterJson.data.campaigns ?? []);
      setTotal(newsletterJson.data.total ?? 0);
      setDashboardStats(newsletterJson.data.stats ?? { campaigns: {}, recipients: {}, events: {} });
      setPracticeTimezone(practiceJson.data.timezone ?? 'UTC');

      const category = templateJson.data.categories?.find((item: { slug: string }) => item.slug === 'newsletters');
      const eligibleTemplates = (templateJson.data.templates ?? []).filter((template: TemplateItem) =>
        template.categoryId === category?.id &&
        template.templateType === 'newsletter' &&
        template.channel === 'email' &&
        template.status === 'published'
      );
      setTemplates(eligibleTemplates);
      setGroups(groupJson.data.groups ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load newsletter workspace', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const savedPracticeId = localStorage.getItem('selectedClinicId');
    if (!savedPracticeId) {
      setLoading(false);
      return;
    }
    setPracticeId(savedPracticeId);
    void loadWorkspace(savedPracticeId, 1);
  }, [loadWorkspace]);

  useEffect(() => {
    if (!editorOpen || templateDialogOpen || previewOpen) return;
    return manageDialogFocus(editorDialogRef.current, closeEditor);
  }, [editorOpen, previewOpen, templateDialogOpen]);

  useEffect(() => {
    if (!reportId) return;
    return manageDialogFocus(reportDialogRef.current, () => setReportId(null));
  }, [reportId]);

  useEffect(() => {
    if (!previewOpen) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }

    previewDialogRef.current?.focus();
    function handlePreviewKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !previewDialogRef.current) return;
      const focusable = Array.from(previewDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
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
    document.addEventListener('keydown', handlePreviewKeyDown);
    return () => document.removeEventListener('keydown', handlePreviewKeyDown);
  }, [previewOpen]);

  function getAudienceFilter(): AudienceOptions {
    if (audienceMode === 'all') return {};
    const filter: AudienceOptions = {
      ...(selectedGroupIds.length ? { groupIds: selectedGroupIds } : {}),
    };
    if (audienceMode === 'custom') {
      if (birthdayMonth) filter.birthdayMonth = Number(birthdayMonth);
      const after = localDateTimeToIso(appointmentAfter);
      const before = localDateTimeToIso(appointmentBefore);
      if (after) filter.appointmentAfter = after;
      if (before) filter.appointmentBefore = before;
    }
    return filter;
  }

  async function previewAudience(): Promise<number | null> {
    if (!practiceId) return null;
    try {
      const response = await fetch('/api/audience/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, filter: { ...getAudienceFilter(), consentEmail: true } }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to preview audience');
      setAudienceCount(json.data.count);
      setAudiencePreview((json.data.preview ?? []).map((patient: { firstName: string; lastName: string }) => ({
        firstName: patient.firstName,
        lastName: patient.lastName,
      })));
      return json.data.count as number;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to preview audience', 'error');
      return null;
    }
  }

  function selectTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    setTemplateDialogOpen(false);
    setAudienceCount(null);
    if (!template) return;
    try {
      setContent(parseNewsletterDocument(template.content));
      setName(template.name);
      setEditorError('');
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Selected template is invalid');
    }
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
    );
    setAudienceCount(null);
  }

  async function saveDraft(): Promise<string | null> {
    if (!practiceId) return null;
    if (!editingId && !selectedTemplateId) {
      setEditorError('Select a newsletter template before saving this draft.');
      setTemplateDialogOpen(true);
      return null;
    }
    setBusy(true);
    setEditorError('');
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/newsletters/${editingId}` : '/api/newsletters';
      const payload = {
        practiceId,
        name: name.trim() || selectedTemplate?.name || 'Newsletter',
        audienceFilter: getAudienceFilter(),
        ...(selectedTemplateId ? { sourceTemplateId: selectedTemplateId } : {}),
      };
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to save newsletter draft');
      const id = json.data.campaign?.id ?? json.data.id;
      setEditingId(id);
      showToast('Newsletter draft saved', 'success');
      await loadWorkspace(practiceId, page);
      return id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save newsletter draft';
      setEditorError(message);
      showToast(message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function scheduleNewsletter(sendNow: boolean) {
    let id = editingId;
    if (!id) id = await saveDraft();
    else {
      const savedId = await saveDraft();
      if (!savedId) return;
      id = savedId;
    }
    if (!id) return;

    const count = await previewAudience();
    if (count === null || count === 0) {
      showToast('No eligible, email-consenting patients are in this audience', 'error');
      return;
    }
    if (!sendNow && !scheduleAt) {
      setEditorError('Choose a date and time before scheduling.');
      return;
    }
    const scheduleSummary = sendNow
      ? `Queue this newsletter for ${count} eligible email recipient${count === 1 ? '' : 's'}?`
      : `Schedule this newsletter for ${formatPracticeDateTime(scheduleAt, practiceTimezone)} to ${count} eligible email recipient${count === 1 ? '' : 's'}?`;
    if (!window.confirm(scheduleSummary)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/newsletters/${id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          sendNow,
          ...(!sendNow ? { scheduledAt: toPracticeInstant(scheduleAt, practiceTimezone) } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to schedule newsletter');
      showToast(sendNow ? 'Newsletter queued for sending' : 'Newsletter scheduled', 'success');
      closeEditor();
      await loadWorkspace(practiceId, page);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to schedule newsletter';
      setEditorError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openDraft(campaignId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/newsletters/${campaignId}?practiceId=${practiceId}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load newsletter');
      const { campaign } = json.data;
      setEditingId(campaignId);
      setEditorOpen(true);
      setName(campaign.name);
      const savedContent = parseNewsletterDocument(json.data.content);
      const matchingTemplate = templates.find((template) => {
        try {
          return JSON.stringify(parseNewsletterDocument(template.content)) === JSON.stringify(savedContent);
        } catch {
          return false;
        }
      });
      setSelectedTemplateId(matchingTemplate?.id ?? '');
      setContent(savedContent);
      setAudienceMode(campaign.audienceFilter?.groupIds?.length ? 'groups' : 'all');
      setSelectedGroupIds(campaign.audienceFilter?.groupIds ?? []);
      setBirthdayMonth(campaign.audienceFilter?.birthdayMonth?.toString() ?? '');
      setAppointmentAfter(toLocalDateTime(campaign.audienceFilter?.appointmentAfter ?? null));
      setAppointmentBefore(toLocalDateTime(campaign.audienceFilter?.appointmentBefore ?? null));
      setScheduleAt(campaign.scheduledAt ? fromPracticeInstant(campaign.scheduledAt, practiceTimezone) : '');
      setAudienceCount(null);
      setReportId(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load newsletter', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openReport(campaignId: string) {
    setReportId(campaignId);
    setReportCampaign(null);
    setReportStats(EMPTY_STATS);
    setReportRecipients([]);
    setReportLoading(true);
    try {
      const [detailResponse, recipientsResponse] = await Promise.all([
        fetch(`/api/newsletters/${campaignId}?practiceId=${practiceId}`),
        fetch(`/api/campaigns/${campaignId}/recipients?practiceId=${practiceId}&limit=50`),
      ]);
      const [detailJson, recipientsJson] = await Promise.all([detailResponse.json(), recipientsResponse.json()]);
      if (!detailResponse.ok) throw new Error(detailJson.error || 'Unable to load newsletter report');
      if (!recipientsResponse.ok) throw new Error(recipientsJson.error || 'Unable to load recipient history');
      setReportCampaign(detailJson.data.campaign);
      setReportStats(detailJson.data.stats ?? EMPTY_STATS);
      setReportRecipients(recipientsJson.data ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load newsletter report', 'error');
      setReportId(null);
    } finally {
      setReportLoading(false);
    }
  }

  async function cancelScheduled(campaignId: string) {
    if (!window.confirm('Cancel this scheduled newsletter?')) return;
    try {
      const response = await fetch(`/api/newsletters/${campaignId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to cancel newsletter');
      showToast('Scheduled newsletter cancelled', 'success');
      await loadWorkspace(practiceId, page);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to cancel newsletter', 'error');
    }
  }

  async function deleteNewsletter(campaignId: string, status: string) {
    const description = status === 'cancelled' ? 'cancelled newsletter' : 'newsletter draft';
    if (!window.confirm(`Delete this ${description}?`)) return;
    try {
      const response = await fetch(`/api/newsletters/${campaignId}?practiceId=${practiceId}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to delete newsletter');
      const nextTotal = Math.max(0, total - Number(campaigns.some((campaign) => campaign.id === campaignId)));
      const nextPage = page > 1 && (page - 1) * HISTORY_PAGE_SIZE >= nextTotal ? page - 1 : page;
      setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId));
      setTotal(nextTotal);
      if (nextPage !== page) setPage(nextPage);
      showToast('Newsletter deleted', 'success');
      await loadWorkspace(practiceId, nextPage);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete newsletter', 'error');
    }
  }

  function startNewNewsletter() {
    setEditingId(null);
    setEditorOpen(true);
    setTemplateDialogOpen(false);
    setReportId(null);
    setName('');
    setSelectedTemplateId('');
    setContent(null);
    setAudienceMode('all');
    setSelectedGroupIds([]);
    setBirthdayMonth('');
    setAppointmentAfter('');
    setAppointmentBefore('');
    setScheduleAt('');
    setAudienceCount(null);
    setEditorError('');
    setPreviewOpen(false);
  }

  function closeEditor() {
    setEditingId(null);
    setEditorOpen(false);
    setTemplateDialogOpen(false);
    setEditorError('');
    setPreviewOpen(false);
  }

  function openPreview() {
    if (!content) {
      setEditorError('Select a newsletter template to preview.');
      setTemplateDialogOpen(true);
      return;
    }
    try {
      renderNewsletterDocument(content, SAMPLE_VARIABLES);
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPreviewOpen(true);
      setEditorError('');
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Newsletter content is invalid');
    }
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    void saveDraft();
  }

  const renderedPreview = useMemo(() => {
    if (!content) return null;
    try {
      return renderNewsletterDocument(content, SAMPLE_VARIABLES);
    } catch {
      return null;
    }
  }, [content]);

  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  return (
    <main className={styles.workspace}>
      <PageHeader
        title="Newsletters"
        description="Create branded newsletters, choose an eligible patient audience, and track campaign activity."
        actions={!editorOpen && (
          <button type="button" className={styles.primaryButton} onClick={startNewNewsletter} disabled={!practiceId || loading}>
            <Plus size={18} /> New newsletter
          </button>
        )}
      />

      {loading ? (
        <div className={styles.stateCard} role="status">Loading newsletters and templates…</div>
      ) : !practiceId ? (
        <div className={styles.stateCard}>Select a practice to manage newsletters.</div>
      ) : editorOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
        <section
          ref={editorDialogRef}
          className={styles.editorModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="newsletter-editor-title"
          tabIndex={-1}
        >
          <div className={styles.editorHeader}>
            <div>
              <button type="button" className={styles.backButton} onClick={closeEditor}><ChevronLeft size={16} /> Back to newsletters</button>
              <h2 id="newsletter-editor-title">{editingId ? 'Edit newsletter draft' : 'Create newsletter'}</h2>
            </div>
            <button type="button" className={styles.iconButton} aria-label="Close editor" onClick={closeEditor}><X size={18} /></button>
          </div>

          <form onSubmit={handleSave} className={styles.editorForm}>
            <section className={styles.formSection}>
              <h3>Newsletter details</h3>
              <label className={styles.field}>
                <span>Newsletter name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required />
              </label>
              <div className={styles.templatePicker}>
                <div>
                  <strong>{selectedTemplate?.name ?? (editingId ? 'Saved newsletter content' : 'No template selected')}</strong>
                  <span>{selectedTemplate ? `${selectedTemplate.isSystem ? 'System template' : 'Practice template'} · ${selectedTemplate.status}` : 'Choose a published email template from the Templates library.'}</span>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={() => setTemplateDialogOpen(true)}>
                  Choose template
                </button>
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Audience</h3>
              <div className={styles.radioGroup}>
                <label><input type="radio" name="audienceMode" checked={audienceMode === 'all'} onChange={() => { setAudienceMode('all'); setSelectedGroupIds([]); setAudienceCount(null); }} /> All eligible patients</label>
                <label><input type="radio" name="audienceMode" checked={audienceMode === 'groups'} onChange={() => { setAudienceMode('groups'); setAudienceCount(null); }} /> Selected patient groups</label>
                <label><input type="radio" name="audienceMode" checked={audienceMode === 'custom'} onChange={() => { setAudienceMode('custom'); setAudienceCount(null); }} /> Custom filters</label>
              </div>
              {audienceMode !== 'all' && (
                <fieldset className={styles.groupPicker}>
                  <legend>Include groups (optional)</legend>
                  {!groups.length ? <p>No active groups are available.</p> : groups.map((group) => (
                    <label key={group.id}>
                      <input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                      <span>{group.name}</span>
                      <small>{group.groupType === 'dynamic' ? 'Dynamic' : 'Static'} · {group.memberCount} patients</small>
                    </label>
                  ))}
                </fieldset>
              )}
              {audienceMode === 'custom' && (
                <div className={styles.filterGrid}>
                  <label className={styles.field}>
                    <span>Birth month</span>
                    <select value={birthdayMonth} onChange={(event) => { setBirthdayMonth(event.target.value); setAudienceCount(null); }}>
                      <option value="">Any month</option>
                      {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString('en', { month: 'long' })}</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Appointment after</span>
                    <input type="datetime-local" value={appointmentAfter} onChange={(event) => { setAppointmentAfter(event.target.value); setAudienceCount(null); }} />
                  </label>
                  <label className={styles.field}>
                    <span>Appointment before</span>
                    <input type="datetime-local" value={appointmentBefore} onChange={(event) => { setAppointmentBefore(event.target.value); setAudienceCount(null); }} />
                  </label>
                </div>
              )}
              <div className={styles.audienceSummary}>
                <button type="button" className={styles.secondaryButton} onClick={() => void previewAudience()}>
                  <Users size={16} /> Preview eligible audience
                </button>
                {audienceCount !== null && <strong>{audienceCount.toLocaleString()} eligible email recipients</strong>}
              </div>
              {audienceCount !== null && audienceCount > 0 && (
                <p className={styles.previewNames}>
                  Sample: {audiencePreview.slice(0, 5).map((patient) => `${patient.firstName} ${patient.lastName}`).join(', ')}
                </p>
              )}
            </section>

            <label className={styles.field}>
              <span>
                Schedule date and time ({practiceTimezone}) <small>Optional</small>
              </span>
              <input
                type="datetime-local"
                value={scheduleAt}
                min={fromPracticeInstant(new Date(Date.now() + 60000).toISOString(), practiceTimezone)}
                onChange={(event) => setScheduleAt(event.target.value)}
                aria-label={`Schedule date and time (${practiceTimezone})`}
              />
            </label>

            {editorError && <p className={styles.errorMessage} role="alert">{editorError}</p>}

            <div className={styles.editorActions}>
              <button type="button" className={styles.secondaryButton} onClick={openPreview}><Eye size={16} /> Preview</button>
              <button type="button" className={styles.secondaryButton} disabled={busy || (!editingId && !selectedTemplateId)} onClick={() => void saveDraft()}><Save size={16} /> Save draft</button>
              <button type="button" className={styles.secondaryButton} disabled={busy || (!editingId && !selectedTemplateId)} onClick={() => void scheduleNewsletter(false)}>Schedule</button>
              <button type="button" className={styles.primaryButton} disabled={busy || (!editingId && !selectedTemplateId)} onClick={() => void scheduleNewsletter(true)}><Send size={16} /> Send now</button>
            </div>
          </form>

          {previewOpen && renderedPreview && (
            <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
              <section
                ref={previewDialogRef}
                className={styles.previewModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="preview-title"
                tabIndex={-1}
              >
                <header className={styles.previewHeader}>
                  <div><h2 id="preview-title">Newsletter preview</h2><p>{renderedPreview.subject}</p></div>
                  <div className={styles.previewControls}>
                    <button type="button" className={previewMode === 'desktop' ? styles.activePreview : ''} onClick={() => setPreviewMode('desktop')}><Eye size={15} /> Desktop</button>
                    <button type="button" className={previewMode === 'mobile' ? styles.activePreview : ''} onClick={() => setPreviewMode('mobile')}><Smartphone size={15} /> Mobile</button>
                    <button type="button" className={styles.iconButton} aria-label="Close preview" onClick={() => setPreviewOpen(false)}><X size={18} /></button>
                  </div>
                </header>
                <iframe
                  className={`${styles.previewFrame} ${previewMode === 'mobile' ? styles.mobilePreview : ''}`}
                  title={`${previewMode} newsletter preview`}
                  sandbox=""
                  srcDoc={renderedPreview.html}
                />
              </section>
            </div>
          )}
        </section>
        </div>
      ) : (
        <>
          <section className={styles.statsGrid} aria-label="Newsletter statistics">
            <StatCard icon={<Mail size={20} aria-hidden="true" />} label="Newsletters" value={Object.values(dashboardStats.campaigns).reduce((sum, value) => sum + value, 0).toLocaleString()} />
            <StatCard icon={<Save size={20} aria-hidden="true" />} label="Drafts" value={(dashboardStats.campaigns.draft ?? 0).toLocaleString()} />
            <StatCard icon={<CalendarClock size={20} aria-hidden="true" />} label="Scheduled" value={(dashboardStats.campaigns.scheduled ?? 0).toLocaleString()} />
            <StatCard icon={<Send size={20} aria-hidden="true" />} label="Sent / accepted" value={(dashboardStats.events.sent ?? 0).toLocaleString()} />
            <StatCard icon={<Mail size={20} aria-hidden="true" />} label="Delivered" value={(dashboardStats.events.delivered ?? 0).toLocaleString()} />
          </section>
          <section className={styles.historyCard}>
            <div className={styles.historyHeader}>
              <div><h2>Newsletter history</h2><p>Drafts, scheduled campaigns, and provider activity.</p></div>
              <span>{total} newsletter{total === 1 ? '' : 's'}</span>
            </div>
            {!campaigns.length ? (
              <div className={styles.emptyState}>
                <Mail size={38} />
                <h3>No newsletters yet</h3>
                <p>Select a template, choose an audience, and create your first draft.</p>
                <button type="button" className={styles.primaryButton} onClick={startNewNewsletter}><Plus size={16} /> Create newsletter</button>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Newsletter</th><th>Status</th><th>Recipients</th><th>Sent / accepted</th><th>Delivered</th><th>Schedule / created</th><th>Actions</th></tr></thead>
                  <tbody>{campaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td><strong>{campaign.name}</strong></td>
                      <td><span className={`${styles.statusBadge} ${styles[`status_${campaign.status}`] ?? ''}`}>{campaign.status.replace('_', ' ')}</span></td>
                      <td>{campaign.totalRecipients}</td>
                      <td>{campaign.sentCount}</td>
                      <td>{campaign.deliveredCount}</td>
                      <td>{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : new Date(campaign.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.rowActions}>
                          {campaign.status === 'draft' && <button type="button" onClick={() => void openDraft(campaign.id)}>Edit</button>}
                          {['draft', 'cancelled'].includes(campaign.status) && <button type="button" onClick={() => void deleteNewsletter(campaign.id, campaign.status)} aria-label={`Delete ${campaign.name}`}><Trash2 size={15} /></button>}
                          {campaign.status === 'scheduled' && <button type="button" onClick={() => void cancelScheduled(campaign.id)}>Cancel</button>}
                          <button type="button" onClick={() => void openReport(campaign.id)}>Report</button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {pageCount > 1 && (
              <div className={styles.pagination}>
                <button type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); void loadWorkspace(practiceId, next); }}><ChevronLeft size={16} /> Previous</button>
                <span>Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => { const next = page + 1; setPage(next); void loadWorkspace(practiceId, next); }}>Next <ChevronRight size={16} /></button>
              </div>
            )}
          </section>
        </>
      )}
      {reportId && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setReportId(null);
        }}>
          <section ref={reportDialogRef} className={styles.reportModal} role="dialog" aria-modal="true" aria-labelledby="newsletter-report-title" tabIndex={-1}>
            <header className={styles.editorHeader}>
              <div>
                <p className={styles.reportEyebrow}>Newsletter report</p>
                <h2 id="newsletter-report-title">{reportCampaign?.name ?? 'Loading report'}</h2>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setReportId(null)} aria-label="Close report"><X size={18} /></button>
            </header>
            {reportLoading || !reportCampaign ? (
              <p className={styles.reportLoading} role="status">Loading newsletter report…</p>
            ) : (
              <>
                <p className={styles.reportStatus}>Status: {reportCampaign.status.replace('_', ' ')}{reportCampaign.scheduledAt ? ` · Scheduled ${new Date(reportCampaign.scheduledAt).toLocaleString()}` : ''}</p>
                <div className={styles.reportStats} role="group" aria-label="Newsletter report metrics">
                  <StatCard icon={<Users size={20} aria-hidden="true" />} label="Recipients" value={reportStats.total.toLocaleString()} />
                  <StatCard icon={<Send size={20} aria-hidden="true" />} label="Sent / accepted" value={reportStats.sent.toLocaleString()} />
                  <StatCard icon={<Mail size={20} aria-hidden="true" />} label="Delivered" value={reportStats.delivered.toLocaleString()} />
                  <StatCard icon={<X size={20} aria-hidden="true" />} label="Bounced" value={reportStats.bounced.toLocaleString()} />
                  <StatCard icon={<X size={20} aria-hidden="true" />} label="Failed" value={reportStats.failed.toLocaleString()} />
                  <StatCard icon={<ChevronRight size={20} aria-hidden="true" />} label="Skipped" value={reportStats.skipped.toLocaleString()} />
                  <StatCard icon={<Eye size={20} aria-hidden="true" />} label="Opens" value={reportStats.opened.toLocaleString()} />
                  <StatCard icon={<Smartphone size={20} aria-hidden="true" />} label="Clicks" value={reportStats.clicked.toLocaleString()} />
                </div>
                <p className={styles.disclaimer}>“Sent / accepted” means accepted by the configured provider, not confirmed delivered. Opens and clicks appear only when provider events are configured.</p>
                <h3>Recipient activity</h3>
                {!reportRecipients.length ? <p>No recipient activity is available yet.</p> : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Recipient reference</th><th>Status</th><th>Last updated</th></tr></thead>
                      <tbody>{reportRecipients.map((recipient) => (
                        <tr key={recipient.recipientId}>
                          <td>{recipient.recipientId}</td>
                          <td><span className={styles.statusBadge}>{recipient.status}</span></td>
                          <td>{new Date(recipient.updatedAt).toLocaleString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      <TemplatePickerDialog
        open={templateDialogOpen}
        title="Newsletter templates"
        description="Select a published email template from the centralized Newsletters library."
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onClose={() => setTemplateDialogOpen(false)}
        onSelect={(template) => selectTemplate(template.id)}
        libraryHref="/workspace/templates?category=newsletters"
        emptyMessage="No published email newsletter templates are available. Add one in the"
      />
    </main>
  );
}

function manageDialogFocus(dialog: HTMLElement | null, onEscape: () => void) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
  if (focusable.length) focusable[0].focus();
  else dialog?.focus();

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
