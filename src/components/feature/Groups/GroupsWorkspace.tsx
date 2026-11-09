'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Eye, History, Mail, Plus, Save, Search, Send, Smartphone, Trash2, Users, X } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import SearchInput from '@/components/ui/SearchInput/SearchInput';
import Pagination from '@/components/ui/Pagination/Pagination';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import type { GroupCriteria, GroupType } from '@/db/schema/groups';
import {
  parseNewsletterDocument,
  renderNewsletterDocument,
  type NewsletterDocument,
} from '@/lib/newsletters/newsletter-content';
import styles from './GroupsWorkspace.module.css';

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  groupType: GroupType;
  criteria: GroupCriteria;
  memberCount: number;
  archivedAt: string | null;
  createdAt: string;
}

interface PreviewPatient {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AudiencePreview {
  count: number;
  preview: Array<Pick<PatientChoice, 'id' | 'firstName' | 'lastName' | 'email'>>;
}

interface PatientChoice {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
}

interface Member extends PatientChoice {
  addedAt: string | null;
}

interface GroupHistoryEvent {
  id: string;
  action: 'added' | 'removed';
  patientFirstName: string | null;
  patientLastName: string | null;
  changedByName: string | null;
  changedAt: string;
}

interface CampaignHistory {
  id: string;
  name: string;
  type: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  bouncedCount: number;
  failedCount: number;
}

interface TemplateOption {
  id: string;
  name: string;
  channel: string;
  templateType: string;
  status: string;
  isSystem: boolean;
  categoryId: string;
  content: unknown;
}

interface AnnouncementStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
}

interface AnnouncementRecipient {
  recipientId: string;
  status: string;
  updatedAt: string;
}

const ANNOUNCEMENT_PREVIEW_VARIABLES = {
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
  'campaign.name': 'Group Announcement',
};

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

const PAGE_LIMIT = 25;
const initialCriteria: GroupCriteria = {};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result.data as T;
}

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function groupDataUrl(groupId: string, practiceId: string, endpoint: string, params: Record<string, string | number | undefined> = {}) {
  return `/api/groups/${groupId}/${endpoint}?${queryString({ practiceId, ...params })}`;
}

export default function GroupsWorkspace() {
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState('');
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupSearch, setGroupSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [groupsPage, setGroupsPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<GroupSummary | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingGroup, setEditingGroup] = useState<GroupSummary | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('static');
  const [criteria, setCriteria] = useState<GroupCriteria>(initialCriteria);
  const [criteriaPreview, setCriteriaPreview] = useState<{ total: number; preview: PreviewPatient[] } | null>(null);
  const [criteriaPreviewLoading, setCriteriaPreviewLoading] = useState(false);
  const [patientChoices, setPatientChoices] = useState<PatientChoice[]>([]);
  const [patientChoiceTotal, setPatientChoiceTotal] = useState(0);
  const [patientChoicesLoading, setPatientChoicesLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [wizardSaving, setWizardSaving] = useState(false);

  const [detailTab, setDetailTab] = useState<'members' | 'membership' | 'campaigns'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersSearch, setMembersSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<PatientChoice[]>([]);
  const [availableTotal, setAvailableTotal] = useState(0);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableSearch, setAvailableSearch] = useState('');
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);
  const [removeSelected, setRemoveSelected] = useState<string[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [history, setHistory] = useState<GroupHistoryEvent[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementEditingId, setAnnouncementEditingId] = useState<string | null>(null);
  const [announcementName, setAnnouncementName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [announcementContent, setAnnouncementContent] = useState<NewsletterDocument | null>(null);
  const [announcementScheduleAt, setAnnouncementScheduleAt] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementPreview, setAnnouncementPreview] = useState<AudiencePreview | null>(null);
  const [announcementPreviewLoading, setAnnouncementPreviewLoading] = useState(false);
  const [announcementContentPreviewOpen, setAnnouncementContentPreviewOpen] = useState(false);
  const [announcementPreviewMode, setAnnouncementPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [announcementError, setAnnouncementError] = useState('');
  const [announcementReport, setAnnouncementReport] = useState<{
    campaign: Pick<CampaignHistory, 'name' | 'status' | 'createdAt' | 'scheduledAt'>;
    stats: AnnouncementStats;
    recipients: AnnouncementRecipient[];
  } | null>(null);
  const [announcementReportCampaignId, setAnnouncementReportCampaignId] = useState<string | null>(null);
  const [announcementReportLoading, setAnnouncementReportLoading] = useState(false);

  const totalGroupPages = Math.max(1, Math.ceil(groupTotal / PAGE_LIMIT));
  const totalMemberPages = Math.max(1, Math.ceil(membersTotal / PAGE_LIMIT));
  const totalAvailablePages = Math.max(1, Math.ceil(availableTotal / PAGE_LIMIT));
  const totalWizardPatientPages = Math.max(1, Math.ceil(patientChoiceTotal / PAGE_LIMIT));
  const totalCampaignPages = Math.max(1, Math.ceil(campaignTotal / PAGE_LIMIT));
  const selectedAnnouncementTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templates, templateId],
  );
  const renderedAnnouncementPreview = useMemo(() => {
    if (!announcementContent) return null;
    try {
      return renderNewsletterDocument(announcementContent, ANNOUNCEMENT_PREVIEW_VARIABLES);
    } catch {
      return null;
    }
  }, [announcementContent]);
  const publishedAnnouncementTemplates = useMemo(
    () => templates.filter((template) => template.status === 'published' && template.channel === 'email' && template.templateType === 'newsletter'),
    [templates]
  );

  useEffect(() => {
    setPracticeId(localStorage.getItem('selectedClinicId') ?? '');
    const handlePracticeChange = () => {
      setPracticeId(localStorage.getItem('selectedClinicId') ?? '');
      setSelectedGroup(null);
      setGroupsPage(1);
    };
    window.addEventListener('practiceChanged', handlePracticeChange);
    return () => window.removeEventListener('practiceChanged', handlePracticeChange);
  }, []);

  const loadGroups = useCallback(async () => {
    if (!practiceId) {
      setGroupsLoading(false);
      return;
    }
    setGroupsLoading(true);
    setPageError('');
    try {
      const data = await request<{ groups: GroupSummary[]; total: number }>(
        `/api/groups?${queryString({
          practiceId,
          search: groupSearch,
          page: groupsPage,
          limit: PAGE_LIMIT,
          includeArchived: String(includeArchived),
        })}`
      );
      setGroups(data.groups);
      setGroupTotal(data.total);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setGroupsLoading(false);
    }
  }, [practiceId, groupSearch, groupsPage, includeArchived]);

  const refreshSelectedGroup = useCallback(async (groupId: string) => {
    if (!practiceId) return;
    const data = await request<GroupSummary>(`/api/groups/${groupId}?${queryString({ practiceId })}`);
    setSelectedGroup(data);
  }, [practiceId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const requestedGroupId = new URLSearchParams(window.location.search).get('groupId');
    if (!requestedGroupId || !groups.length || selectedGroup) return;
    const matchingGroup = groups.find((group) => group.id === requestedGroupId);
    if (matchingGroup) setSelectedGroup(matchingGroup);
  }, [groups, selectedGroup]);

  const loadMembers = useCallback(async () => {
    if (!practiceId || !selectedGroup) return;
    setMembersLoading(true);
    try {
      const data = await request<{ members: Member[]; total: number }>(
        groupDataUrl(selectedGroup.id, practiceId, 'members', {
          search: membersSearch,
          page: membersPage,
          limit: PAGE_LIMIT,
        })
      );
      setMembers(data.members);
      setMembersTotal(data.total);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setMembersLoading(false);
    }
  }, [practiceId, selectedGroup, membersSearch, membersPage, showToast]);

  const loadAvailablePatients = useCallback(async () => {
    if (!practiceId || !selectedGroup || selectedGroup.groupType !== 'static') return;
    setAvailableLoading(true);
    try {
      const data = await request<{ patients: PatientChoice[]; total: number }>(
        groupDataUrl(selectedGroup.id, practiceId, 'patients', {
          search: availableSearch,
          page: availablePage,
          limit: PAGE_LIMIT,
        })
      );
      setAvailablePatients(data.patients);
      setAvailableTotal(data.total);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setAvailableLoading(false);
    }
  }, [practiceId, selectedGroup, availableSearch, availablePage, showToast]);

  useEffect(() => {
    if (selectedGroup && detailTab === 'members') void loadMembers();
  }, [selectedGroup, detailTab, loadMembers]);

  useEffect(() => {
    if (selectedGroup && detailTab === 'members') void loadAvailablePatients();
  }, [selectedGroup, detailTab, loadAvailablePatients]);

  const loadHistory = useCallback(async () => {
    if (!practiceId || !selectedGroup) return;
    setHistoryLoading(true);
    try {
      const data = await request<{ history: GroupHistoryEvent[] }>(
        groupDataUrl(selectedGroup.id, practiceId, 'history')
      );
      setHistory(data.history);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [practiceId, selectedGroup, showToast]);

  const loadCampaignHistory = useCallback(async (page = 1) => {
    if (!practiceId || !selectedGroup) return;
    setCampaignLoading(true);
    try {
      const data = await request<{ campaigns: CampaignHistory[]; total: number }>(
        groupDataUrl(selectedGroup.id, practiceId, 'campaigns', { page, limit: PAGE_LIMIT })
      );
      setCampaigns(data.campaigns);
      setCampaignTotal(data.total);
      setCampaignPage(page);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setCampaignLoading(false);
    }
  }, [practiceId, selectedGroup, showToast]);

  useEffect(() => {
    if (detailTab === 'membership') void loadHistory();
    if (detailTab === 'campaigns') void loadCampaignHistory(1);
  }, [detailTab, loadHistory, loadCampaignHistory]);

  function openWizard(group?: GroupSummary) {
    setEditingGroup(group ?? null);
    setWizardStep(1);
    setGroupName(group?.name ?? '');
    setGroupDescription(group?.description ?? '');
    setGroupType(group?.groupType ?? 'static');
    setCriteria(group?.criteria ?? {});
    setSelectedPatientIds([]);
    setCriteriaPreview(null);
    setPatientSearch('');
    setPatientPage(1);
    setWizardOpen(true);
  }

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2 || groupType !== 'static' || editingGroup || !practiceId) return;
    let active = true;
    setPatientChoicesLoading(true);
    void request<{ patients: PatientChoice[]; total: number }>(
      `/api/groups/patients?${queryString({ practiceId, search: patientSearch, page: patientPage, limit: PAGE_LIMIT })}`
    )
      .then((data) => {
        if (active) {
          setPatientChoices(data.patients);
          setPatientChoiceTotal(data.total);
        }
      })
      .catch((error: unknown) => {
        if (active) showToast(getErrorMessage(error), 'error');
      })
      .finally(() => {
        if (active) setPatientChoicesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wizardOpen, wizardStep, groupType, editingGroup, practiceId, patientSearch, patientPage, showToast]);

  function togglePatient(id: string) {
    setSelectedPatientIds((current) =>
      current.includes(id) ? current.filter((patientId) => patientId !== id) : [...current, id]
    );
  }

  function setCriteriaField<K extends keyof GroupCriteria>(key: K, value: GroupCriteria[K]) {
    setCriteria((current) => ({ ...current, [key]: value }));
    setCriteriaPreview(null);
  }

  async function previewCriteria() {
    setCriteriaPreviewLoading(true);
    try {
      const data = await request<{ total: number; preview: PreviewPatient[] }>('/api/groups/preview', {
        method: 'POST',
        body: JSON.stringify({ practiceId, criteria }),
      });
      setCriteriaPreview(data);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setCriteriaPreviewLoading(false);
    }
  }

  async function submitWizard(event: FormEvent) {
    event.preventDefault();
    if (wizardStep === 1) {
      setWizardStep(2);
      return;
    }
    setWizardSaving(true);
    try {
      const data = editingGroup
        ? await request<GroupSummary>(`/api/groups/${editingGroup.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              practiceId,
              name: groupName,
              description: groupDescription || null,
              ...(editingGroup.groupType === 'dynamic' ? { criteria } : {}),
            }),
          })
        : await request<GroupSummary>('/api/groups', {
            method: 'POST',
            body: JSON.stringify({
              practiceId,
              name: groupName,
              description: groupDescription || null,
              groupType,
              criteria: groupType === 'dynamic' ? criteria : {},
              patientIds: groupType === 'static' ? selectedPatientIds : [],
            }),
          });
      showToast(editingGroup ? 'Group updated.' : 'Group created.', 'success');
      setWizardOpen(false);
      await refreshSelectedGroup(data.id);
      await loadGroups();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setWizardSaving(false);
    }
  }

  async function duplicateSelectedGroup() {
    if (!selectedGroup) return;
    try {
      const copy = await request<GroupSummary>(`/api/groups/${selectedGroup.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      });
      showToast('Group duplicated.', 'success');
      await refreshSelectedGroup(copy.id);
      await loadGroups();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function archiveGroup(group: GroupSummary) {
    const action = group.archivedAt ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} "${group.name}"?`)) return;
    try {
      const restored = await request<GroupSummary | { success: boolean }>(`/api/groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ practiceId, archived: !group.archivedAt }),
      });
      showToast(group.archivedAt ? 'Group restored.' : 'Group archived.', 'success');
      if (group.archivedAt && 'id' in restored) setSelectedGroup(restored);
      else if (selectedGroup?.id === group.id) setSelectedGroup(null);
      await loadGroups();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function changeMembers(method: 'POST' | 'DELETE', patientIds: string[]) {
    if (!selectedGroup || !patientIds.length) return;
    try {
      const result = await request<{ added?: number; removed?: number }>(
        groupDataUrl(selectedGroup.id, practiceId, 'members'),
        { method, body: JSON.stringify({ practiceId, patientIds }) }
      );
      showToast(method === 'POST' ? `${result.added ?? 0} patient(s) added.` : `${result.removed ?? 0} patient(s) removed.`, 'success');
      setAvailableSelected([]);
      setRemoveSelected([]);
      setMembersPage(1);
      await Promise.all([loadMembers(), loadAvailablePatients(), loadGroups(), refreshSelectedGroup(selectedGroup.id)]);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function openAnnouncement() {
    if (!selectedGroup) return;
    try {
      const data = await request<{ categories: Array<{ id: string; slug: string }>; templates: TemplateOption[] }>(
        `/api/templates?${queryString({ practiceId })}`
      );
      const groupCategoryId = data.categories.find((category) => category.slug === 'groups')?.id;
      setTemplates(data.templates.filter((template) => template.categoryId === groupCategoryId));
      setTemplateId('');
      setAnnouncementContent(null);
      setAnnouncementEditingId(null);
      setAnnouncementScheduleAt('');
      setAnnouncementError('');
      setAnnouncementContentPreviewOpen(false);
      setAnnouncementPreview(null);
      setAnnouncementName(`${selectedGroup.name} announcement`);
      setAnnouncementOpen(true);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function previewAnnouncementAudience(): Promise<AudiencePreview | null> {
    if (!selectedGroup) return null;
    setAnnouncementPreviewLoading(true);
    try {
      const data = await request<AudiencePreview>('/api/audience/preview', {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          filter: { groupIds: [selectedGroup.id], patientStatuses: ['Patient'], consentEmail: true },
        }),
      });
      setAnnouncementPreview(data);
      return data;
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
      return null;
    } finally {
      setAnnouncementPreviewLoading(false);
    }
  }

  function chooseAnnouncementTemplate(id: string) {
    setTemplateId(id);
    setAnnouncementError('');
    if (!id) {
      if (!announcementEditingId) setAnnouncementContent(null);
      return;
    }
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    try {
      setAnnouncementContent(parseNewsletterDocument(template.content));
    } catch (error) {
      setAnnouncementError(getErrorMessage(error));
    }
  }

  async function openAnnouncementDraft(campaignId: string) {
    if (!selectedGroup) return;
    setAnnouncementSaving(true);
    try {
      const [details, templateData] = await Promise.all([
        request<{
          campaign: CampaignHistory;
          content: unknown;
        }>(`/api/groups/${selectedGroup.id}/announcements/${campaignId}?${queryString({ practiceId })}`),
        request<{ categories: Array<{ id: string; slug: string }>; templates: TemplateOption[] }>(
          `/api/templates?${queryString({ practiceId })}`
        ),
      ]);
      const groupCategoryId = templateData.categories.find((category) => category.slug === 'groups')?.id;
      const availableTemplates = templateData.templates.filter((template) => template.categoryId === groupCategoryId);
      const savedContent = parseNewsletterDocument(details.content);
      const matchingTemplate = availableTemplates.find((template) => {
        try {
          return JSON.stringify(parseNewsletterDocument(template.content)) === JSON.stringify(savedContent);
        } catch {
          return false;
        }
      });
      setTemplates(availableTemplates);
      setAnnouncementEditingId(campaignId);
      setAnnouncementName(details.campaign.name);
      setTemplateId(matchingTemplate?.id ?? '');
      setAnnouncementContent(savedContent);
      setAnnouncementScheduleAt('');
      setAnnouncementPreview(null);
      setAnnouncementError('');
      setAnnouncementContentPreviewOpen(false);
      setAnnouncementOpen(true);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setAnnouncementSaving(false);
    }
  }

  async function saveAnnouncementDraft(): Promise<string | null> {
    if (!selectedGroup || (!announcementEditingId && !templateId)) {
      setAnnouncementError('Select a published group announcement template.');
      return null;
    }
    setAnnouncementSaving(true);
    setAnnouncementError('');
    try {
      const editing = Boolean(announcementEditingId);
      const url = editing
        ? `/api/groups/${selectedGroup.id}/announcements/${announcementEditingId}`
        : `/api/groups/${selectedGroup.id}/announcements`;
      const campaign = await request<{ id: string }>(url, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          practiceId,
          name: announcementName.trim(),
          ...(templateId ? { templateId } : {}),
        }),
      });
      setAnnouncementEditingId(campaign.id);
      showToast('Group announcement draft saved.', 'success');
      await loadCampaignHistory();
      return campaign.id;
    } catch (error) {
      const message = getErrorMessage(error);
      setAnnouncementError(message);
      showToast(message, 'error');
      return null;
    } finally {
      setAnnouncementSaving(false);
    }
  }

  async function handleSaveAnnouncement(event: FormEvent) {
    event.preventDefault();
    await saveAnnouncementDraft();
  }

  async function scheduleAnnouncement(sendNow: boolean) {
    if (!selectedGroup) return;
    const campaignId = await saveAnnouncementDraft();
    if (!campaignId) return;
    const audienceSize = await previewAnnouncementAudience();
    if (!audienceSize) return;
    if (!audienceSize.count) {
      setAnnouncementError('No eligible, email-consenting active patients are in this group.');
      return;
    }
    if (!sendNow && !announcementScheduleAt) {
      setAnnouncementError('Choose a date and time before scheduling.');
      return;
    }
    const confirmation = sendNow
      ? `Queue this announcement for ${audienceSize.count} eligible email recipient${audienceSize.count === 1 ? '' : 's'}?`
      : `Schedule this announcement for ${new Date(announcementScheduleAt).toLocaleString()} to ${audienceSize.count} eligible email recipient${audienceSize.count === 1 ? '' : 's'}?`;
    if (!window.confirm(confirmation)) return;
    setAnnouncementSaving(true);
    try {
      await request(`/api/groups/${selectedGroup.id}/announcements/${campaignId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          practiceId,
          sendNow,
          ...(!sendNow ? { scheduledAt: new Date(announcementScheduleAt).toISOString() } : {}),
        }),
      });
      showToast(sendNow ? 'Group announcement queued for sending.' : 'Group announcement scheduled.', 'success');
      setAnnouncementOpen(false);
      setDetailTab('campaigns');
      await loadCampaignHistory();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setAnnouncementSaving(false);
    }
  }

  async function openAnnouncementReport(campaignId: string) {
    if (!selectedGroup) return;
    setAnnouncementReportCampaignId(campaignId);
    setAnnouncementReport(null);
    setAnnouncementReportLoading(true);
    try {
      const [details, recipients] = await Promise.all([
        request<{
          campaign: Pick<CampaignHistory, 'name' | 'status' | 'createdAt' | 'scheduledAt'>;
          stats: AnnouncementStats;
        }>(`/api/groups/${selectedGroup.id}/announcements/${campaignId}?${queryString({ practiceId })}`),
        request<AnnouncementRecipient[]>(
          `/api/campaigns/${campaignId}/recipients?${queryString({ practiceId, limit: 50 })}`
        ),
      ]);
      setAnnouncementReport({
        campaign: details.campaign,
        stats: details.stats,
        recipients,
      });
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
      setAnnouncementReportCampaignId(null);
    } finally {
      setAnnouncementReportLoading(false);
    }
  }

  async function cancelAnnouncement(campaignId: string) {
    if (!selectedGroup || !window.confirm('Cancel this scheduled group announcement?')) return;
    try {
      await request(`/api/groups/${selectedGroup.id}/announcements/${campaignId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ practiceId }),
      });
      showToast('Scheduled group announcement cancelled.', 'success');
      await loadCampaignHistory();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  async function deleteAnnouncement(campaignId: string) {
    if (!selectedGroup || !window.confirm('Delete this group announcement draft?')) return;
    try {
      await request(`/api/groups/${selectedGroup.id}/announcements/${campaignId}?${queryString({ practiceId })}`, {
        method: 'DELETE',
      });
      showToast('Group announcement draft deleted.', 'success');
      await loadCampaignHistory();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  }

  function toggleAvailable(id: string) {
    setAvailableSelected((current) =>
      current.includes(id) ? current.filter((patientId) => patientId !== id) : [...current, id]
    );
  }

  if (!practiceId && groupsLoading) return <LoadingState text="Loading patient groups..." />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Patient Groups"
        description="Build reusable patient audiences with hand-picked lists or saved filters."
        actions={
          <button type="button" className={styles.primaryButton} onClick={() => openWizard()}>
            <Plus size={18} aria-hidden="true" /> Create group
          </button>
        }
      />

      {!practiceId ? (
        <ErrorState title="Choose a practice" message="Select a practice before managing patient groups." />
      ) : pageError ? (
        <ErrorState title="Groups could not be loaded" message={pageError} onRetry={() => void loadGroups()} />
      ) : (
        <div className={styles.workspace}>
          <section className={styles.overview} aria-label="Groups overview">
            <div className={styles.toolbar}>
              <SearchInput
                label="Search groups"
                placeholder="Search groups"
                value={groupSearch}
                onChange={(event) => {
                  setGroupSearch(event.target.value);
                  setGroupsPage(1);
                }}
              />
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.target.checked);
                    setGroupsPage(1);
                  }}
                />
                Include archived
              </label>
            </div>
            <div className={styles.stats}>
              <article className={styles.statCard}>
                <span>Total groups</span><strong>{groupTotal}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Active patients in selected group</span><strong>{selectedGroup?.memberCount ?? '—'}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Group type</span><strong>{selectedGroup ? (selectedGroup.groupType === 'static' ? 'Static' : 'Dynamic') : '—'}</strong>
              </article>
            </div>
            {groupsLoading ? (
              <LoadingState text="Loading groups..." />
            ) : groups.length === 0 ? (
              <EmptyState
                title="No patient groups yet"
                description={groupSearch ? 'Try another search, or clear the search field.' : 'Create your first group to organize patients into reusable audiences.'}
                action={!groupSearch ? <button type="button" className={styles.secondaryButton} onClick={() => openWizard()}>Create your first group</button> : undefined}
              />
            ) : (
              <>
                <ul className={styles.groupList}>
                  {groups.map((group) => (
                    <li key={group.id}>
                      <button
                        type="button"
                        className={`${styles.groupRow} ${selectedGroup?.id === group.id ? styles.groupRowSelected : ''}`}
                        onClick={() => {
                          setSelectedGroup(group);
                          setDetailTab('members');
                          setMembersPage(1);
                        }}
                      >
                        <span className={styles.groupIcon}><Users size={18} aria-hidden="true" /></span>
                        <span className={styles.groupSummary}>
                          <strong>{group.name}</strong>
                          <small>{group.groupType === 'static' ? 'Static group' : 'Dynamic group'}{group.archivedAt ? ' · Archived' : ''}</small>
                        </span>
                        <span className={styles.memberCount}>{group.memberCount} patients</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination currentPage={groupsPage} totalPages={totalGroupPages} onPageChange={setGroupsPage} />
              </>
            )}
          </section>

          <section className={styles.details} aria-label="Group details">
            {!selectedGroup ? (
              <EmptyState title="Select a group" description="Choose a group to view its members, history, and engagement." />
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <p className={styles.eyebrow}>{selectedGroup.groupType === 'static' ? 'Static group' : 'Dynamic group'}</p>
                    <h2>{selectedGroup.name}</h2>
                    <p>{selectedGroup.description || 'No description provided.'}</p>
                    {selectedGroup.groupType === 'dynamic' && (
                      <p className={styles.filterSummary}>Members are calculated from the saved patient filters whenever queried.</p>
                    )}
                  </div>
                  <div className={styles.detailActions}>
                    {!selectedGroup.archivedAt && (
                      <>
                        <button type="button" className={styles.iconButton} onClick={() => openWizard(selectedGroup)} aria-label="Edit group">
                          Edit
                        </button>
                        <button type="button" className={styles.iconButton} onClick={() => void duplicateSelectedGroup()} aria-label="Duplicate group">
                          <Copy size={16} aria-hidden="true" /> Duplicate
                        </button>
                      </>
                    )}
                    <button type="button" className={styles.iconButton} onClick={() => void archiveGroup(selectedGroup)}>
                      {selectedGroup.archivedAt ? 'Restore' : 'Archive'}
                    </button>
                    <button type="button" className={styles.primaryButton} onClick={() => void openAnnouncement()} disabled={selectedGroup.archivedAt !== null}>
                      <Mail size={16} aria-hidden="true" /> New announcement
                    </button>
                  </div>
                </div>
                <div className={styles.tabs} role="tablist" aria-label="Group information">
                  <button type="button" role="tab" aria-selected={detailTab === 'members'} onClick={() => setDetailTab('members')}>Members ({selectedGroup.memberCount})</button>
                  <button type="button" role="tab" aria-selected={detailTab === 'membership'} onClick={() => setDetailTab('membership')}><History size={15} aria-hidden="true" /> Membership history</button>
                  <button type="button" role="tab" aria-selected={detailTab === 'campaigns'} onClick={() => setDetailTab('campaigns')}>Engagement history</button>
                </div>

                {detailTab === 'members' && (
                  <div className={styles.memberContent}>
                    <div className={styles.memberPanel}>
                      <div className={styles.panelHeading}>
                        <h3>Current members</h3>
                        {selectedGroup.groupType === 'static' && members.length > 0 && (
                          <button
                            type="button"
                            className={styles.textButton}
                            disabled={!members.some((member) => removeSelected.includes(member.id)) || Boolean(selectedGroup.archivedAt)}
                            onClick={() => void changeMembers('DELETE', removeSelected)}
                          >
                            Remove selected
                          </button>
                        )}
                      </div>
                      <SearchInput
                        label="Search current members"
                        placeholder="Find a patient"
                        value={membersSearch}
                        onChange={(event) => {
                          setMembersSearch(event.target.value);
                          setMembersPage(1);
                        }}
                      />
                      {membersLoading ? <LoadingState text="Loading members..." /> : members.length === 0 ? (
                        <p className={styles.emptyInline}>No patients match this group yet.</p>
                      ) : (
                        <ul className={styles.patientList}>
                          {members.map((patient) => (
                            <li key={patient.id}>
                              {selectedGroup.groupType === 'static' && (
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${patient.firstName} ${patient.lastName} to remove`}
                                  checked={removeSelected.includes(patient.id)}
                                  onChange={() => setRemoveSelected((current) => current.includes(patient.id) ? current.filter((id) => id !== patient.id) : [...current, patient.id])}
                                />
                              )}
                              <span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.email || patient.status}</small></span>
                              {selectedGroup.groupType === 'static' && !selectedGroup.archivedAt && (
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => void changeMembers('DELETE', [patient.id])}
                                  aria-label={`Remove ${patient.firstName} ${patient.lastName}`}
                                >
                                  Remove
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Pagination currentPage={membersPage} totalPages={totalMemberPages} onPageChange={setMembersPage} />
                    </div>
                    {selectedGroup.groupType === 'static' ? (
                      <div className={styles.memberPanel}>
                        <div className={styles.panelHeading}>
                          <h3>Add patients</h3>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={availableSelected.length === 0 || Boolean(selectedGroup.archivedAt)}
                            onClick={() => void changeMembers('POST', availableSelected)}
                          >
                            Add selected ({availableSelected.length})
                          </button>
                        </div>
                        <SearchInput
                          label="Search patients to add"
                          placeholder="Search by name or email"
                          value={availableSearch}
                          onChange={(event) => {
                            setAvailableSearch(event.target.value);
                            setAvailablePage(1);
                          }}
                        />
                        {availableLoading ? <LoadingState text="Searching patients..." /> : availablePatients.length === 0 ? (
                          <p className={styles.emptyInline}>No available patients found.</p>
                        ) : (
                          <ul className={styles.patientList}>
                            {availablePatients.map((patient) => (
                              <li key={patient.id}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${patient.firstName} ${patient.lastName} to add`}
                                  checked={availableSelected.includes(patient.id)}
                                  onChange={() => toggleAvailable(patient.id)}
                                />
                                <span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.email || patient.status}</small></span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Pagination currentPage={availablePage} totalPages={totalAvailablePages} onPageChange={setAvailablePage} />
                      </div>
                    ) : (
                      <div className={styles.memberPanel}>
                        <h3>Saved rules</h3>
                        <p>Dynamic groups are recalculated from synchronized, practice-scoped patient and appointment data. Manual member changes are disabled.</p>
                        {!selectedGroup.archivedAt && <button type="button" className={styles.secondaryButton} onClick={() => openWizard(selectedGroup)}>Edit filters</button>}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'membership' && (
                  <div className={styles.historyPanel}>
                    <h3>Membership history</h3>
                    {historyLoading ? <LoadingState text="Loading membership history..." /> : history.length === 0 ? (
                      <p className={styles.emptyInline}>No membership changes have been recorded.</p>
                    ) : (
                      <ul className={styles.eventList}>
                        {history.map((event) => (
                          <li key={event.id}>
                            <span className={event.action === 'added' ? styles.eventAdded : styles.eventRemoved}>{event.action}</span>
                            <span>{event.patientFirstName || 'Deleted'} {event.patientLastName || 'patient'}</span>
                            <small>{event.changedByName ? `by ${event.changedByName} · ` : ''}{new Date(event.changedAt).toLocaleString()}</small>
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedGroup.groupType === 'dynamic' && <p className={styles.note}>Dynamic membership is evaluated on demand and is not stored as a change log.</p>}
                  </div>
                )}

                {detailTab === 'campaigns' && (
                  <div className={styles.historyPanel}>
                    <h3>Engagement history</h3>
                    {campaignLoading ? <LoadingState text="Loading engagement history..." /> : campaigns.length === 0 ? (
                      <EmptyState title="No announcements for this group" description="Create an announcement from a published Groups template, then preview and schedule it for this audience." action={<button type="button" className={styles.secondaryButton} onClick={() => void openAnnouncement()}>Create announcement</button>} />
                    ) : (
                      <ul className={`${styles.eventList} ${styles.announcementList}`}>
                        {campaigns.map((campaign) => (
                          <li key={campaign.id}>
                            <span className={styles.announcementSummary}>
                              <strong>{campaign.name}</strong>
                              <small>{campaign.status}{campaign.scheduledAt ? ` · ${new Date(campaign.scheduledAt).toLocaleString()}` : ` · Created ${new Date(campaign.createdAt).toLocaleDateString()}`}</small>
                              <small>{campaign.totalRecipients} recipients · {campaign.sentCount} sent · {campaign.deliveredCount} delivered · {campaign.bouncedCount} bounced · {campaign.failedCount} failed</small>
                            </span>
                            <div className={styles.announcementActions}>
                              {campaign.status === 'draft' && <button type="button" className={styles.textButton} onClick={() => void openAnnouncementDraft(campaign.id)}>Edit</button>}
                              {campaign.status === 'draft' && <button type="button" className={styles.iconButton} aria-label={`Delete ${campaign.name}`} onClick={() => void deleteAnnouncement(campaign.id)}><Trash2 size={15} /></button>}
                              {campaign.status === 'scheduled' && <button type="button" className={styles.textButton} onClick={() => void cancelAnnouncement(campaign.id)}>Cancel</button>}
                              <button type="button" className={styles.textButton} onClick={() => void openAnnouncementReport(campaign.id)}>Report</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!campaignLoading && campaignTotal > PAGE_LIMIT && (
                      <div className={styles.historyPagination}>
                        <button type="button" className={styles.secondaryButton} disabled={campaignPage <= 1} onClick={() => void loadCampaignHistory(campaignPage - 1)}><ChevronLeft size={16} /> Previous</button>
                        <span>Page {campaignPage} of {totalCampaignPages}</span>
                        <button type="button" className={styles.secondaryButton} disabled={campaignPage >= totalCampaignPages} onClick={() => void loadCampaignHistory(campaignPage + 1)}>Next <ChevronRight size={16} /></button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {wizardOpen && (
        <div className={styles.overlay}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <header className={styles.dialogHeader}>
              <div><p className={styles.eyebrow}>Step {wizardStep} of 2</p><h2 id="wizard-title">{editingGroup ? 'Edit group' : 'Create patient group'}</h2></div>
              <button type="button" className={styles.closeButton} onClick={() => setWizardOpen(false)} aria-label="Close group wizard"><X size={20} /></button>
            </header>
            <form onSubmit={submitWizard}>
              {wizardStep === 1 ? (
                <div className={styles.formGrid}>
                  <label>Group name<input required maxLength={255} value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
                  <label>Description<textarea maxLength={2000} rows={3} value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} /></label>
                  {!editingGroup && (
                    <fieldset className={styles.typePicker}>
                      <legend>How should membership work?</legend>
                      <label><input type="radio" name="groupType" value="static" checked={groupType === 'static'} onChange={() => setGroupType('static')} /> Static — select patients manually</label>
                      <label><input type="radio" name="groupType" value="dynamic" checked={groupType === 'dynamic'} onChange={() => setGroupType('dynamic')} /> Dynamic — calculate from saved rules</label>
                    </fieldset>
                  )}
                  <div className={styles.dialogActions}>
                    <button type="button" className={styles.textButton} onClick={() => setWizardOpen(false)}>Cancel</button>
                    <button type="submit" className={styles.primaryButton} disabled={!groupName.trim()}>Continue</button>
                  </div>
                </div>
              ) : (
                <div className={styles.stepContent}>
                  {groupType === 'dynamic' ? (
                    <div className={styles.formGrid}>
                      <p className={styles.note}>Rules use synchronized patient and appointment fields only. Communication consent is rechecked separately at send time.</p>
                      <fieldset className={styles.filterField}>
                        <legend>Patient status</legend>
                        {(['Patient', 'Inactive', 'Archived'] as const).map((status) => (
                          <label key={status}><input
                            type="checkbox"
                            checked={(criteria.patientStatuses ?? ['Patient']).includes(status)}
                            onChange={(event) => {
                              const selected = new Set<'Patient' | 'Inactive' | 'Archived'>(criteria.patientStatuses ?? ['Patient']);
                              event.target.checked ? selected.add(status) : selected.delete(status);
                              setCriteriaField('patientStatuses', [...selected]);
                            }}
                          />{status}</label>
                        ))}
                      </fieldset>
                      <div className={styles.inlineFields}>
                        <label>Minimum age<input type="number" min="0" max="120" value={criteria.minAge ?? ''} onChange={(event) => setCriteriaField('minAge', event.target.value ? Number(event.target.value) : undefined)} /></label>
                        <label>Maximum age<input type="number" min="0" max="120" value={criteria.maxAge ?? ''} onChange={(event) => setCriteriaField('maxAge', event.target.value ? Number(event.target.value) : undefined)} /></label>
                      </div>
                      <label>Birth month
                        <select multiple value={(criteria.birthMonths ?? []).map(String)} onChange={(event) => setCriteriaField('birthMonths', Array.from(event.target.selectedOptions, (option) => Number(option.value)))}>
                          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2024, index).toLocaleString(undefined, { month: 'long' })}</option>)}
                        </select>
                      </label>
                      <fieldset className={styles.filterField}>
                        <legend>Appointment status</legend>
                        {(['Scheduled', 'Complete', 'Broken', 'UnschedList'] as const).map((status) => (
                          <label key={status}><input
                            type="checkbox"
                            checked={(criteria.appointmentStatuses ?? []).includes(status)}
                            onChange={(event) => {
                              const selected = new Set(criteria.appointmentStatuses ?? []);
                              event.target.checked ? selected.add(status) : selected.delete(status);
                              setCriteriaField('appointmentStatuses', [...selected]);
                            }}
                          />{status}</label>
                        ))}
                      </fieldset>
                      <div className={styles.inlineFields}>
                        <label>Last appointment after<input type="date" value={criteria.lastAppointmentAfter ?? ''} onChange={(event) => setCriteriaField('lastAppointmentAfter', event.target.value || undefined)} /></label>
                        <label>Last appointment before<input type="date" value={criteria.lastAppointmentBefore ?? ''} onChange={(event) => setCriteriaField('lastAppointmentBefore', event.target.value || undefined)} /></label>
                      </div>
                      <label>Contact availability
                        <select value={criteria.contactAvailability ?? ''} onChange={(event) => setCriteriaField('contactAvailability', (event.target.value || undefined) as GroupCriteria['contactAvailability'])}>
                          <option value="">Any contact availability</option>
                          <option value="email">Email address</option>
                          <option value="sms">Mobile phone</option>
                          <option value="either">Email or mobile phone</option>
                          <option value="both">Email and mobile phone</option>
                        </select>
                      </label>
                      <div className={styles.previewBlock}>
                        <button type="button" className={styles.secondaryButton} onClick={() => void previewCriteria()} disabled={criteriaPreviewLoading}>
                          <Search size={16} aria-hidden="true" /> {criteriaPreviewLoading ? 'Previewing…' : 'Preview audience'}
                        </button>
                        {criteriaPreview && <p>{criteriaPreview.total} matching patients; showing up to {criteriaPreview.preview.length} examples.</p>}
                      </div>
                    </div>
                  ) : editingGroup ? (
                    <p className={styles.note}>Static group members can be edited in the group details panel.</p>
                  ) : (
                    <div className={styles.formGrid}>
                      <p className={styles.note}>Choose patients now or create an empty group and add members later.</p>
                      <SearchInput label="Search patients" placeholder="Search by name or email" value={patientSearch} onChange={(event) => { setPatientSearch(event.target.value); setPatientPage(1); }} />
                      {patientChoicesLoading ? <LoadingState text="Loading patients..." /> : patientChoices.length === 0 ? (
                        <p className={styles.emptyInline}>No patients found for this practice.</p>
                      ) : (
                        <ul className={styles.patientList}>
                          {patientChoices.map((patient) => (
                            <li key={patient.id}>
                              <input type="checkbox" checked={selectedPatientIds.includes(patient.id)} onChange={() => togglePatient(patient.id)} aria-label={`Select ${patient.firstName} ${patient.lastName}`} />
                              <span><strong>{patient.firstName} {patient.lastName}</strong><small>{patient.email || patient.status}</small></span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Pagination currentPage={patientPage} totalPages={totalWizardPatientPages} onPageChange={setPatientPage} />
                      <p>{selectedPatientIds.length} patients selected</p>
                    </div>
                  )}
                  <div className={styles.dialogActions}>
                    <button type="button" className={styles.textButton} onClick={() => setWizardStep(1)}>Back</button>
                    <button type="submit" className={styles.primaryButton} disabled={wizardSaving}>
                      {wizardSaving ? 'Saving…' : editingGroup ? 'Save changes' : 'Create group'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </section>
        </div>
      )}

      {announcementOpen && selectedGroup && (
        <div className={styles.overlay}>
          <section className={`${styles.dialog} ${styles.announcementDialog}`} role="dialog" aria-modal="true" aria-labelledby="announcement-title">
            <header className={styles.dialogHeader}>
              <div><p className={styles.eyebrow}>Group audience · {selectedGroup.name}</p><h2 id="announcement-title">{announcementEditingId ? 'Edit announcement draft' : 'Create group announcement'}</h2></div>
              <button type="button" className={styles.closeButton} onClick={() => setAnnouncementOpen(false)} aria-label="Close announcement dialog"><X size={20} /></button>
            </header>
            <form className={styles.formGrid} onSubmit={handleSaveAnnouncement}>
              <p className={styles.note}>Announcements are managed independently from newsletters. Only active patients with email consent in this group are eligible.</p>
              <label>Campaign name<input required maxLength={255} value={announcementName} onChange={(event) => setAnnouncementName(event.target.value)} /></label>
              <label>Published Groups email template
                <select required={!announcementEditingId} value={templateId} onChange={(event) => chooseAnnouncementTemplate(event.target.value)}>
                  <option value="">Select a template</option>
                  {publishedAnnouncementTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}{template.isSystem ? ' · System' : ''}</option>
                  ))}
                </select>
              </label>
              <div className={styles.templateSummary}>
                <strong>{selectedAnnouncementTemplate?.name ?? (announcementEditingId ? 'Saved announcement content' : 'No template selected')}</strong>
                <span>{selectedAnnouncementTemplate ? `${selectedAnnouncementTemplate.isSystem ? 'System' : 'Practice'} template` : 'Choose a published email template in the Groups category.'}</span>
              </div>
              {publishedAnnouncementTemplates.length === 0 && <p className={styles.note}>No published email announcement templates are available in the Groups category. Browse Templates to publish one.</p>}
              <div className={styles.previewBlock}>
                <button type="button" className={styles.secondaryButton} onClick={() => void previewAnnouncementAudience()} disabled={announcementPreviewLoading}>
                  <Search size={16} aria-hidden="true" /> {announcementPreviewLoading ? 'Previewing…' : 'Preview consenting audience'}
                </button>
                {announcementPreview && (
                  <p>
                    {announcementPreview.count} consenting email recipient(s)
                    {announcementPreview.preview.length > 0
                      ? ` · ${announcementPreview.preview.slice(0, 5).map((patient) => `${patient.firstName} ${patient.lastName}`).join(', ')}`
                      : ''}
                  </p>
                )}
              </div>
              <label className={styles.scheduleField}><span><CalendarClock size={16} /> Schedule date and time (optional)</span>
                <input type="datetime-local" value={announcementScheduleAt} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={(event) => setAnnouncementScheduleAt(event.target.value)} />
              </label>
              {announcementError && <p className={styles.announcementError} role="alert">{announcementError}</p>}
              <div className={styles.dialogActions}>
                <button type="button" className={styles.textButton} onClick={() => setAnnouncementOpen(false)}>Close</button>
                <button type="button" className={styles.secondaryButton} onClick={() => setAnnouncementContentPreviewOpen(true)} disabled={!announcementContent || !renderedAnnouncementPreview}><Eye size={16} /> Preview</button>
                <button type="submit" className={styles.secondaryButton} disabled={announcementSaving || (!announcementEditingId && !templateId)}><Save size={16} /> Save draft</button>
                <button type="button" className={styles.secondaryButton} disabled={announcementSaving || (!announcementEditingId && !templateId)} onClick={() => void scheduleAnnouncement(false)}>Schedule</button>
                <button type="button" className={styles.primaryButton} disabled={announcementSaving || (!announcementEditingId && !templateId)} onClick={() => void scheduleAnnouncement(true)}><Send size={16} /> Send now</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {announcementContentPreviewOpen && renderedAnnouncementPreview && (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAnnouncementContentPreviewOpen(false); }}>
          <section className={`${styles.dialog} ${styles.announcementPreviewDialog}`} role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title">
            <header className={styles.dialogHeader}>
              <div><h2 id="announcement-preview-title">Announcement preview</h2><p>{renderedAnnouncementPreview.subject}</p></div>
              <div className={styles.announcementActions}>
                <button type="button" className={styles.textButton} onClick={() => setAnnouncementPreviewMode('desktop')}><Eye size={15} /> Desktop</button>
                <button type="button" className={styles.textButton} onClick={() => setAnnouncementPreviewMode('mobile')}><Smartphone size={15} /> Mobile</button>
                <button type="button" className={styles.closeButton} onClick={() => setAnnouncementContentPreviewOpen(false)} aria-label="Close preview"><X size={20} /></button>
              </div>
            </header>
            <iframe
              className={`${styles.announcementPreviewFrame} ${announcementPreviewMode === 'mobile' ? styles.announcementPreviewMobile : ''}`}
              title={`${announcementPreviewMode} announcement preview`}
              sandbox=""
              srcDoc={renderedAnnouncementPreview.html}
            />
          </section>
        </div>
      )}
      {announcementReportCampaignId && (
        <div className={styles.overlay} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setAnnouncementReportCampaignId(null);
            setAnnouncementReport(null);
          }
        }}>
          <section className={`${styles.dialog} ${styles.announcementReportDialog}`} role="dialog" aria-modal="true" aria-labelledby="announcement-report-title">
            <header className={styles.dialogHeader}>
              <div><p className={styles.eyebrow}>Group announcement report</p><h2 id="announcement-report-title">{announcementReport?.campaign.name ?? 'Loading report'}</h2></div>
              <button type="button" className={styles.closeButton} onClick={() => {
                setAnnouncementReportCampaignId(null);
                setAnnouncementReport(null);
              }} aria-label="Close report"><X size={20} /></button>
            </header>
            {announcementReportLoading || !announcementReport ? (
              <LoadingState text="Loading announcement report..." />
            ) : (
              <>
                <p className={styles.note}>Status: {announcementReport.campaign.status}{announcementReport.campaign.scheduledAt ? ` · Scheduled ${new Date(announcementReport.campaign.scheduledAt).toLocaleString()}` : ''}</p>
                <div className={styles.announcementStats}>
                  <article className={styles.statCard}><span>Recipients</span><strong>{announcementReport.stats.total}</strong></article>
                  <article className={styles.statCard}><span>Sent / accepted</span><strong>{announcementReport.stats.sent}</strong></article>
                  <article className={styles.statCard}><span>Delivered</span><strong>{announcementReport.stats.delivered}</strong></article>
                  <article className={styles.statCard}><span>Bounced</span><strong>{announcementReport.stats.bounced}</strong></article>
                  <article className={styles.statCard}><span>Failed</span><strong>{announcementReport.stats.failed}</strong></article>
                  <article className={styles.statCard}><span>Skipped</span><strong>{announcementReport.stats.skipped}</strong></article>
                  <article className={styles.statCard}><span>Opens</span><strong>{announcementReport.stats.opened}</strong></article>
                  <article className={styles.statCard}><span>Clicks</span><strong>{announcementReport.stats.clicked}</strong></article>
                </div>
                <h3>Recipient activity</h3>
                {announcementReport.recipients.length ? (
                  <ul className={styles.eventList}>
                    {announcementReport.recipients.map((recipient) => (
                      <li key={recipient.recipientId}>
                        <span><strong>Recipient</strong><small>{recipient.status}</small></span>
                        <small>{new Date(recipient.updatedAt).toLocaleString()}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.emptyInline}>No recipient activity is available yet.</p>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
