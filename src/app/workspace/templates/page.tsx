'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { FileText, Plus, Search, X, Image as ImageIcon, Eye, Edit3, Copy, Trash2 } from 'lucide-react';
import EmailMessagePreview from '@/components/feature/EmailMessagePreview/EmailMessagePreview';
import { extractTemplateBody, renderDocumentToHtml } from '@/lib/templates/document-schema';

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
  const [categories, setCategories] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Preview modal state
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  useEffect(() => {
    async function init() {
      let pId = localStorage.getItem('selected_practice_id') || localStorage.getItem('selectedClinicId');
      if (!pId) {
        try {
          const res = await fetch('/api/practices');
          const json = await res.json();
          if (res.ok && json.data && json.data.length > 0) {
            pId = json.data[0].id;
            localStorage.setItem('selected_practice_id', pId!);
          }
        } catch {
          // ignore
        }
      }
      if (pId) {
        setPracticeId(pId);
        fetchTemplates(pId);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function fetchTemplates(pId: string, catId?: string) {
    try {
      let url = `/api/templates?practiceId=${pId}`;
      if (catId) url += `&categoryId=${catId}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) {
        setCategories(json.data.categories || []);
        setTemplates(json.data.templates || []);
      } else {
        showToast(json.error || 'Failed to load templates', 'error');
      }
    } catch {
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloneTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Template cloned successfully', 'success');
        router.push(`/workspace/templates/${json.data.id}/edit`);
      } else {
        showToast(json.error || 'Failed to clone template', 'error');
      }
    } catch {
      showToast('Failed to clone template', 'error');
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
      const json = await res.json();
      if (res.ok) {
        showToast('Template deleted successfully', 'success');
        fetchTemplates(practiceId, selectedCategory);
      } else {
        showToast(json.error || 'Failed to delete template', 'error');
      }
    } catch {
      showToast('Failed to delete template', 'error');
    }
  }

  function getInterpolatedContent(t: any, forCard = false) {
    if (t.content?.body) {
      let text = t.content.body;
      for (const [k, v] of Object.entries(previewSampleVars)) {
        text = text.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v);
      }
      const pad = forCard ? '0.75rem' : '1.5rem';
      const size = forCard ? '0.75rem' : '1rem';
      return `<div style="padding: ${pad}; font-family: sans-serif; color: #1e293b; line-height: 1.5; background: #fff; font-size: ${size};">${text}</div>`;
    }

    if (Array.isArray(t.content?.sections) || Array.isArray(t.content?.blocks)) {
      const sourceSections = Array.isArray(t.content.sections)
        ? t.content.sections
        : [{ id: 'preview-section', blocks: t.content.blocks }];
      const document = {
        ...t.content,
        sections: sourceSections.map((section: any, sectionIndex: number) => ({
          ...section,
          id: section.id || `preview-section-${sectionIndex}`,
          blocks: (Array.isArray(section.blocks) ? section.blocks : []).map((block: any, blockIndex: number) => ({
            ...block,
            id: block.id || `preview-block-${sectionIndex}-${blockIndex}`,
            properties: {
              ...block,
              ...(block.properties && typeof block.properties === 'object' ? block.properties : {}),
            },
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

    if (t.content?.questions) {
      const pad = forCard ? '0.75rem' : '1.5rem';
      const size = forCard ? '0.75rem' : '1rem';
      let html = `<div style="padding: ${pad}; font-family: sans-serif; background: #fff; font-size: ${size};">`;
      html += `<h4 style="color: #1e293b; margin-bottom: 0.25rem;">${t.content.title || t.name}</h4>`;
      html += `<p style="color: #64748b; margin-bottom: 0.75rem;">${t.content.description || ''}</p>`;
      for (const q of t.content.questions.slice(0, 2)) {
        html += `<div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px;"><div style="font-weight: 500; color: #334155;">${q.text}</div></div>`;
      }
      html += `</div>`;
      return html;
    }

    return '<div style="padding: 1rem; color: #64748b; background: #fff;">No preview available</div>';
  }

  function getInterpolatedText(t: any) {
    let text = extractTemplateBody(t.content || {});
    for (const [key, value] of Object.entries(previewSampleVars)) {
      text = text.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }
    return text;
  }

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '2rem' }}>
      <PageHeader
        title="Centralized Templates Library"
        description="Browse, clone, and manage modern system and practice templates with live visual previews across all 9 engagement categories."
        actions={
          <button
            onClick={() => router.push('/workspace/templates/new')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> New Template (Visual Builder)
          </button>
        }
      />

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search templates across all categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
          />
        </div>
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              fetchTemplates(practiceId, e.target.value);
            }}
            style={{ padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', background: '#fff' }}
          >
            <option value="">All Categories (9)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading templates library...</p>
      ) : filteredTemplates.length === 0 ? (
        <div style={{ background: '#fff', padding: '4rem 2rem', borderRadius: '8px', textAlign: 'center', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No templates found</h3>
          <p>Try adjusting your search or category filter, or create a new template.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {filteredTemplates.map((t) => (
            <div key={t.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'transform 0.15s ease' }}>
              {/* Top: Direct Visual Preview Frame with Tags */}
              <div
                style={{ width: '100%', height: '170px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setPreviewTemplate(t)}
              >
                <EmailMessagePreview
                  html={getInterpolatedContent(t, true)}
                  style={{ height: '170px', minHeight: 0, border: 0, borderRadius: 0, pointerEvents: 'none' }}
                />
                {/* Tags: Top Left */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '0.4rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1e293b', textTransform: 'uppercase', background: '#fff', padding: '0.25rem 0.6rem', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {t.channel}
                  </span>
                  {t.isSystem && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', background: '#dbeafe', padding: '0.25rem 0.6rem', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                      System Template
                    </span>
                  )}
                </div>
                {/* Preview Hint: Bottom Right */}
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500 }}>
                  <Eye size={12} /> Click to preview
                </div>
              </div>

              {/* Middle: Title, Description */}
              <div style={{ padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>{t.name}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', lineHeight: '1.4' }}>{t.description || 'No description provided.'}</p>
                </div>

                {/* Bottom: Action Buttons Only */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  {t.isSystem ? (
                    <button
                      onClick={() => handleCloneTemplate(t.id)}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Copy size={14} /> Clone
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/workspace/templates/${t.id}/edit`)}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id, t.name)}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template preview modal */}
      {previewTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: '#f1f5f9', borderRadius: '12px', width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#1e293b', color: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{previewTemplate.channel === 'sms' ? 'SMS Preview' : 'Email Preview'}: {previewTemplate.name}</h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{previewTemplate.channel === 'sms' ? 'Text message preview with sample data' : 'Simulated Email Client View with Sample Data'}</span>
              </div>
              <button onClick={() => setPreviewTemplate(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {previewTemplate.channel === 'sms' ? (
                <div style={{ maxWidth: '480px', padding: '1rem', background: '#e2e8f0', borderRadius: '12px' }}>
                  <div style={{ display: 'inline-block', padding: '0.75rem 1rem', background: '#fff', borderRadius: '12px', color: '#1e293b', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                    {getInterpolatedText(previewTemplate) || 'No message content available.'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ background: '#fff', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                    <div style={{ marginBottom: '0.4rem', color: '#64748b' }}><strong>From:</strong> Smile Dental Care &lt;notifications@smiledental.com&gt;</div>
                    <div style={{ marginBottom: '0.4rem', color: '#64748b' }}><strong>To:</strong> Jane Doe &lt;jane@example.com&gt;</div>
                    <div style={{ color: '#0f172a' }}><strong>Subject:</strong> {previewTemplate.content?.subject || previewTemplate.name}</div>
                  </div>
                  <EmailMessagePreview
                    html={getInterpolatedContent(previewTemplate, false)}
                    style={{ height: 'min(60vh, 640px)', minHeight: '360px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
