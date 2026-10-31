'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { createDefaultDocument, renderDocumentToHtml, TemplateDocument, CanvasBlock } from '@/lib/templates/document-schema';
import { VARIABLE_REGISTRY } from '@/lib/templates/variable-registry';
import {
  Plus,
  Save,
  Eye,
  Smartphone,
  Monitor,
  Trash2,
  ArrowLeft,
  Type,
  Image as ImageIcon,
  Square,
  Layout,
  FileText,
} from 'lucide-react';

export default function EditTemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;
  const { showToast } = useToast();

  const [practiceId, setPracticeId] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [doc, setDoc] = useState<TemplateDocument>(createDefaultDocument('newsletter'));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let pId = localStorage.getItem('selected_practice_id') || localStorage.getItem('selectedClinicId');
    if (pId && templateId) {
      setPracticeId(pId);
      fetchTemplateAndCategories(pId, templateId);
    } else {
      setLoading(false);
    }
  }, [templateId]);

  async function fetchTemplateAndCategories(pId: string, tId: string) {
    try {
      const [resTemp, resList] = await Promise.all([
        fetch(`/api/templates/${tId}?practiceId=${pId}`),
        fetch(`/api/templates?practiceId=${pId}`),
      ]);
      const jsonTemp = await resTemp.json();
      const jsonList = await resList.json();

      if (resList.ok && jsonList.data?.categories) {
        setCategories(jsonList.data.categories);
      }

      if (resTemp.ok && jsonTemp.data) {
        const t = jsonTemp.data;
        setTemplateName(t.name);
        setTemplateDescription(t.description || '');
        setCategoryId(t.categoryId || '');
        if (t.content && t.content.sections) {
          setDoc(t.content);
        } else if (t.content && t.content.body) {
          setDoc({
            version: 1,
            subject: t.content.subject,
            sections: [
              {
                id: 'sec-1',
                blocks: [
                  {
                    id: 'b-1',
                    type: 'paragraph',
                    properties: { text: t.content.body },
                  },
                ],
              },
            ],
          });
        }
      } else {
        showToast(jsonTemp.error || 'Failed to load template', 'error');
      }
    } catch {
      showToast('Failed to load template', 'error');
    } finally {
      setLoading(false);
    }
  }

  function addBlock(type: CanvasBlock['type']) {
    const newBlock: CanvasBlock = {
      id: `block-${Date.now()}`,
      type,
      properties: getDefaultProperties(type),
    };

    const updatedSections = [...doc.sections];
    if (updatedSections.length === 0) {
      updatedSections.push({ id: `section-${Date.now()}`, blocks: [newBlock] });
    } else {
      updatedSections[0].blocks.push(newBlock);
    }

    setDoc({ ...doc, sections: updatedSections });
    setSelectedBlockId(newBlock.id);
  }

  function getDefaultProperties(type: CanvasBlock['type']): CanvasBlock['properties'] {
    switch (type) {
      case 'heading':
        return { text: 'New Heading', level: 'h2' as const, color: '#1e293b', alignment: 'left' as const };
      case 'paragraph':
        return { text: 'Enter your text here...', color: '#475569', alignment: 'left' as const };
      case 'image':
        return { url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=60', alt: 'Image', alignment: 'center' as const };
      case 'button':
        return { text: 'Click Here', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' as const };
      case 'divider':
        return {};
      case 'spacer':
        return { height: '20px' };
      case 'footer':
        return { text: '© Patient Connect. All rights reserved.' };
      default:
        return {};
    }
  }

  function updateBlockProperty(blockId: string, key: string, val: any) {
    const updatedSections = doc.sections.map((sec) => ({
      ...sec,
      blocks: sec.blocks.map((b) => (b.id === blockId ? { ...b, properties: { ...b.properties, [key]: val } } : b)),
    }));
    setDoc({ ...doc, sections: updatedSections });
  }

  function deleteBlock(blockId: string) {
    const updatedSections = doc.sections.map((sec) => ({
      ...sec,
      blocks: sec.blocks.filter((b) => b.id !== blockId),
    }));
    setDoc({ ...doc, sections: updatedSections });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }

  function insertVariable(varKey: string) {
    if (!selectedBlockId) {
      showToast('Please select a text block first to insert a variable', 'info');
      return;
    }
    const block = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === selectedBlockId);
    if (block && (block.type === 'heading' || block.type === 'paragraph' || block.type === 'footer')) {
      const currentText = block.properties.text || '';
      updateBlockProperty(selectedBlockId, 'text', `${currentText} {{${varKey}}}`);
      showToast(`Inserted {{${varKey}}}`, 'success');
    }
  }

  async function handleUpdate() {
    if (!practiceId || !templateId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          categoryId,
          name: templateName,
          description: templateDescription,
          content: doc,
          status: 'published',
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Template updated successfully!', 'success');
        router.push('/workspace/templates');
      } else {
        showToast(json.error || 'Failed to update template', 'error');
      }
    } catch {
      showToast('Failed to update template', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading template editor...</div>;
  }

  const selectedBlock = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === selectedBlockId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Top Toolbar */}
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/workspace/templates')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
            <ArrowLeft size={18} /> Templates
          </button>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            style={{ fontSize: '1rem', fontWeight: 600, border: '1px solid #cbd5e1', padding: '0.35rem 0.6rem', borderRadius: '4px', background: '#fff', width: '220px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Category:</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setPreviewMode('desktop')}
              style={{ background: previewMode === 'desktop' ? '#fff' : 'none', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Monitor size={16} /> Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              style={{ background: previewMode === 'mobile' ? '#fff' : 'none', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <Smartphone size={16} /> Mobile
            </button>
          </div>
          <button
            onClick={() => setShowHtmlPreview(!showHtmlPreview)}
            style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Eye size={16} /> {showHtmlPreview ? 'Visual Editor' : 'HTML Code'}
          </button>
          <button
            onClick={handleUpdate}
            disabled={saving}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <aside style={{ width: '300px', background: '#fff', borderRight: '1px solid #e2e8f0', padding: '1.25rem', overflowY: 'auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Layout & Content Blocks</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button onClick={() => addBlock('heading')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Type size={16} /> Heading
              </button>
              <button onClick={() => addBlock('paragraph')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <FileText size={16} /> Paragraph
              </button>
              <button onClick={() => addBlock('image')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <ImageIcon size={16} /> Image
              </button>
              <button onClick={() => addBlock('button')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Square size={16} /> Button
              </button>
              <button onClick={() => addBlock('divider')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <Layout size={16} /> Divider
              </button>
              <button onClick={() => addBlock('footer')} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <FileText size={16} /> Footer
              </button>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Dynamic Variables</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto' }}>
              {VARIABLE_REGISTRY.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '4px', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{v.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2563eb' }}>{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
          {showHtmlPreview ? (
            <div style={{ width: '100%', maxWidth: '650px', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Generated HTML Output</h3>
              <pre style={{ background: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto' }}>
                {renderDocumentToHtml(doc)}
              </pre>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: previewMode === 'desktop' ? '650px' : '380px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '2rem', transition: 'width 0.2s ease', minHeight: '600px' }}>
              {doc.subject && (
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  Subject: {doc.subject}
                </div>
              )}

              {doc.sections.map((sec) => (
                <div key={sec.id} style={{ background: sec.backgroundColor || '#fff', padding: sec.padding || '1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px dashed #cbd5e1' }}>
                  {sec.blocks.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBlockId(b.id)}
                      style={{
                        padding: '0.75rem',
                        marginBottom: '0.75rem',
                        borderRadius: '6px',
                        border: selectedBlockId === b.id ? '2px solid #2563eb' : '1px solid transparent',
                        background: selectedBlockId === b.id ? '#eff6ff' : '#f8fafc',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      {b.type === 'heading' && <h3 style={{ color: b.properties.color || '#1e293b', textAlign: b.properties.alignment || 'left', margin: 0 }}>{b.properties.text}</h3>}
                      {b.type === 'paragraph' && <p style={{ color: b.properties.color || '#475569', textAlign: b.properties.alignment || 'left', margin: 0, lineHeight: 1.4 }}>{b.properties.text}</p>}
                      {b.type === 'image' && (
                        <div style={{ textAlign: b.properties.alignment || 'center' }}>
                          <img src={b.properties.url} alt={b.properties.alt} style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px' }} />
                        </div>
                      )}
                      {b.type === 'button' && (
                        <div style={{ textAlign: b.properties.alignment || 'center' }}>
                          <span style={{ background: b.properties.backgroundColor || '#2563eb', color: b.properties.color || '#fff', padding: '0.5rem 1rem', borderRadius: '4px', display: 'inline-block', fontWeight: 500, fontSize: '0.85rem' }}>
                            {b.properties.text}
                          </span>
                        </div>
                      )}
                      {b.type === 'divider' && <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '0.5rem 0' }} />}
                      {b.type === 'footer' && <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>{b.properties.text}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside style={{ width: '320px', background: '#fff', borderLeft: '1px solid #e2e8f0', padding: '1.25rem', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '1rem' }}>Element Properties</h4>
          {selectedBlock ? (
            <div>
              <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 500, textTransform: 'uppercase' }}>
                Selected: {selectedBlock.type}
              </div>

              {(selectedBlock.type === 'heading' || selectedBlock.type === 'paragraph' || selectedBlock.type === 'footer') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>Text Content</label>
                  <textarea
                    rows={3}
                    value={selectedBlock.properties.text || ''}
                    onChange={(e) => updateBlockProperty(selectedBlock.id, 'text', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              )}

              {selectedBlock.type === 'image' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>Image URL</label>
                    <input
                      type="text"
                      value={selectedBlock.properties.url || ''}
                      onChange={(e) => updateBlockProperty(selectedBlock.id, 'url', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>Alt Text</label>
                    <input
                      type="text"
                      value={selectedBlock.properties.alt || ''}
                      onChange={(e) => updateBlockProperty(selectedBlock.id, 'alt', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </>
              )}

              {selectedBlock.type === 'button' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>Button Text</label>
                    <input
                      type="text"
                      value={selectedBlock.properties.text || ''}
                      onChange={(e) => updateBlockProperty(selectedBlock.id, 'text', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem' }}>Destination URL</label>
                    <input
                      type="text"
                      value={selectedBlock.properties.url || ''}
                      onChange={(e) => updateBlockProperty(selectedBlock.id, 'url', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </>
              )}

              <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  onClick={() => deleteBlock(selectedBlock.id)}
                  style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%', justifyContent: 'center' }}
                >
                  <Trash2 size={16} /> Delete Element
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Select an element on the canvas to configure its properties.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
