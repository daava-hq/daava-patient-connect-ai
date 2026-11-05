'use client';

import React, { useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Type,
  Palette,
} from 'lucide-react';
import styles from './RichEditorToolbar.module.css';
import { CanvasBlock } from '@/lib/templates/document-schema';

interface RichEditorToolbarProps {
  activeBlock: CanvasBlock;
  onFormat: (blockId: string, format: string, value?: string) => void;
  onPropChange: (blockId: string, key: string, value: string) => void;
}

const FONT_FAMILIES = [
  { label: 'Sans Serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier', value: "'Courier New', monospace" },
] as const;

const FONT_SIZES = ['10', '11', '12', '13', '14', '15', '16', '18', '20', '22', '24', '28', '32', '36', '42', '48'] as const;

const isTextBlock = (block: CanvasBlock) =>
  block.type === 'heading' || block.type === 'paragraph' || block.type === 'footer';

const isMediaBlock = (block: CanvasBlock) =>
  block.type === 'image' || block.type === 'logo' || block.type === 'button';

const isAlignable = (block: CanvasBlock) => isTextBlock(block) || isMediaBlock(block);

interface ToolbarBtnProps {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function ToolbarBtn({ title, active, onClick, children, disabled }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss from contentEditable
        onClick();
      }}
      disabled={disabled}
      className={`${styles.btn} ${active ? styles.btnActive : ''}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className={styles.separator} aria-hidden="true" />;
}

export default function RichEditorToolbar({ activeBlock, onFormat, onPropChange }: RichEditorToolbarProps) {
  const colorRef = useRef<HTMLInputElement>(null);

  const props = activeBlock.properties;
  const alignment = props.alignment ?? 'left';
  const fontFamily = props.fontFamily ?? 'sans-serif';
  const fontSize = props.fontSize ? props.fontSize.replace('px', '') : '16';
  const textColor = props.color ?? '#334155';

  const handleFormat = useCallback((format: string, value?: string) => {
    onFormat(activeBlock.id, format, value);
  }, [activeBlock.id, onFormat]);

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Rich text editor toolbar">
      {isTextBlock(activeBlock) && (
        <>
          {/* Font family */}
          <div className={styles.group}>
            <select
              className={styles.select}
              value={fontFamily}
              aria-label="Font family"
              onChange={(e) => onPropChange(activeBlock.id, 'fontFamily', e.target.value)}
              style={{ width: 132 }}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font size */}
          <div className={styles.group}>
            <select
              className={styles.select}
              value={fontSize}
              aria-label="Font size"
              onChange={(e) => onPropChange(activeBlock.id, 'fontSize', `${e.target.value}px`)}
              style={{ width: 64 }}
            >
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Text style */}
          <div className={styles.group}>
            <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => handleFormat('bold')}>
              <Bold size={16} strokeWidth={2.5} />
            </ToolbarBtn>
            <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => handleFormat('italic')}>
              <Italic size={16} />
            </ToolbarBtn>
            <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => handleFormat('underline')}>
              <Underline size={16} />
            </ToolbarBtn>
            <ToolbarBtn title="Strikethrough" onClick={() => handleFormat('strike')}>
              <Strikethrough size={16} />
            </ToolbarBtn>
          </div>

          <Separator />

          {/* Lists */}
          <div className={styles.group}>
            <ToolbarBtn title="Bullet list" onClick={() => handleFormat('insertUnorderedList')}>
              <List size={16} />
            </ToolbarBtn>
            <ToolbarBtn title="Numbered list" onClick={() => handleFormat('insertOrderedList')}>
              <ListOrdered size={16} />
            </ToolbarBtn>
          </div>

          <Separator />

          {/* Link */}
          <div className={styles.group}>
            <ToolbarBtn title="Insert link (Ctrl+K)" onClick={() => handleFormat('createLink')}>
              <LinkIcon size={15} />
            </ToolbarBtn>
          </div>

          <Separator />

          {/* Text color */}
          <div className={styles.group}>
            <button
              type="button"
              className={styles.colorBtn}
              title="Text color"
              aria-label="Text color"
              onMouseDown={(e) => {
                e.preventDefault();
                colorRef.current?.click();
              }}
            >
              <Palette size={15} />
              <span className={styles.colorPreview} style={{ background: textColor }} />
            </button>
            <input
              ref={colorRef}
              type="color"
              value={textColor}
              className={styles.colorInput}
              aria-label="Text color picker"
              onChange={(e) => onPropChange(activeBlock.id, 'color', e.target.value)}
            />
          </div>

          <Separator />
        </>
      )}

      {/* Image / logo / button — width picker */}
      {isMediaBlock(activeBlock) && (
        <>
          <div className={styles.group}>
            <span className={styles.label}>Width</span>
            <select
              className={styles.select}
              value={props.width ?? '100%'}
              aria-label="Element width"
              onChange={(e) => onPropChange(activeBlock.id, 'width', e.target.value)}
              style={{ width: 80 }}
            >
              {['25%', '33%', '50%', '66%', '75%', '100%'].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <Separator />
        </>
      )}

      {/* Alignment — for all alignable blocks */}
      {isAlignable(activeBlock) && (
        <div className={styles.group}>
          <ToolbarBtn
            title="Align left"
            active={alignment === 'left'}
            onClick={() => onPropChange(activeBlock.id, 'alignment', 'left')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="7" width="8" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="11" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title="Align center"
            active={alignment === 'center'}
            onClick={() => onPropChange(activeBlock.id, 'alignment', 'center')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="4" y="7" width="8" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="3" y="11" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title="Align right"
            active={alignment === 'right'}
            onClick={() => onPropChange(activeBlock.id, 'alignment', 'right')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="6" y="7" width="8" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="4" y="11" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            title="Justify"
            active={alignment === 'justify'}
            onClick={() => onPropChange(activeBlock.id, 'alignment', 'justify')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="7" width="12" height="1.5" rx="0.75" fill="currentColor"/>
              <rect x="2" y="11" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </ToolbarBtn>
        </div>
      )}
    </div>
  );
}
