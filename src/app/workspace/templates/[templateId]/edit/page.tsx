'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/components/feedback/ToastProvider/ToastProvider';
import { createDefaultDocument, extractTemplateBody, renderDocumentToHtml } from '@/lib/templates/document-schema';
import type { CanvasBlock, TemplateDocument } from '@/lib/templates/document-schema';
import { VARIABLE_REGISTRY } from '@/lib/templates/variable-registry';
import RichEditorToolbar from '@/components/ui/RichEditorToolbar/RichEditorToolbar';
import styles from '../../TemplateEditor.module.css';
import { getBlockStyle, getSectionStyle } from '../../template-editor-styles';
import {
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
  GripVertical,
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
  const [templateType, setTemplateType] = useState('newsletter');
  const [channel, setChannel] = useState('email');
  const [smsBody, setSmsBody] = useState('');
  const [doc, setDoc] = useState<TemplateDocument>(createDefaultDocument('newsletter'));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let pId = localStorage.getItem('selectedClinicId');
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
        setChannel(t.channel === 'sms' ? 'sms' : 'email');
        setTemplateType(t.templateType || (t.channel === 'sms' ? 'sms' : 'email'));
        if (t.content && typeof t.content === 'object') {
          setSmsBody(extractTemplateBody(t.content));
          setDoc({
            ...createDefaultDocument('newsletter'),
            ...t.content,
            sections: Array.isArray(t.content.sections) ? t.content.sections : [],
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

  function applyFormattingToBlock(bId: string, formatTag: string, value?: string) {
    const block = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === bId);
    if (block && (block.type === 'heading' || block.type === 'paragraph' || block.type === 'footer')) {
      // Use document.execCommand for proper text selection formatting
      const selection = window.getSelection();
      
      // Check if we have a valid selection
      if (!selection) {
        return;
      }

      switch (formatTag) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'underline':
          document.execCommand('underline', false);
          break;
        case 'strike':
        case 'strikethrough':
          document.execCommand('strikeThrough', false);
          break;
        case 'insertUnorderedList':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'insertOrderedList':
          document.execCommand('insertOrderedList', false);
          break;
        case 'createLink': {
          const url = value || prompt('Enter URL:', 'https://');
          if (url) {
            document.execCommand('createLink', false, url);
            // Style the newly created link
            setTimeout(() => {
              const editableDiv = document.querySelector(`[contenteditable="true"]`);
              if (editableDiv) {
                const links = editableDiv.querySelectorAll('a[href]');
                links.forEach((link) => {
                  if (!(link as HTMLElement).style.color) {
                    (link as HTMLElement).style.color = '#2563eb';
                    (link as HTMLElement).style.textDecoration = 'underline';
                  }
                });
              }
            }, 10);
          }
          break;
        }
        default:
          if (value !== undefined) {
            document.execCommand(formatTag, false, value);
          }
      }

      // Update the block's text property with the new HTML after formatting
      setTimeout(() => {
        const editableDiv = document.querySelector(`[contenteditable="true"]`) as HTMLElement;
        if (editableDiv) {
          updateBlockProperty(bId, 'text', editableDiv.innerHTML);
        }
      }, 10);
    }
  }

  async function handleUpdate() {
    if (!practiceId || !templateId) return;
    if (channel === 'email' && !doc.subject?.trim()) {
      showToast('Email subject is required', 'error');
      return;
    }
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
          templateType,
          content: {
            ...doc,
            subject: channel === 'email' ? doc.subject : undefined,
            body: channel === 'sms' ? smsBody : undefined,
          },
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
    return <div className={styles.loadingState}>Loading template editor...</div>;
  }

  const selectedBlock = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === selectedBlockId);
  const activeBlock = selectedBlock || doc.sections[0]?.blocks[0] || null;

  return (
    <div className={styles.editorRoot}>
      {/* Top Toolbar */}
      <header className={styles.header}>
        <div className={styles.headerFields}>
          <button type="button" onClick={() => router.push('/workspace/templates')} className={styles.backButton}>
            <ArrowLeft size={18} /> Templates
          </button>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            aria-label="Template name"
            className={styles.templateNameInput}
          />
          {channel === 'email' && (
            <label className={styles.headerField}>
              <span className={styles.headerFieldLabel}>Starter Layout</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setDoc(createDefaultDocument(e.target.value));
                    showToast('Loaded starter layout', 'success');
                  }
                }}
                defaultValue="newsletter"
                className={`${styles.select} ${styles.starterSelect}`}
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
            </label>
          )}
          <label className={styles.headerField} htmlFor="template-category">
            <span className={styles.headerFieldLabel}>Category</span>
            <select
              id="template-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={`${styles.select} ${styles.headerFieldSelect}`}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.headerActions}>
          {channel === 'email' && (
            <div className={styles.deviceControls}>
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`${styles.deviceButton} ${previewMode === 'desktop' ? styles.deviceButtonActive : ''}`}
                aria-pressed={previewMode === 'desktop'}
              >
                <Monitor size={16} /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`${styles.deviceButton} ${previewMode === 'mobile' ? styles.deviceButtonActive : ''}`}
                aria-pressed={previewMode === 'mobile'}
              >
                <Smartphone size={16} /> Mobile
              </button>
            </div>
          )}
          {channel === 'email' && (
            <button
              type="button"
              onClick={() => setShowHtmlPreview(!showHtmlPreview)}
              className={styles.secondaryButton}
              aria-pressed={showHtmlPreview}
            >
              <Eye size={16} /> {showHtmlPreview ? 'Visual Editor' : 'HTML Code'}
            </button>
          )}
          <button
            type="button"
            onClick={handleUpdate}
            disabled={saving}
            className={styles.primaryButton}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        {/* Left Sidebar: Element Library & Variables */}
        <aside className={styles.sidebar}>
          <div className={`${styles.sidebarSection} ${styles.messageSettings}`}>
            <h2 className={styles.sectionTitle}>Message Settings</h2>
            <div className={styles.fieldLabel}>
              Template type: {channel === 'sms' ? 'SMS' : 'Email'}
            </div>
            {channel === 'email' && (
              <label className={styles.subjectField}>
                Email subject <span aria-hidden="true">*</span>
                <input
                  type="text"
                  value={doc.subject || ''}
                  onChange={(e) => setDoc((currentDoc) => ({ ...currentDoc, subject: e.target.value }))}
                  placeholder="Enter email subject"
                  aria-label="Email subject"
                  required
                  className={styles.input}
                />
              </label>
            )}
          </div>
          <div className={styles.sidebarSection}>
            {channel === 'email' && (
              <>
                <h2 className={styles.sectionTitle}>Layout &amp; Content Blocks</h2>
                <p className={styles.layoutDescription}>Drag elements onto the canvas or click to add.</p>
                <div className={styles.blockLibrary}>
                  {(['heading', 'paragraph', 'image', 'logo', 'button', 'divider', 'spacer', 'footer'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'add', elementType: type }));
                    e.dataTransfer.setData('text/plain', `add:${type}`);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => addBlock(type)}
                  className={styles.blockLibraryItem}
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
                </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <h2 className={styles.sectionTitle}>Dynamic Variables</h2>
            <div className={styles.variableList}>
              {VARIABLE_REGISTRY.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  type="button"
                  aria-label={`Insert ${v.key}`}
                  className={styles.variableButton}
                >
                  <span className={styles.variableLabel}>{v.label}</span>
                  <span className={styles.variableToken}>{`{{${v.key}}}`}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center Canvas with Rich Formatting Toolbar */}
        <main
          className={styles.canvas}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => handleDrop(e)}
        >
          {channel === 'sms' ? (
            <div className={styles.smsCard}>
              <label htmlFor="sms-message" className={styles.smsLabel}>SMS message</label>
              <textarea
                id="sms-message"
                aria-label="SMS message"
                rows={8}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                placeholder="Write the text message. Use Dynamic Variables to personalize it."
                className={styles.smsTextarea}
              />
              <div className={styles.characterCount}>{smsBody.length} characters</div>
              <div className={styles.smsPreview}>
                <p className={styles.smsPreviewTitle}>SMS PREVIEW</p>
                <div className={styles.smsBubble}>
                  {smsBody || 'Your text message will appear here.'}
                </div>
              </div>
            </div>
          ) : (
            <>
          {/* Modern WYSIWYG Rich Text Toolbar */}
          {!showHtmlPreview && activeBlock && (
            <div className={`${styles.editorToolbarWrap} ${previewMode === 'desktop' ? styles.desktopWidth : styles.mobileWidth}`}>
              <RichEditorToolbar
                activeBlock={activeBlock}
                onFormat={applyFormattingToBlock}
                onPropChange={updateBlockProperty}
              />
            </div>
          )}

          {showHtmlPreview ? (
            <div className={styles.htmlPreview}>
              <h2 className={styles.htmlPreviewTitle}>Generated HTML Output</h2>
              <pre className={styles.htmlCode}>
                {renderDocumentToHtml(doc)}
              </pre>
            </div>
          ) : (
            <div className={`${styles.canvasFrame} ${previewMode === 'desktop' ? styles.desktopWidth : styles.mobileWidth} ${activeBlock ? '' : styles.canvasFrameWithoutToolbar}`}>
              {doc.subject && (
                <div className={styles.subjectPreview}>
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
                  className={styles.templateSection}
                  style={getSectionStyle(sec)}
                >
                  {sec.blocks.length === 0 ? (
                    <p className={styles.emptySection}>Drag and drop blocks here or click to add.</p>
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
                        className={`${styles.canvasBlock} ${selectedBlockId === b.id ? styles.canvasBlockSelected : ''}`}
                        style={getBlockStyle(b)}
                      >
                        {/* Drag Handle & Delete */}
                        <div className={styles.blockActions}>
                          <span title="Drag to reorder" className={styles.dragHandle}><GripVertical size={14} /> Drag</span>
                          <button type="button" title="Delete" aria-label="Delete block" onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }} className={styles.deleteBlockButton}><Trash2 size={16} /></button>
                        </div>

                        {b.type === 'heading' && (
                          selectedBlockId === b.id ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onBlur={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onClick={(e) => e.stopPropagation()}
                              dangerouslySetInnerHTML={{ __html: b.properties.text || '' }}
                              className={`${styles.editableBlock} ${styles.editableHeading}`}
                            />
                          ) : (
                            <h3 className={styles.renderedHeading} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
                          )
                        )}
                        {b.type === 'paragraph' && (
                          selectedBlockId === b.id ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onBlur={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onClick={(e) => e.stopPropagation()}
                              dangerouslySetInnerHTML={{ __html: b.properties.text || '' }}
                              className={`${styles.editableBlock} ${styles.editableParagraph}`}
                            />
                          ) : (
                            <p className={styles.renderedParagraph} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
                          )
                        )}
                        {b.type === 'image' && (
                          <div className={styles.blockAlignment}>
                            <img src={b.properties.url} alt={b.properties.alt || ''} className={styles.blockImage} />
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} className={`${styles.blockInspector} ${styles.inspectorColumn}`}>
                                <input type="text" aria-label="Image URL" placeholder="Image URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} className={styles.input} />
                                <div className={styles.inspectorRow}>
                                  <span className={styles.sizeLabel}>Auto-Resize Width:</span>
                                  {(['25%', '50%', '75%', '100%'] as const).map((w) => (
                                    <button type="button" key={w} onClick={() => updateBlockProperty(b.id, 'width', w)} className={`${styles.sizeButton} ${b.properties.width === w ? styles.sizeButtonSelected : ''}`} aria-pressed={b.properties.width === w}>{w}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'logo' && (
                          <div className={styles.blockAlignment}>
                            <img src={b.properties.url} alt="Logo" className={styles.logoImage} />
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} className={styles.blockInspector}>
                                <input type="text" aria-label="Logo URL" placeholder="Logo URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} className={styles.input} />
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'button' && (
                          <div className={styles.blockAlignment}>
                            <span className={styles.buttonPreview}>
                              {b.properties.text}
                            </span>
                            {selectedBlockId === b.id && (
                              <div onClick={(e) => e.stopPropagation()} className={styles.blockInspector}>
                                <input type="text" aria-label="Button text" placeholder="Button Text" value={b.properties.text || ''} onChange={(e) => updateBlockProperty(b.id, 'text', e.target.value)} className={styles.input} />
                                <input type="text" aria-label="Button URL" placeholder="URL" value={b.properties.url || ''} onChange={(e) => updateBlockProperty(b.id, 'url', e.target.value)} className={styles.input} />
                              </div>
                            )}
                          </div>
                        )}
                        {b.type === 'divider' && <hr className={styles.divider} />}
                        {b.type === 'spacer' && (
                          <div className={styles.spacerBlock}>
                            Spacer: {b.properties.height || '20px'}
                          </div>
                        )}
                        {b.type === 'footer' && (
                          selectedBlockId === b.id ? (
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onInput={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onBlur={(e) => updateBlockProperty(b.id, 'text', e.currentTarget.innerHTML)}
                              onClick={(e) => e.stopPropagation()}
                              dangerouslySetInnerHTML={{ __html: b.properties.text || '' }}
                              className={`${styles.editableBlock} ${styles.editableFooter}`}
                            />
                          ) : (
                            <div className={styles.renderedFooter} dangerouslySetInnerHTML={{ __html: b.properties.text || '' }} />
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
