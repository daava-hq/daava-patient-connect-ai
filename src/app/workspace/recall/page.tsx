'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { CalendarClock, Eye, Mail, Pencil, Plus, RefreshCcw, Send, Trash2, Users, X } from 'lucide-react';
import DataTable from '@/components/ui/DataTable/DataTable';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import GroupAudienceSelector, { type GroupOption } from '@/components/feature/GroupAudienceSelector/GroupAudienceSelector';
import TemplatePickerDialog from '@/components/feature/TemplatePicker/TemplatePickerDialog';
import EmailMessagePreview from '@/components/feature/EmailMessagePreview/EmailMessagePreview';
import { parseNewsletterDocument, renderNewsletterDocument } from '@/lib/newsletters/newsletter-content';
import { extractTemplateBody } from '@/lib/templates/document-schema';
import { fromPracticeInstant, toPracticeInstant } from '@/lib/date-time/practice-timezone';
import styles from './RecallPage.module.css';

interface RecallCampaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  deliveredCount: number;
  totalRecipients: number;
  createdAt: string;
}

interface RecallCampaignDetails {
  id: string;
  name: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  type: string;
  sourceTemplateId?: string | null;
  audienceFilter: { groupIds?: string[] };
}

interface RecallTemplate {
  id: string;
  name: string;
  channel: string;
  templateType: string;
  status: string;
  isSystem: boolean;
  description?: string | null;
  categoryId: string;
  content: unknown;
}

interface RecallRecipient {
  recipientId: string;
  status: string;
  updatedAt: string;
}

interface RecallStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
}

interface RecallReport extends Pick<RecallCampaign, 'id' | 'name' | 'status' | 'scheduledAt'> {
  stats: RecallStats;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

const EMPTY_STATS: RecallStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  bounced: 0,
  failed: 0,
  skipped: 0,
};

const PREVIEW_VARIABLES: Record<string, string> = {
  'patient.firstName': 'Alex',
  'patient.lastName': 'Morgan',
  'practice.name': 'Your dental practice',
  'practice.phone': '(555) 010-1234',
  'practice.website': 'https://example.test',
  'recall.dueDate': 'June 15, 2026',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renderSmsPreview(content: unknown): string {
  const body = isRecord(content) ? extractTemplateBody(content) : '';
  return body.replace(/\{\{([\w.]+)\}\}/g, (placeholder, key: string) =>
    PREVIEW_VARIABLES[key] ?? placeholder
  );
}

function formatCampaignInstant(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

function getStatusVariant(status: string): StatusVariant {
  switch (status) {
    case 'completed':
      return 'success';
    case 'scheduled':
    case 'processing':
      return 'info';
    case 'partially_failed':
      return 'warning';
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
}

export default function RecallPage() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<RecallCampaign[]>([]);
  const [campaignsPracticeId, setCampaignsPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [practiceError, setPracticeError] = useState('');
  const [optionsReloadVersion, setOptionsReloadVersion] = useState(0);
  const [templates, setTemplates] = useState<RecallTemplate[]>([]);
  const [recallCategoryId, setRecallCategoryId] = useState('');
  const [practiceTimezone, setPracticeTimezone] = useState('UTC');
  const [practiceTimezoneLoaded, setPracticeTimezoneLoaded] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email' | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<Array<{ firstName: string; lastName: string }>>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [reportCampaign, setReportCampaign] = useState<RecallReport | null>(null);
  const [reportRecipients, setReportRecipients] = useState<RecallRecipient[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const reportRequestId = useRef(0);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [groupsReloadVersion, setGroupsReloadVersion] = useState(0);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const campaignNameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reportDialogRef = useRef<HTMLElement>(null);
  const reportCloseButtonRef = useRef<HTMLButtonElement>(null);
  const wasModalOpen = useRef(false);

  const availableTemplates = templates.filter((template) =>
    template.categoryId === recallCategoryId &&
    template.channel === channel &&
    template.status === 'published' &&
    (channel === 'sms' ? template.templateType === 'sms' : ['email', 'newsletter'].includes(template.templateType))
  );
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const reportOpen = reportLoading || !!reportCampaign;
  const templatePreview = useMemo(() => {
    if (!selectedTemplate || selectedTemplate.channel !== channel) return null;
    try {
      if (channel === 'email') {
        const document = parseNewsletterDocument(selectedTemplate.content);
        return { channel: 'email' as const, ...renderNewsletterDocument(document, PREVIEW_VARIABLES) };
      }
      if (channel === 'sms') {
        return { channel: 'sms' as const, body: renderSmsPreview(selectedTemplate.content) };
      }
      return null;
    } catch (error) {
      return {
        channel: 'error' as const,
        message: error instanceof Error ? error.message : 'Template preview is unavailable',
      };
    }
  }, [channel, selectedTemplate]);

  const fetchRecall = useCallback(async (selectedPracticeId: string, signal: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    try {
      const searchParams = new URLSearchParams({
        practiceId: selectedPracticeId,
        type: 'recall',
      });
      const response = await fetch(`/api/campaigns?${searchParams.toString()}`, { signal });
      const body = await response.json() as ApiResponse<{ campaigns?: RecallCampaign[] }>;
      if (!response.ok) throw new Error(body.error || 'Failed to load recall campaigns');
      if (!Array.isArray(body.data?.campaigns)) throw new Error('Recall campaign data is unavailable.');
      if (signal.aborted) return;
      setCampaigns(body.data.campaigns);
      setCampaignsPracticeId(selectedPracticeId);
    } catch (error) {
      if (signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Failed to load recall campaigns');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncPractice = () => setPracticeId(localStorage.getItem('selectedClinicId') || '');
    syncPractice();
    window.addEventListener('practiceChanged', syncPractice);
    window.addEventListener('storage', syncPractice);
    return () => {
      window.removeEventListener('practiceChanged', syncPractice);
      window.removeEventListener('storage', syncPractice);
    };
  }, []);

  useEffect(() => {
    if (practiceId === null) return;
    if (!practiceId) {
      setCampaigns([]);
      setCampaignsPracticeId('');
      setLoadError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    void fetchRecall(practiceId, controller.signal);
    return () => controller.abort();
  }, [fetchRecall, practiceId, reloadVersion]);

  useEffect(() => {
    if (!practiceId) {
      setTemplates([]);
      setRecallCategoryId('');
      setTemplateError('');
      setPracticeError('');
      setPracticeTimezone('UTC');
      setPracticeTimezoneLoaded(false);
      return;
    }

    const selectedPracticeId = practiceId;
    const controller = new AbortController();
    setTemplateError('');
    setPracticeError('');
    setPracticeTimezone('UTC');
    setPracticeTimezoneLoaded(false);
    setTemplates([]);
    setRecallCategoryId('');

    async function loadTemplateOptions() {
      try {
        const response = await fetch(`/api/templates?practiceId=${encodeURIComponent(selectedPracticeId)}`, {
          signal: controller.signal,
        });
        const body = await response.json() as ApiResponse<{
          categories?: Array<{ id: string; slug: string }>;
          templates?: RecallTemplate[];
        }>;
        if (!response.ok) throw new Error(body.error || 'Unable to load Recall templates');
        if (controller.signal.aborted) return;
        const categoryId = body.data?.categories?.find((category) => category.slug === 'recall')?.id ?? '';
        setRecallCategoryId(categoryId);
        setTemplates((body.data?.templates ?? []).filter((template) =>
          template.categoryId === categoryId && template.status === 'published'
        ));
      } catch (error) {
        if (controller.signal.aborted) return;
        setTemplateError(error instanceof Error ? error.message : 'Unable to load Recall templates');
      }
    }

    async function loadPracticeTimezone() {
      try {
        const response = await fetch(`/api/practices/${encodeURIComponent(selectedPracticeId)}`, {
          signal: controller.signal,
        });
        const body = await response.json() as ApiResponse<{ timezone?: string }>;
        if (!response.ok) throw new Error(body.error || 'Unable to load practice timezone');
        if (!controller.signal.aborted) {
          setPracticeTimezone(body.data?.timezone || 'UTC');
          setPracticeTimezoneLoaded(true);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setPracticeError(error instanceof Error ? error.message : 'Unable to load practice timezone');
      }
    }

    void Promise.all([loadTemplateOptions(), loadPracticeTimezone()]);
    return () => controller.abort();
  }, [optionsReloadVersion, practiceId]);

  useEffect(() => {
    if (isModalOpen) {
      wasModalOpen.current = true;
      campaignNameRef.current?.focus();
    } else if (wasModalOpen.current) {
      wasModalOpen.current = false;
      createButtonRef.current?.focus();
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || !practiceId) return;

    const selectedPracticeId = practiceId;
    const controller = new AbortController();
    setGroupsLoading(true);
    setGroupsError('');
    setGroups([]);

    async function fetchGroups() {
      try {
        const searchParams = new URLSearchParams({ practiceId: selectedPracticeId });
        const response = await fetch(`/api/groups/recall-options?${searchParams.toString()}`, { signal: controller.signal });
        const body = await response.json() as ApiResponse<GroupOption[]>;
        if (!response.ok) throw new Error(body.error || 'Failed to load patient groups');
        if (!Array.isArray(body.data)) throw new Error('Patient group data is unavailable.');
        if (controller.signal.aborted) return;
        setGroups(body.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setGroupsError(error instanceof Error ? error.message : 'Failed to load patient groups');
      } finally {
        if (!controller.signal.aborted) setGroupsLoading(false);
      }
    }

    void fetchGroups();
    return () => controller.abort();
  }, [groupsReloadVersion, isModalOpen, practiceId]);

  useEffect(() => {
    if (!reportOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    reportCloseButtonRef.current?.focus();
    function handleReportKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        reportRequestId.current += 1;
        setReportCampaign(null);
        setReportLoading(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = reportDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], iframe, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
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

    document.addEventListener('keydown', handleReportKeyDown);
    return () => {
      document.removeEventListener('keydown', handleReportKeyDown);
      previousFocus?.focus();
    };
  }, [reportOpen]);

  function startCreate() {
    setEditingCampaignId(null);
    setName('');
    setChannel('');
    setSelectedTemplateId('');
    setSelectedGroupIds([]);
    setScheduleAt('');
    setAudienceCount(null);
    setAudiencePreview([]);
    setIsModalOpen(true);
  }

  function closeDialog() {
    setIsModalOpen(false);
    setTemplatePickerOpen(false);
    setEditingCampaignId(null);
  }

  async function handleEdit(campaignId: string) {
    if (!practiceId || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const searchParams = new URLSearchParams({ practiceId });
      const response = await fetch(`/api/campaigns/${campaignId}?${searchParams.toString()}`);
      const body = await response.json() as ApiResponse<RecallCampaignDetails>;
      if (!response.ok) throw new Error(body.error || 'Failed to load recall campaign');
      if (!body.data || body.data.type !== 'recall' || body.data.status !== 'draft') {
        throw new Error('Only Recall campaign drafts can be edited.');
      }
      if (body.data.channel !== 'sms' && body.data.channel !== 'email') {
        throw new Error('Recall campaign has an unsupported channel.');
      }

      setEditingCampaignId(campaignId);
      setName(body.data.name);
      setChannel(body.data.channel);
      setSelectedTemplateId(body.data.sourceTemplateId ?? '');
      setSelectedGroupIds(body.data.audienceFilter?.groupIds ?? []);
      setScheduleAt(body.data.scheduledAt ? fromPracticeInstant(body.data.scheduledAt, practiceTimezone) : '');
      setAudienceCount(null);
      setAudiencePreview([]);
      setIsModalOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load recall campaign', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function previewAudience(): Promise<number | null> {
    if (!practiceId || isSubmitting) return null;
    if (channel !== 'sms' && channel !== 'email') {
      showToast('Choose a campaign channel before previewing the audience.', 'error');
      return null;
    }
    if (!selectedGroupIds.length) {
      showToast('Select a dynamic group with the due Open Dental recall rule.', 'error');
      return null;
    }
    setAudienceLoading(true);

    try {
      const response = await fetch('/api/audience/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          type: 'recall',
          channel,
          filter: { groupIds: selectedGroupIds },
        }),
      });
      const body = await response.json() as ApiResponse<{
        count: number;
        preview: Array<{ firstName: string; lastName: string }>;
      }>;
      if (!response.ok) throw new Error(body.error || 'Unable to preview Recall audience');
      if (typeof body.data?.count !== 'number' || !Array.isArray(body.data.preview)) {
        throw new Error('Recall audience preview data is unavailable.');
      }
      setAudienceCount(body.data.count);
      setAudiencePreview(body.data.preview);
      return body.data.count;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to preview Recall audience', 'error');
      return null;
    } finally {
      setAudienceLoading(false);
    }
  }

  async function saveCampaign(mode: 'draft' | 'schedule' | 'sendNow' = 'draft') {
    if (!practiceId || isSubmitting) return;
    if (channel !== 'sms' && channel !== 'email') {
      showToast('Choose a campaign channel.', 'error');
      return;
    }
    if (!name.trim() || !selectedTemplateId || !selectedGroupIds.length) {
      showToast('Enter a campaign name, select a Recall template, and choose a due-recall group.', 'error');
      return;
    }

    setIsSubmitting(true);
    const isEditing = !!editingCampaignId;
    let savedCampaignId = editingCampaignId;
    try {
      let scheduledAt: string | undefined;
      if (mode === 'schedule') {
        if (practiceError || !practiceTimezoneLoaded) {
          showToast(practiceError || 'Practice timezone is still loading.', 'error');
          return;
        }
        try {
          scheduledAt = toPracticeInstant(scheduleAt, practiceTimezone);
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Choose a valid schedule date and time.', 'error');
          return;
        }
        if (!scheduledAt) {
          showToast('Choose a valid schedule date and time.', 'error');
          return;
        }
      }

      if (mode !== 'draft') {
        const count = await previewAudience();
        if (count === null || count === 0) {
          if (count === 0) showToast('No eligible patients match this due-recall audience.', 'error');
          return;
        }
        const confirmation = mode === 'sendNow'
          ? `Queue this Recall campaign for ${count} eligible ${channel === 'sms' ? 'text' : 'email'} recipient${count === 1 ? '' : 's'}?`
          : `Schedule this Recall campaign for ${formatCampaignInstant(scheduledAt ?? '', practiceTimezone)} to ${count} eligible recipient${count === 1 ? '' : 's'}?`;
        if (!window.confirm(confirmation)) return;
      }

      const saveResponse = await fetch(
        isEditing ? `/api/campaigns/${editingCampaignId}` : '/api/campaigns',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            practiceId,
            name,
            ...(isEditing ? {} : { type: 'recall' }),
            channel,
            sourceTemplateId: selectedTemplateId,
            audienceFilter: {
              groupIds: selectedGroupIds,
              ...(channel === 'sms' ? { consentSms: true } : { consentEmail: true }),
            },
          }),
        },
      );
      const saveBody = await saveResponse.json() as ApiResponse<{ id?: string }>;
      if (!saveResponse.ok) throw new Error(saveBody.error || `Failed to ${isEditing ? 'update' : 'create'} Recall campaign`);
      savedCampaignId = saveBody.data?.id ?? savedCampaignId;
      if (!savedCampaignId) throw new Error('Saved Recall campaign ID is missing.');

      if (mode !== 'draft') {
        const scheduleResponse = await fetch(`/api/campaigns/${savedCampaignId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            practiceId,
            sendNow: mode === 'sendNow',
            ...(mode === 'schedule' ? { scheduledAt } : {}),
          }),
        });
        const scheduleBody = await scheduleResponse.json() as ApiResponse<unknown>;
        if (!scheduleResponse.ok) {
          setEditingCampaignId(savedCampaignId);
          setReloadVersion((version) => version + 1);
          showToast(`Draft saved, but scheduling failed: ${scheduleBody.error || 'Unable to schedule Recall campaign'}`, 'error');
          return;
        }
      }

      showToast(mode === 'draft'
        ? `Recall campaign ${isEditing ? 'updated' : 'created'} successfully`
        : mode === 'sendNow' ? 'Recall campaign queued for dispatch' : 'Recall campaign scheduled', 'success');
      closeDialog();
      setReloadVersion((version) => version + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Failed to ${isEditing ? 'update' : 'create'} Recall campaign`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveCampaign('draft');
  }

  async function openReport(campaignId: string) {
    if (!practiceId || reportLoading) return;
    const requestId = ++reportRequestId.current;
    setReportLoading(true);
    setReportCampaign(null);
    setReportRecipients([]);
    try {
      const [detailResponse, recipientsResponse] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}?practiceId=${encodeURIComponent(practiceId)}`),
        fetch(`/api/campaigns/${campaignId}/recipients?practiceId=${encodeURIComponent(practiceId)}&limit=50`),
      ]);
      const [detailBody, recipientsBody] = await Promise.all([
        detailResponse.json() as Promise<ApiResponse<Pick<RecallCampaign, 'id' | 'name' | 'status' | 'scheduledAt'> & { stats?: RecallStats }>>,
        recipientsResponse.json() as Promise<ApiResponse<RecallRecipient[]>>,
      ]);
      if (!detailResponse.ok) throw new Error(detailBody.error || 'Unable to load Recall report');
      if (!recipientsResponse.ok) throw new Error(recipientsBody.error || 'Unable to load recipient activity');
      if (!detailBody.data || !Array.isArray(recipientsBody.data)) throw new Error('Recall report data is unavailable.');
      if (requestId !== reportRequestId.current) return;
      setReportCampaign({ ...detailBody.data, stats: detailBody.data.stats ?? EMPTY_STATS });
      setReportRecipients(recipientsBody.data);
    } catch (error) {
      if (requestId !== reportRequestId.current) return;
      showToast(error instanceof Error ? error.message : 'Unable to load Recall report', 'error');
    } finally {
      if (requestId === reportRequestId.current) setReportLoading(false);
    }
  }

  function closeReport() {
    reportRequestId.current += 1;
    setReportCampaign(null);
    setReportLoading(false);
  }

  async function cancelScheduled(campaignId: string) {
    if (!practiceId || !window.confirm('Cancel this scheduled Recall campaign?')) return;
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const body = await response.json() as ApiResponse<unknown>;
      if (!response.ok) throw new Error(body.error || 'Unable to cancel Recall campaign');
      showToast('Recall campaign cancelled', 'success');
      setReloadVersion((version) => version + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to cancel Recall campaign', 'error');
    }
  }

  async function deleteDraft(campaignId: string) {
    if (!practiceId || !window.confirm('Delete this Recall campaign draft?')) return;
    try {
      const response = await fetch(`/api/campaigns/${campaignId}?practiceId=${encodeURIComponent(practiceId)}`, {
        method: 'DELETE',
      });
      const body = await response.json() as ApiResponse<unknown>;
      if (!response.ok) throw new Error(body.error || 'Unable to delete Recall campaign');
      showToast('Recall campaign draft deleted', 'success');
      setReloadVersion((version) => version + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to delete Recall campaign', 'error');
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isSubmitting) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), iframe, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusableElements?.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const columns = [
    { header: 'Campaign Name', accessorKey: (campaign: RecallCampaign) => <strong>{campaign.name}</strong> },
    { header: 'Channel', accessorKey: (campaign: RecallCampaign) => campaign.channel.toUpperCase() },
    {
      header: 'Status',
      accessorKey: (campaign: RecallCampaign) => (
        <StatusBadge status={getStatusVariant(campaign.status)}>{campaign.status.replaceAll('_', ' ')}</StatusBadge>
      ),
    },
    {
      header: 'Sent / Total',
      accessorKey: (campaign: RecallCampaign) => `${campaign.sentCount} / ${campaign.totalRecipients}`,
    },
    {
      header: 'Scheduled',
      accessorKey: (campaign: RecallCampaign) => campaign.scheduledAt
        ? formatCampaignInstant(campaign.scheduledAt, practiceTimezone)
        : '—',
    },
    {
      header: 'Created',
      accessorKey: (campaign: RecallCampaign) => new Date(campaign.createdAt).toLocaleDateString(),
    },
    {
      header: 'Actions',
      accessorKey: (campaign: RecallCampaign) => (
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.secondaryButton}
            aria-label={`View report for ${campaign.name}`}
            disabled={reportLoading}
            onClick={() => void openReport(campaign.id)}
          >
            <Eye size={16} aria-hidden="true" />
            Report
          </button>
          {campaign.status === 'draft' && (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-label={`Edit ${campaign.name}`}
                disabled={isSubmitting}
                onClick={() => void handleEdit(campaign.id)}
              >
                <Pencil size={16} aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-label={`Delete ${campaign.name}`}
                onClick={() => void deleteDraft(campaign.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete
              </button>
            </>
          )}
          {campaign.status === 'scheduled' && (
            <button
              type="button"
              className={styles.secondaryButton}
              aria-label={`Cancel ${campaign.name}`}
              onClick={() => void cancelScheduled(campaign.id)}
            >
              <X size={16} aria-hidden="true" />
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];
  const isLoadingPractice = practiceId === null
    || loading
    || (!!practiceId && campaignsPracticeId !== practiceId && !loadError);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Preventive Recall"
        description="Prepare, schedule, and report on preventive-care outreach."
        actions={
          <button
            ref={createButtonRef}
            type="button"
            className={styles.primaryButton}
            disabled={!practiceId || isSubmitting}
            onClick={startCreate}
          >
            <Plus size={18} aria-hidden="true" />
            New Recall Campaign
          </button>
        }
      />

      <p className={styles.eligibilityNotice} role="note">
        Choose a published Recall template and an approved due-recall group. Audience preview and dispatch exclude patients who no longer match the group, have future scheduled appointments, lack channel consent, or have no destination.
      </p>

      {isLoadingPractice ? (
        <LoadingState text="Loading recall campaigns..." />
      ) : !practiceId ? (
        <EmptyState
          icon={<RefreshCcw size={32} aria-hidden="true" />}
          title="Select a practice"
          description="Choose a practice in the workspace before viewing recall campaigns."
        />
      ) : loadError ? (
        <ErrorState
          title="Recall campaigns could not be loaded"
          message={loadError}
          onRetry={() => setReloadVersion((version) => version + 1)}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<RefreshCcw size={32} aria-hidden="true" />}
          title="No recall campaigns yet"
          description="Create a campaign draft to prepare preventive-care outreach."
        />
      ) : (
        <DataTable
          columns={columns}
          data={campaigns}
          keyExtractor={(campaign) => campaign.id}
        />
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recall-dialog-title"
            onKeyDown={handleDialogKeyDown}
          >
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle} id="recall-dialog-title">
                {editingCampaignId ? 'Edit Recall Campaign' : 'Create Recall Campaign'}
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close campaign dialog"
                disabled={isSubmitting}
                onClick={closeDialog}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSave}>
              <div className={styles.formField}>
                <label htmlFor="recallCampaignName">Campaign Name</label>
                <input
                  ref={campaignNameRef}
                  id="recallCampaignName"
                  type="text"
                  required
                  maxLength={255}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g., 6-Month Hygiene Recall"
                />
              </div>
              <div className={styles.formField}>
                <label htmlFor="recallCampaignChannel">Channel</label>
                <select
                  id="recallCampaignChannel"
                  value={channel}
                  onChange={(event) => {
                    const nextChannel = event.target.value as 'sms' | 'email' | '';
                    setChannel(nextChannel);
                    if (selectedTemplate?.channel !== nextChannel) setSelectedTemplateId('');
                    setAudienceCount(null);
                  }}
                >
                  <option value="">Choose a channel</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className={styles.formField}>
                <span className={styles.fieldLabel}>Recall template</span>
                <div className={styles.templateSelection}>
                  <span>{selectedTemplate?.name ?? 'No template selected'}</span>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={!!templateError || !channel}
                    onClick={() => setTemplatePickerOpen(true)}
                  >
                    Select template
                  </button>
                </div>
                {templateError && (
                  <div className={styles.errorWithRetry} role="alert">
                    <p className={styles.inlineError}>{templateError}</p>
                    <button type="button" className={styles.secondaryButton} onClick={() => setOptionsReloadVersion((version) => version + 1)}>
                      Retry loading templates
                    </button>
                  </div>
                )}
                {!templateError && availableTemplates.length === 0 && (
                  <p className={styles.helperText}>
                    No published {channel.toUpperCase()} Recall templates are available. Add one in the Templates library.
                  </p>
                )}
              </div>
              {templatePreview?.channel === 'email' && (
                <section className={styles.previewSection} aria-label="Email message preview">
                  <div className={styles.previewHeading}>
                    <Mail size={17} aria-hidden="true" />
                    <strong>Email preview</strong>
                  </div>
                  <p><strong>Subject:</strong> {templatePreview.subject}</p>
                  <EmailMessagePreview html={templatePreview.html} className={styles.emailPreview} />
                  <p className={styles.helperText}>Example values only. Patient and recall details are filled in when the campaign is dispatched.</p>
                </section>
              )}
              {templatePreview?.channel === 'sms' && (
                <section className={styles.previewSection} aria-label="SMS message preview">
                  <div className={styles.previewHeading}>
                    <Send size={17} aria-hidden="true" />
                    <strong>SMS preview</strong>
                  </div>
                  <pre className={styles.smsPreview}>{templatePreview.body}</pre>
                  <p className={styles.helperText}>Example values only. Patient and recall details are filled in when the campaign is dispatched.</p>
                </section>
              )}
              {templatePreview?.channel === 'error' && (
                <p className={styles.inlineError} role="alert">Template preview unavailable: {templatePreview.message}</p>
              )}
              <p className={styles.eligibilityNotice} role="note">
                Select only a dynamic group configured with the due Open Dental recall rule. Groups are combined as a union.
              </p>
              <GroupAudienceSelector
                groups={groups}
                selectedGroupIds={selectedGroupIds}
                onChange={setSelectedGroupIds}
                description="Choose one or more approved due-recall groups. Recall campaigns cannot target all patients."
                emptyMessage="No due-recall groups are available. Create a dynamic group with the Open Dental due-recall rule first."
                loading={groupsLoading}
                error={groupsError}
                onRetry={() => setGroupsReloadVersion((version) => version + 1)}
              />
              <div className={styles.audiencePreview}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={audienceLoading || groupsLoading || selectedGroupIds.length === 0}
                  onClick={() => void previewAudience()}
                >
                  <Users size={16} aria-hidden="true" />
                  {audienceLoading ? 'Previewing...' : 'Preview audience'}
                </button>
                {audienceCount !== null && (
                  <div aria-live="polite">
                    <strong>{audienceCount.toLocaleString()} eligible {channel === 'sms' ? 'SMS' : 'email'} recipients</strong>
                    {audiencePreview.length > 0 && (
                      <p className={styles.previewNames}>
                        Sample: {audiencePreview.slice(0, 5).map((patient) => `${patient.firstName} ${patient.lastName}`).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <label className={styles.formField}>
                <span>
                  <CalendarClock size={16} aria-hidden="true" /> Schedule date and time ({practiceTimezone})
                </span>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={fromPracticeInstant(new Date(Date.now() + 60000).toISOString(), practiceTimezone)}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  aria-label={`Schedule date and time (${practiceTimezone})`}
                  disabled={!!practiceError || !practiceTimezoneLoaded}
                />
              </label>
              {practiceError && (
                <div className={styles.errorWithRetry} role="alert">
                  <p className={styles.inlineError}>{practiceError}</p>
                  <button type="button" className={styles.secondaryButton} onClick={() => setOptionsReloadVersion((version) => version + 1)}>
                    Retry practice settings
                  </button>
                </div>
              )}
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isSubmitting}
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isSubmitting || groupsLoading || !!groupsError || !!practiceError || !practiceTimezoneLoaded || !selectedTemplateId || !selectedGroupIds.length}
                  onClick={() => void saveCampaign('schedule')}
                >
                  Schedule
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isSubmitting || groupsLoading || !!groupsError || !selectedTemplateId || !selectedGroupIds.length}
                  onClick={() => void saveCampaign('sendNow')}
                >
                  <Send size={16} aria-hidden="true" />
                  Send now
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting || groupsLoading || !!groupsError || !selectedTemplateId || selectedGroupIds.length === 0}
                >
                  {isSubmitting ? 'Saving...' : editingCampaignId ? 'Save draft' : 'Save draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <TemplatePickerDialog
        open={templatePickerOpen}
        title={`${channel.toUpperCase()} Recall templates`}
        description={`Select a published ${channel.toUpperCase()} template from the centralized Recall library.`}
        templates={availableTemplates}
        selectedTemplateId={selectedTemplateId}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(template) => {
          setSelectedTemplateId(template.id);
          setAudienceCount(null);
          setTemplatePickerOpen(false);
        }}
        libraryHref="/workspace/templates?category=recall"
        emptyMessage={`No published ${channel.toUpperCase()} Recall templates are available. Add one in the`}
      />
      {(reportLoading || reportCampaign) && (
        <div className={styles.modalOverlay}>
          <section ref={reportDialogRef} className={styles.reportDialog} role="dialog" aria-modal="true" aria-labelledby="recall-report-title">
            <header className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle} id="recall-report-title">Recall campaign report</h2>
              <button
                type="button"
                ref={reportCloseButtonRef}
                className={styles.closeButton}
                aria-label="Close Recall report"
                onClick={closeReport}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            {reportLoading ? (
              <LoadingState text="Loading Recall report..." />
            ) : reportCampaign ? (
              <>
                <p className={styles.reportStatus}>
                  {reportCampaign.name} · {reportCampaign.status.replaceAll('_', ' ')}
                  {reportCampaign.scheduledAt ? ` · ${formatCampaignInstant(reportCampaign.scheduledAt, practiceTimezone)}` : ''}
                </p>
                <div className={styles.reportStats} aria-label="Recall report metrics">
                  <div><span>Recipients</span><strong>{reportCampaign.stats.total.toLocaleString()}</strong></div>
                  <div><span>Sent / accepted</span><strong>{reportCampaign.stats.sent.toLocaleString()}</strong></div>
                  <div><span>Delivered</span><strong>{reportCampaign.stats.delivered.toLocaleString()}</strong></div>
                  <div><span>Bounced</span><strong>{reportCampaign.stats.bounced.toLocaleString()}</strong></div>
                  <div><span>Failed</span><strong>{reportCampaign.stats.failed.toLocaleString()}</strong></div>
                  <div><span>Skipped</span><strong>{reportCampaign.stats.skipped.toLocaleString()}</strong></div>
                </div>
                <p className={styles.helperText}>
                  Sent means accepted by the configured provider, not confirmed delivered. Patient contact details are not shown in this report.
                </p>
                <h3>Recipient activity</h3>
                {!reportRecipients.length ? <p>No recipient activity is available yet.</p> : (
                  <div className={styles.recipientTableWrap}>
                    <table className={styles.recipientTable}>
                      <thead><tr><th>Recipient reference</th><th>Status</th><th>Last updated</th></tr></thead>
                      <tbody>{reportRecipients.map((recipient) => (
                        <tr key={recipient.recipientId}>
                          <td>{recipient.recipientId}</td>
                          <td>{recipient.status}</td>
                          <td>{new Date(recipient.updatedAt).toLocaleString()}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
