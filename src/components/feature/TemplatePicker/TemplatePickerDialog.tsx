'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import styles from './TemplatePickerDialog.module.css';

export interface TemplatePickerItem {
  id: string;
  name: string;
  channel: string;
  status: string;
  isSystem: boolean;
  description?: string | null;
}

interface TemplatePickerDialogProps<T extends TemplatePickerItem> {
  open: boolean;
  title: string;
  description: string;
  templates: readonly T[];
  onClose: () => void;
  onSelect: (template: T) => void;
  libraryHref: string;
  emptyMessage: string;
  searchPlaceholder?: string;
  selectedTemplateId?: string;
  cloningTemplateId?: string | null;
  onClone?: (template: T) => void;
}

export default function TemplatePickerDialog<T extends TemplatePickerItem>({
  open,
  title,
  description,
  templates,
  onClose,
  onSelect,
  libraryHref,
  emptyMessage,
  searchPlaceholder = 'Search templates',
  selectedTemplateId,
  cloningTemplateId,
  onClone,
}: TemplatePickerDialogProps<T>) {
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.description ?? ''} ${template.channel}`.toLocaleLowerCase().includes(query)
    );
  }, [search, templates]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    searchInputRef.current?.focus();
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current
        ? Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        : [];
      if (!focusable.length) return;
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
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="templatePickerTitle"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id="templatePickerTitle">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close template selector">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <label className={styles.searchField}>
          <span>Search templates</span>
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </label>
        {filteredTemplates.length === 0 ? (
          <p className={styles.emptyMessage}>
            {templates.length === 0 ? (
              <>
                {emptyMessage}{' '}
                <Link href={libraryHref} target="_blank" rel="noreferrer">Open Templates library</Link>.
              </>
            ) : (
              'No templates match your search.'
            )}
          </p>
        ) : (
          <div className={styles.templateList}>
            {filteredTemplates.map((template) => (
              <article className={styles.templateOption} key={template.id}>
                <div className={styles.templateDetails}>
                  <strong>{template.name}</strong>
                  <span>{template.isSystem ? 'System template' : 'Practice template'} · {template.channel.toUpperCase()}</span>
                  {template.description && <p>{template.description}</p>}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.actionButton}
                    aria-pressed={selectedTemplateId === template.id}
                    onClick={() => onSelect(template)}
                  >
                    Select
                  </button>
                  {onClone && template.isSystem && (
                    <button
                      type="button"
                      className={styles.actionButton}
                      disabled={cloningTemplateId !== undefined && cloningTemplateId !== null}
                      onClick={() => onClone(template)}
                    >
                      {cloningTemplateId === template.id ? 'Cloning…' : 'Clone'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <footer className={styles.footer}>
          <Link href={libraryHref} target="_blank" rel="noreferrer">Open Templates library</Link>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
