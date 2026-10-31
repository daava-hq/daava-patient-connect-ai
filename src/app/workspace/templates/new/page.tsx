'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  MoveUp,
  MoveDown,
  Bold,
  Italic,
  Link as LinkIcon,
} from 'lucide-react';

export default function NewTemplateEditorPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [templateName, setTemplateName] = useState('New Campaign Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateType, setTemplateType] = useState('newsletter');
  const [channel, setChannel] = useState('email');
  const [doc, setDoc] = useState<TemplateDocument>(createDefaultDocument('newsletter'));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let pId = localStorage.getItem('selected_practice_id') || localStorage.getItem('selectedClinicId');
    if (pId) {
      setPracticeId(pId);
      fetchCategories(pId);
    }
  }, []);

  async function fetchCategories(pId: string) {
    try {
      const res = await fetch(`/api/templates?practiceId=${pId}`);
      const json = await res.json();
      if (res.ok && json.data?.categories?.length > 0) {
        setCategories(json.data.categories);
        setSelectedCategoryId(json.data.categories[0].id);
      }
    } catch {
      showToast('Failed to load categories', 'error');
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
        return { text: 'Enter your paragraph text here. You can use variables like {{patient.firstName}}.', color: '#475569', alignment: 'left' as const };
      case 'image':
        return { url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=60', alt: 'Image', alignment: 'center' as const };
      case 'button':
        return { text: 'Click Here', url: '{{practice.website}}', backgroundColor: '#2563eb', color: '#ffffff', alignment: 'center' as const };
      case 'divider':
        return {};
      case 'spacer':
        return { height: '20px' };
      case 'footer':
        return { text: '© Patient Connect. All rights reserved. Unsubscribe if needed.' };
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

  function moveBlock(blockId: string, direction: 'up' | 'down') {
    const sections = [...doc.sections];
    for (const sec of sections) {
      const idx = sec.blocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx >= 0 && targetIdx < sec.blocks.length) {
          const [moved] = sec.blocks.splice(idx, 1);
          sec.blocks.splice(targetIdx, 0, moved);
          setDoc({ ...doc, sections });
          break;
        }
      }
    }
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
    } else {
      showToast('Select a heading, paragraph, or footer block to insert variables', 'info');
    }
  }

  function applyFormatting(formatTag: string) {
    if (!selectedBlockId) {
      showToast('Please select a text block first', 'info');
      return;
    }
    const block = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === selectedBlockId);
    if (block && (block.type === 'heading' || block.type === 'paragraph' || block.type === 'footer')) {
      const currentText = block.properties.text || '';
      let formatted = currentText;
      if (formatTag === 'bold') formatted = `<strong>${currentText}</strong>`;
      if (formatTag === 'italic') formatted = `<em>${currentText}</em>`;
      if (formatTag === 'link') formatted = `<a href="{{practice.website}}">${currentText}</a>`;
      updateBlockProperty(selectedBlockId, 'text', formatted);
      showToast('Applied rich formatting', 'success');
    }
  }

  async function handleSave(status = 'published') {
    if (!practiceId || !selectedCategoryId) {
      showToast('Missing practice or category', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practiceId,
          categoryId: selectedCategoryId,
          name: templateName,
          description: templateDescription,
          templateType,
          channel,
          content: doc,
          variables: VARIABLE_REGISTRY.map((v) => v.key),
          status,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Template saved successfully!', 'success');
        router.push('/workspace/templates');
      } else {
        showToast(json.error || 'Failed to save template', 'error');
      }
    } catch {
      showToast('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
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
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
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
            onClick={() => handleSave('published')}
            disabled={saving}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar: Element Library & Variables */}
        <aside style={{ width: '300px', background: '#fff', borderRight: '1px solid #e2e8f0', padding: '1.25rem', overflowY: 'auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Layout & Content Blocks</h4>
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Drag elements onto the canvas or click to add.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {(['heading', 'paragraph', 'image', 'button', 'divider', 'footer'] as const).map((type) => (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type }))}
                  onClick={() => addBlock(type)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', textTransform: 'capitalize' }}
                >
                  {type === 'heading' && <Type size={16} />}
                  {type === 'paragraph' && <FileText size={16} />}
                  {type === 'image' && <ImageIcon size={16} />}
                  {type === 'button' && <Square size={16} />}
                  {type === 'divider' && <Layout size={16} />}
                  {type === 'footer' && <FileText size={16} />}
                  <span>{type}</span>
                </div>
              ))}
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

        {/* Center Canvas with Dropzone */}
        <main
          style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const data = JSON.parse(e.dataTransfer.getData('application/json'));
              if (data?.type) addBlock(data.type);
            } catch {
              // ignore
            }
          }}
        >
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
                  {sec.blocks.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Drag and drop blocks here or click to add.</p>
                  ) : (
                    sec.blocks.map((b) => (
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
                        {/* Reorder & delete quick controls */}
                        {selectedBlockId === b.id && (
                          <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px', zIndex: 10 }}>
                            <button title="Move Up" onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 'up'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><MoveUp size={14} /></button>
                            <button title="Move Down" onClick={(e) => { e.stopPropagation(); moveBlock(b.id, 'down'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}><MoveDown size={14} /></button>
                            <button title="Delete" onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#dc2626' }}><Trash2 size={14} /></button>
                          </div>
                        )}

                        {b.type === 'heading' && <h3 style={{ color: b.properties.color || '#1e293b', textAlign: b.properties.alignment || 'left', margin: 0 }}>{b.properties.text}</h3>}
                        {b.type === 'paragraph' && <p style={{ color: b.properties.color || '#475569', textAlign: b.properties.alignment || 'left', margin: 0, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />}
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
                        {b.type === 'footer' && <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Right Sidebar: Properties Panel with Rich Formatting */}
        <aside style={{ width: '320px', background: '#fff', borderLeft: '1px solid #e2e8f0', padding: '1.25rem', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '1rem' }}>Element Properties</h4>
          {selectedBlock ? (
            <div>
              <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 500, textTransform: 'uppercase' }}>
                Selected: {selectedBlock.type}
              </div>

              {(selectedBlock.type === 'heading' || selectedBlock.type === 'paragraph' || selectedBlock.type === 'footer') && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 500 }}>Text Content & Rich Editor</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button title="Bold" onClick={() => applyFormatting('bold')} style={{ padding: '2px 6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer' }}><Bold size={12} /></button>
                      <button title="Italic" onClick={() => applyFormatting('italic')} style={{ padding: '2px 6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer' }}><Italic size={12} /></button>
                      <button title="Link" onClick={() => applyFormatting('link')} style={{ padding: '2px 6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer' }}><LinkIcon size={12} /></button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
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

              <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => moveBlock(selectedBlock.id, 'up')}
                  style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: 'none', padding: '0.4rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                >
                  <MoveUp size={14} /> Move Up
                </button>
                <button
                  onClick={() => moveBlock(selectedBlock.id, 'down')}
                  style={{ flex: 1, background: '#f1f5f9', color: '#334155', border: 'none', padding: '0.4rem', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                >
                  <MoveDown size={14} /> Move Down
                </button>
              </div>

              <div style={{ marginTop: '1rem' }}>
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
