'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import EmptyState from '@/components/feedback/EmptyState/EmptyState';
import ErrorState from '@/components/feedback/ErrorState/ErrorState';
import LoadingState from '@/components/feedback/LoadingState/LoadingState';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import StatusBadge from '@/components/ui/StatusBadge/StatusBadge';
import { FileText, Plus, Search, X, Eye, Edit3, Copy, Trash2 } from 'lucide-react';
import EmailMessagePreview from '@/components/feature/EmailMessagePreview/EmailMessagePreview';
import {
  CanvasBlock,
  CanvasSection,
  extractTemplateBody,
  renderDocumentToHtml,
  TemplateDocument,
} from '@/lib/templates/document-schema';
import styles from './TemplatesLibraryPage.module.css';

interface TemplateCategoryData {
  id: string;
  slug: string;
  name: string;
}

interface TemplateContent extends Record<string, unknown> {
  body?: string;
  subject?: string;
  title?: string;
  description?: string;
  questions?: Array<{ text: string }>;
  version?: number;
  sections?: CanvasSection[];
  blocks?: CanvasBlock[];
}

interface TemplateListItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  channel: string;
  isSystem: boolean;
  content?: TemplateContent | null;
}

interface TemplatesApiResponse {
  data?: {
    categories?: TemplateCategoryData[];
    templates?: TemplateListItem[];
  };
  error?: string;
}

interface PracticesApiResponse {
  data?: Array<{ id?: unknown }>;
  error?: string;
}

interface CloneApiResponse {
  data?: { id?: string };
  error?: string;
}

const previewSampleVars: Record<string, string> = {
  'patient.firstName': 'Jane',
  'patient.lastName': 'Doe',
  'patient.fullName': 'Jane Doe',
  'practice.name': 'Smile Dental Care',
  'practice.phone': '(555) 839-2010',
  'practice.website': 'https://smiledental.com',
  'appointment.date': 'November 15, 2026',
  'appointment.time': '10:30 AM',
  'appointment.provider': 'Dr. Smith, DDS',
  'appointment.confirmUrl': 'https://patient.example.com/appointment-confirmation?token=preview',
  'payment.amount': '$150.00',
  'payment.dueDate': 'November 30, 2026',
};

export default function TemplatesLibraryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [categories, setCategories] = useState<TemplateCategoryData[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cloningTemplateId, setCloningTemplateId] = useState<string | null>(null);

  const [previewTemplate, setPreviewTemplate] = useState<TemplateListItem | null>(null);
  const previewDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!previewTemplate) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
    const dialog = previewDialogRef.current;
    const focusable = dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      : [];
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPreviewTemplate(null);
        return;
      }
      if (event.key !== 'Tab' || !focusable.length) return;

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

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [previewTemplate]);

  const fetchTemplates = useCallback(async (pId: string, categoryId?: string, categorySlug?: string) => {
    if (!pId) return;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ practiceId: pId });
      if (categoryId) params.set('categoryId', categoryId);
      const res = await fetch(`/api/templates?${params}`);
      const json: TemplatesApiResponse = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load templates.');

      const nextCategories = json.data?.categories ?? [];
      const nextTemplates = json.data?.templates ?? [];
      const categoryFromSlug = categorySlug
        ? nextCategories.find((category) => category.slug === categorySlug)
        : undefined;
      const resolvedCategoryId = categoryId ?? categoryFromSlug?.id ?? '';
      setCategories(nextCategories);
      setSelectedCategory(resolvedCategoryId);
      setTemplates(
        categoryFromSlug && !categoryId
          ? nextTemplates.filter((template) => template.categoryId === categoryFromSlug.id)
          : nextTemplates,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load templates.';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setLoadError('');
      try {
        let currentPracticeId = localStorage.getItem('selectedClinicId') || '';
        if (!currentPracticeId) {
          const res = await fetch('/api/practices');
          const json: PracticesApiResponse = await res.json();
          if (!res.ok) throw new Error(json.error || 'Failed to load practices.');

          const firstPracticeId = json.data?.[0]?.id;
          if (typeof firstPracticeId === 'string') {
            currentPracticeId = firstPracticeId;
            localStorage.setItem('selectedClinicId', firstPracticeId);
          }
        }

        if (!currentPracticeId) {
          setPracticeId('');
          setCategories([]);
          setTemplates([]);
          setLoading(false);
          return;
        }

        setPracticeId(currentPracticeId);
        const categorySlug = new URLSearchParams(window.location.search).get('category') ?? undefined;
        await fetchTemplates(currentPracticeId, undefined, categorySlug);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to initialize templates.';
        setLoadError(message);
        showToast(message, 'error');
        setLoading(false);
      }
    }

    void initialize();
  }, [fetchTemplates, retryAttempt, showToast]);

  async function handleCloneTemplate(templateId: string) {
    setCloningTemplateId(templateId);
    try {
      const res = await fetch(`/api/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json: CloneApiResponse = await res.json();
      if (res.ok) {
        if (!json.data?.id) throw new Error('Template was cloned without returning its ID.');
        showToast('Template cloned successfully', 'success');
        router.push(`/workspace/templates/${json.data.id}/edit`);
      } else {
        showToast(json.error || 'Failed to clone template', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to clone template', 'error');
    } finally {
      setCloningTemplateId(null);
    }
  }

  async function handleDeleteTemplate(templateId: string, templateName: string) {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/templates/${templateId}?practiceId=${practiceId}`, {
        method: 'DELETE',
      });
      const json: { error?: string } = await res.json();
      if (res.ok) {
        showToast('Template deleted successfully', 'success');
        fetchTemplates(practiceId, selectedCategory);
      } else {
        showToast(json.error || 'Failed to delete template', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete template', 'error');
    }
  }

  function getInterpolatedContent(template: TemplateListItem, forCard = false) {
    const content = template.content;
    if (typeof content?.body === 'string') {
      let text = content.body;
      for (const [k, v] of Object.entries(previewSampleVars)) {
        text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
      }
      const pad = forCard ? '0.75rem' : '1.5rem';
      const size = forCard ? '0.75rem' : '1rem';
      return `<div style="padding: ${pad}; font-family: sans-serif; color: #1e293b; line-height: 1.5; background: #fff; font-size: ${size};">${text}</div>`;
    }

    if (content?.sections || content?.blocks) {
      const sourceSections = content.sections ?? [{ id: 'preview-section', blocks: content.blocks ?? [] }];
      const document: TemplateDocument = {
        version: content.version ?? 1,
        subject: content.subject,
        sections: sourceSections.map((section, sectionIndex) => ({
          ...section,
          id: section.id || `preview-section-${sectionIndex}`,
          blocks: section.blocks.map((block, blockIndex) => ({
            ...block,
            id: block.id || `preview-block-${sectionIndex}-${blockIndex}`,
            properties: { ...block.properties },
          })),
        })),
      };
      let html = renderDocumentToHtml(document);
      for (const [k, v] of Object.entries(previewSampleVars)) {
        html = html.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
      }
      if (forCard) {
        return `<div style="transform: scale(0.65); transform-origin: top left; width: 153%; pointer-events: none;">${html}</div>`;
      }
      return html;
    }

    if (content?.questions) {
      const pad = forCard ? '0.75rem' : '1.5rem';
      const size = forCard ? '0.75rem' : '1rem';
      let html = `<div style="padding: ${pad}; font-family: sans-serif; background: #fff; font-size: ${size};">`;
      html += `<h4 style="color: #1e293b; margin-bottom: 0.25rem;">${content.title || template.name}</h4>`;
      html += `<p style="color: #64748b; margin-bottom: 0.75rem;">${content.description || ''}</p>`;
      for (const q of content.questions.slice(0, 2)) {
        html += `<div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px;"><div style="font-weight: 500; color: #334155;">${q.text}</div></div>`;
      }
      html += `</div>`;
      return html;
    }

    return '<div style="padding: 1rem; color: #64748b; background: #fff;">No preview available</div>';
  }

  function getInterpolatedText(template: TemplateListItem) {
    let text = extractTemplateBody(template.content ?? {});
    for (const [key, value] of Object.entries(previewSampleVars)) {
      text = text.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }
    return text;
  }

  const searchTerm = searchQuery.trim().toLocaleLowerCase();
  const filteredTemplates = templates.filter((template) =>
    template.name.toLocaleLowerCase().includes(searchTerm) ||
    (template.description && template.description.toLocaleLowerCase().includes(searchTerm))
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Centralized Templates Library"
        description="Browse, clone, and manage system and practice templates across all nine engagement categories."
        actions={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.push('/workspace/templates/new')}
          >
            <Plus size={18} aria-hidden="true" />
            New Template
          </button>
        }
      />

      {practiceId && (
        <div className={styles.filters}>
          <label className={styles.searchField} htmlFor="template-search">
            <Search size={18} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Search templates</span>
            <input
              id="template-search"
              type="search"
              placeholder="Search templates across all categories..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label className={styles.categoryField} htmlFor="template-category">
            <span>Category</span>
            <select
              id="template-category"
              value={selectedCategory}
              onChange={(event) => {
                setSelectedCategory(event.target.value);
                void fetchTemplates(practiceId, event.target.value);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {loading ? (
        <LoadingState text="Loading templates library..." />
      ) : loadError ? (
        <ErrorState
          title="Templates could not be loaded"
          message={loadError}
          onRetry={() => setRetryAttempt((current) => current + 1)}
        />
      ) : !practiceId ? (
        <EmptyState
          title="No practice is available"
          description="Select a practice with template access to browse the library."
          icon={<FileText size={32} />}
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description={
            templates.length > 0
              ? 'Try adjusting your search or category filter.'
              : 'Create a practice template or check back after system templates are configured.'
          }
          icon={<FileText size={32} />}
          action={
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => router.push('/workspace/templates/new')}
            >
              <Plus size={16} aria-hidden="true" />
              Create template
            </button>
          }
        />
      ) : (
        <div className={styles.templateGrid}>
          {filteredTemplates.map((template) => (
            <article key={template.id} className={styles.templateCard}>
              <div
                className={styles.cardPreview}
                role="button"
                tabIndex={0}
                aria-label={`Preview ${template.name}`}
                onClick={() => setPreviewTemplate(template)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setPreviewTemplate(template);
                  }
                }}
              >
                <EmailMessagePreview
                  html={getInterpolatedContent(template, true)}
                  className={styles.cardPreviewFrame}
                />
                <div className={styles.previewTags}>
                  <StatusBadge status="default">{template.channel}</StatusBadge>
                  {template.isSystem && (
                    <StatusBadge status="info">System Template</StatusBadge>
                  )}
                </div>
                <span className={styles.previewHint}>
                  <Eye size={12} aria-hidden="true" />
                  Preview
                </span>
              </div>

              <div className={styles.templateDetails}>
                <div>
                  <h2 className={styles.templateName}>{template.name}</h2>
                  <p className={styles.templateDescription}>
                    {template.description || 'No description provided.'}
                  </p>
                </div>
                <div className={styles.templateActions}>
                  {template.isSystem ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={cloningTemplateId !== null}
                      onClick={() => void handleCloneTemplate(template.id)}
                    >
                      <Copy size={14} aria-hidden="true" />
                      {cloningTemplateId === template.id ? 'Cloning...' : 'Clone'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => router.push(`/workspace/templates/${template.id}/edit`)}
                      >
                        <Edit3 size={14} aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => void handleDeleteTemplate(template.id, template.name)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewTemplate && (
        <div
          className={styles.previewBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewTemplate(null);
          }}
        >
          <section
            ref={previewDialogRef}
            className={styles.previewDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-preview-title"
            tabIndex={-1}
          >
            <header className={styles.previewHeader}>
              <div>
                <h2 id="template-preview-title" className={styles.previewTitle}>
                  {previewTemplate.channel === 'sms' ? 'SMS Preview' : 'Email Preview'}: {previewTemplate.name}
                </h2>
                <p className={styles.previewSubtitle}>
                  {previewTemplate.channel === 'sms'
                    ? 'Text message preview with sample data'
                    : 'Email preview with sample data'}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setPreviewTemplate(null)}
                aria-label="Close template preview"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className={styles.previewBody}>
              {previewTemplate.channel === 'sms' ? (
                <div className={styles.smsPreview}>
                  <div className={styles.smsMessage}>
                    {getInterpolatedText(previewTemplate) || 'No message content available.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.emailDetails}>
                    <p><strong>From:</strong> Smile Dental Care &lt;notifications@smiledental.com&gt;</p>
                    <p><strong>To:</strong> Jane Doe &lt;jane@example.com&gt;</p>
                    <p><strong>Subject:</strong> {previewTemplate.content?.subject || previewTemplate.name}</p>
                  </div>
                  <EmailMessagePreview
                    html={getInterpolatedContent(previewTemplate)}
                    className={styles.modalPreviewFrame}
                  />
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
