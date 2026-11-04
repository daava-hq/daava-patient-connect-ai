'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader/PageHeader';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { createDefaultDocument, extractTemplateBody, renderDocumentToHtml, TemplateDocument, CanvasBlock } from '@/lib/templates/document-schema';
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
  GripVertical,
} from 'lucide-react';

export default function NewTemplateEditorPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [practiceId, setPracticeId] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [templateName, setTemplateName] = useState('New Campaign Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateType, setTemplateType] = useState<'sms' | 'email'>('email');
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [smsBody, setSmsBody] = useState('');
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
      case 'logo':
        return { url: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=200&auto=format&fit=crop&q=60', width: '120px', alignment: 'center' as const };
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

  function reorderBlocks(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const sections = [...doc.sections];
    for (const sec of sections) {
      const srcIdx = sec.blocks.findIndex((b) => b.id === sourceId);
      const tgtIdx = sec.blocks.findIndex((b) => b.id === targetId);
      if (srcIdx !== -1 && tgtIdx !== -1) {
        const [moved] = sec.blocks.splice(srcIdx, 1);
        const newTgtIdx = sec.blocks.findIndex((b) => b.id === targetId);
        sec.blocks.splice(newTgtIdx, 0, moved);
        setDoc({ ...doc, sections });
        break;
      }
    }
  }

  function handleDrop(e: React.DragEvent, targetBlockId?: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      const plainStr = e.dataTransfer.getData('text/plain');

      let payload: any = {};
      if (jsonStr) {
        payload = JSON.parse(jsonStr);
      } else if (plainStr) {
        if (plainStr.startsWith('add:')) {
          payload = { type: 'add', elementType: plainStr.replace('add:', '') };
        } else if (plainStr.startsWith('reorder:')) {
          payload = { type: 'reorder', blockId: plainStr.replace('reorder:', '') };
        }
      }

      const updatedSections = [...doc.sections];
      if (updatedSections.length === 0) return;
      const sec = updatedSections[0];

      if (payload.type === 'add' && payload.elementType) {
        const newBlock: CanvasBlock = {
          id: `block-${Date.now()}`,
          type: payload.elementType,
          properties: getDefaultProperties(payload.elementType),
        };
        if (targetBlockId) {
          const tgtIdx = sec.blocks.findIndex((b) => b.id === targetBlockId);
          if (tgtIdx !== -1) {
            sec.blocks.splice(tgtIdx, 0, newBlock);
          } else {
            sec.blocks.push(newBlock);
          }
        } else {
          sec.blocks.push(newBlock);
        }
        setDoc({ ...doc, sections: updatedSections });
        setSelectedBlockId(newBlock.id);
        showToast(`Added ${payload.elementType}`, 'success');
      } else if (payload.type === 'reorder' && payload.blockId) {
        const srcIdx = sec.blocks.findIndex((b) => b.id === payload.blockId);
        if (srcIdx !== -1) {
          const [moved] = sec.blocks.splice(srcIdx, 1);
          if (targetBlockId) {
            const tgtIdx = sec.blocks.findIndex((b) => b.id === targetBlockId);
            if (tgtIdx !== -1) {
              sec.blocks.splice(tgtIdx, 0, moved);
            } else {
              sec.blocks.push(moved);
            }
          } else {
            sec.blocks.push(moved);
          }
          setDoc({ ...doc, sections: updatedSections });
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
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
    if (channel === 'sms') {
      setSmsBody((currentBody) => `${currentBody}{{${varKey}}}`);
      showToast(`Inserted {{${varKey}}}`, 'success');
      return;
    }

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

  function applyFormattingToBlock(bId: string, formatTag: string) {
    const block = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === bId);
    if (block && (block.type === 'heading' || block.type === 'paragraph' || block.type === 'footer')) {
      const currentText = block.properties.text || '';
      let formatted = currentText;
      if (formatTag === 'bold') formatted = `<strong>${currentText}</strong>`;
      if (formatTag === 'italic') formatted = `<em>${currentText}</em>`;
      if (formatTag === 'underline') formatted = `<u>${currentText}</u>`;
      if (formatTag === 'strike') formatted = `<strike>${currentText}</strike>`;
      if (formatTag === 'link') {
        const url = prompt('Enter destination URL:', 'https://');
        if (url) formatted = `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${currentText}</a>`;
      }
      updateBlockProperty(bId, 'text', formatted);
      showToast('Applied rich text formatting', 'success');
    }
  }

  async function handleSave(status = 'published') {
    if (!practiceId || !selectedCategoryId) {
      showToast('Missing practice or category', 'error');
      return;
    }
    if (channel === 'email' && !doc.subject?.trim()) {
      showToast('Email subject is required', 'error');
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
          content: {
            ...doc,
            subject: channel === 'email' ? doc.subject : undefined,
            body: channel === 'sms' ? smsBody : undefined,
          },
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
  const activeBlock = selectedBlock || doc.sections[0]?.blocks[0] || null;

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
            aria-label="Template name"
            style={{ fontSize: '1rem', fontWeight: 600, border: '1px solid #cbd5e1', padding: '0.35rem 0.6rem', borderRadius: '4px', background: '#fff', width: '220px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Starter Layout:</label>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setDoc(createDefaultDocument(e.target.value));
                  showToast('Loaded starter layout', 'success');
                }
              }}
              defaultValue="newsletter"
              style={{ padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
            >
              <option value="newsletter">Dental Newsletter</option>
              <option value="announcement">Practice Announcement</option>
              <option value="appointment">Appointment Reminder</option>
              <option value="birthday">Birthday Greeting</option>
              <option value="payment">Payment Reminder</option>
              <option value="recall">Recall Reminder</option>
              <option value="referral">Referral Thank-You</option>
              <option value="survey">Survey Invitation</option>
            </select>
          </div>
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
          {channel === 'email' && (
            <button
              onClick={() => setShowHtmlPreview(!showHtmlPreview)}
              style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Eye size={16} /> {showHtmlPreview ? 'Visual Editor' : 'HTML Code'}
            </button>
          )}
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
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Message Settings</h4>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
              Template channel
              <select
                value={channel}
                onChange={(e) => {
                  const nextChannel = e.target.value as 'sms' | 'email';
                  setChannel(nextChannel);
                  setTemplateType(nextChannel);
                }}
                aria-label="Template channel"
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="email">Email template</option>
                <option value="sms">SMS template</option>
              </select>
            </label>
            {channel === 'email' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                Email subject <span aria-hidden="true">*</span>
                <input
                  type="text"
                  value={doc.subject || ''}
                  onChange={(e) => setDoc((currentDoc) => ({ ...currentDoc, subject: e.target.value }))}
                  placeholder="Enter email subject"
                  aria-label="Email subject"
                  required
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 400 }}
                />
              </label>
            )}
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            {channel === 'email' && (
              <>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Layout & Content Blocks</h4>
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Drag elements onto the canvas or click to add.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {(['heading', 'paragraph', 'image', 'logo', 'button', 'divider', 'spacer', 'footer'] as const).map((type) => (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add', elementType: type }));
                    e.dataTransfer.setData('text/plain', `add:${type}`);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => addBlock(type)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem', borderRadius: '6px', cursor: 'grab', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', textTransform: 'capitalize', userSelect: 'none' }}
                >
                  {type === 'heading' && <Type size={16} />}
                  {type === 'paragraph' && <FileText size={16} />}
                  {type === 'image' && <ImageIcon size={16} />}
                  {type === 'logo' && <ImageIcon size={16} />}
                  {type === 'button' && <Square size={16} />}
                  {type === 'divider' && <Layout size={16} />}
                  {type === 'spacer' && <Layout size={16} />}
                  {type === 'footer' && <FileText size={16} />}
                  <span>{type}</span>
                </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Dynamic Variables</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto' }}>
              {VARIABLE_REGISTRY.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  type="button"
                  aria-label={`Insert ${v.key}`}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '4px', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{v.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#2563eb' }}>{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas with Rich Formatting Toolbar */}
        <main
          style={{ flex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => handleDrop(e)}
        >
          {channel === 'sms' ? (
            <div style={{ width: '100%', maxWidth: '480px', background: '#fff', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <label htmlFor="sms-message" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#334155' }}>SMS message</label>
              <textarea
                id="sms-message"
                aria-label="SMS message"
                rows={8}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder="Write the text message. Use Dynamic Variables to personalize it."
                style={{ width: '100%', resize: 'vertical', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', font: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>{smsBody.length} characters</div>
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f0f4f8', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>SMS PREVIEW</p>
                <div style={{ display: 'inline-block', maxWidth: '90%', padding: '0.75rem 1rem', background: '#fff', borderRadius: '12px', color: '#1e293b', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                  {smsBody || 'Your text message will appear here.'}
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Screenshot-inspired Rich Formatting Toolbar (Always Visible) */}
          {!showHtmlPreview && activeBlock && (
            <div style={{ width: '100%', maxWidth: previewMode === 'desktop' ? '650px' : '380px', background: '#fff', border: '1px solid #cbd5e1', borderBottom: 'none', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', padding: '0.5rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>Rich Editor:</span>
              {(activeBlock.type === 'heading' || activeBlock.type === 'paragraph' || activeBlock.type === 'footer') && (
                <>
                  <button type="button" title="Bold" onClick={() => applyFormattingToBlock(activeBlock.id, 'bold')} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>B</button>
                  <button type="button" title="Italic" onClick={() => applyFormattingToBlock(activeBlock.id, 'italic')} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontStyle: 'italic', fontSize: '0.85rem' }}>I</button>
                  <button type="button" title="Underline" onClick={() => applyFormattingToBlock(activeBlock.id, 'underline')} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>U</button>
                  <button type="button" title="Strikethrough" onClick={() => applyFormattingToBlock(activeBlock.id, 'strike')} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', textDecoration: 'line-through', fontSize: '0.85rem' }}>S</button>
                  <button type="button" title="Insert Link" onClick={() => applyFormattingToBlock(activeBlock.id, 'link')} style={{ padding: '4px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.85rem' }}><LinkIcon size={14} /> Link</button>

                  <select
                    value={activeBlock.properties.fontFamily || 'sans-serif'}
                    onChange={(e) => updateBlockProperty(activeBlock.id, 'fontFamily', e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="Arial, sans-serif">Arial</option>
                    <option value="Georgia, serif">Georgia</option>
                  </select>

                  <select
                    value={activeBlock.properties.fontSize || '16px'}
                    onChange={(e) => updateBlockProperty(activeBlock.id, 'fontSize', e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="24px">24px</option>
                    <option value="32px">32px</option>
                  </select>

                  <input
                    type="color"
                    title="Text Color"
                    value={activeBlock.properties.color || '#475569'}
                    onChange={(e) => updateBlockProperty(activeBlock.id, 'color', e.target.value)}
                    style={{ width: '28px', height: '28px', padding: '0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                  />
                </>
              )}

              {(activeBlock.type === 'image' || activeBlock.type === 'logo' || activeBlock.type === 'button') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>Width:</label>
                  <select
                    value={activeBlock.properties.width || '100%'}
                    onChange={(e) => updateBlockProperty(activeBlock.id, 'width', e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: '#fff' }}
                  >
                    <option value="25%">25%</option>
                    <option value="50%">50%</option>
                    <option value="75%">75%</option>
                    <option value="100%">100%</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto' }}>
                <button type="button" title="Align Left" onClick={() => updateBlockProperty(activeBlock.id, 'alignment', 'left')} style={{ padding: '4px 8px', background: activeBlock.properties.alignment === 'left' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>⫷</button>
                <button type="button" title="Align Center" onClick={() => updateBlockProperty(activeBlock.id, 'alignment', 'center')} style={{ padding: '4px 8px', background: activeBlock.properties.alignment === 'center' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>≡</button>
                <button type="button" title="Align Right" onClick={() => updateBlockProperty(activeBlock.id, 'alignment', 'right')} style={{ padding: '4px 8px', background: activeBlock.properties.alignment === 'right' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>⫸</button>
                <button type="button" title="Justify" onClick={() => updateBlockProperty(activeBlock.id, 'alignment', 'justify')} style={{ padding: '4px 8px', background: activeBlock.properties.alignment === 'justify' ? '#e2e8f0' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>☷</button>
              </div>
            </div>
          )}

          {showHtmlPreview ? (
            <div style={{ width: '100%', maxWidth: '650px', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Generated HTML Output</h3>
              <pre style={{ background: '#1e293b', color: '#f8fafc', padding: '1rem', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto' }}>
                {renderDocumentToHtml(doc)}
              </pre>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: previewMode === 'desktop' ? '650px' : '380px', background: '#fff', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', borderTopLeftRadius: selectedBlock ? '0' : '8px', borderTopRightRadius: selectedBlock ? '0' : '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '2rem', transition: 'width 0.2s ease', minHeight: '600px' }}>
              {doc.subject && (
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                  Subject: {doc.subject}
                </div>
              )}

              {doc.sections.map((sec) => (
                <div
                  key={sec.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => handleDrop(e)}
                  style={{ background: sec.backgroundColor || '#fff', padding: sec.padding || '1rem', borderRadius: '6px', marginBottom: '1rem', border: '2px dashed #cbd5e1', minHeight: '120px' }}
                >
                  {sec.blocks.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem', padding: '2rem 0' }}>Drag and drop blocks here or click to add.</p>
                  ) : (
                    sec.blocks.map((b) => (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'reorder', blockId: b.id }));
                          e.dataTransfer.setData('text/plain', `reorder:${b.id}`);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => handleDrop(e, b.id)}
                        onClick={() => setSelectedBlockId(b.id)}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0.75rem',
                          borderRadius: '6px',
                          border: selectedBlockId === b.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          background: selectedBlockId === b.id ? '#eff6ff' : '#f8fafc',
                          cursor: 'grab',
                          position: 'relative',
                        }}
                      >
                        {/* Drag Handle & Delete */}
                        <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '4px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 6px', zIndex: 10, alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          <span title="Drag to reorder" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', gap: '2px', color: '#475569', fontSize: '0.75rem', fontWeight: 500 }}><GripVertical size={14} /> Drag</span>
                          <button title="Delete" onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#dc2626', display: 'flex', alignItems: 'center' }}><Trash2 size={16} /></button>
                        </div>

                        {b.type === 'heading' && (
                          selectedBlockId === b.id ? (
                            <textarea
                              rows={2}
                              value={b.properties.text || ''}
                              onChange={(e) => updateBlockProperty(b.id, 'text', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '100%', padding: '0.4rem', border: '1px dashed #2563eb', borderRadius: '4px', fontSize: b.properties.fontSize || '22px', fontFamily: b.properties.fontFamily || 'sans-serif', color: b.properties.color || '#1e293b', background: '#fff', resize: 'vertical' }}
                            />
                          ) : (
                            <h3 style={{ color: b.properties.color || '#1e293b', textAlign: b.properties.alignment || 'left', fontFamily: b.properties.fontFamily || 'sans-serif', fontSize: b.properties.fontSize || '22px', margin: 0 }} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
                          )
                        )}
                        {b.type === 'paragraph' && (
                          selectedBlockId === b.id ? (
                            <textarea
                              rows={3}
                              value={b.properties.text || ''}
                              onChange={(e) => updateBlockProperty(b.id, 'text', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '100%', padding: '0.4rem', border: '1px dashed #2563eb', borderRadius: '4px', fontSize: b.properties.fontSize || '15px', fontFamily: b.properties.fontFamily || 'sans-serif', color: b.properties.color || '#475569', background: '#fff', resize: 'vertical' }}
                            />
                          ) : (
                            <p style={{ color: b.properties.color || '#475569', textAlign: b.properties.alignment || 'left', fontFamily: b.properties.fontFamily || 'sans-serif', fontSize: b.properties.fontSize || '15px', margin: 0, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
                          )
                        )}
                        {b.type === 'image' && (
                          <div style={{ textAlign: b.properties.alignment || 'center' }}>
                            <img src={b.properties.url} alt={b.properties.alt} style={{ width: b.properties.width || '100%', maxWidth: '100%', maxHeight: '220px', borderRadius: '4px' }} />
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem' }}>
                                <input type="text" placeholder="Image URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} style={{ padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Auto-Resize Width:</span>
                                  {(['25%', '50%', '75%', '100%'] as const).map((w) => (
                                    <button key={w} onClick={() => updateBlockProperty(b.id, 'width', w)} style={{ padding: '1px 6px', background: b.properties.width === w ? '#2563eb' : '#fff', color: b.properties.width === w ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '3px', fontSize: '0.7rem', cursor: 'pointer' }}>{w}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'logo' && (
                          <div style={{ textAlign: b.properties.alignment || 'center' }}>
                            <img src={b.properties.url} alt="Logo" style={{ width: b.properties.width || '120px', maxWidth: '100%' }} />
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.8rem' }}>
                                <input type="text" placeholder="Logo URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} style={{ flex: 1, padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'button' && (
                          <div style={{ textAlign: b.properties.alignment || 'center' }}>
                            <span style={{ background: b.properties.backgroundColor || '#2563eb', color: b.properties.color || '#fff', padding: '0.5rem 1rem', borderRadius: '4px', display: 'inline-block', fontWeight: 500, fontSize: '0.85rem' }}>
                              {b.properties.text}
                            </span>
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', display: 'flex', gap: '4px', fontSize: '0.8rem' }}>
                                <input type="text" placeholder="Button Text" value={b.properties.text || ''} onChange={(e) => updateBlockProperty(b.id, 'text', e.target.value)} style={{ flex: 1, padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                                <input type="text" placeholder="URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} style={{ flex: 1, padding: '0.2rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }} />
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'divider' && <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1', margin: '0.5rem 0' }} />}
                        {b.type === 'spacer' && (
                          <div style={{ height: b.properties.height || '20px', background: '#f1f5f9', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '10px', color: '#94a3b8' }}>
                            Spacer: {b.properties.height || '20px'}
                          </div>
                        )}
                        {b.type === 'footer' && (
                          selectedBlockId === b.id ? (
                            <textarea
                              rows={2}
                              value={b.properties.text || ''}
                              onChange={(e) => updateBlockProperty(b.id, 'text', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '100%', padding: '0.4rem', border: '1px dashed #2563eb', borderRadius: '4px', fontSize: '12px', fontFamily: b.properties.fontFamily || 'sans-serif', color: '#94a3b8', background: '#fff', resize: 'vertical' }}
                            />
                          ) : (
                            <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', fontFamily: b.properties.fontFamily || 'sans-serif' }} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
                          )
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
