'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import styles from './ContentEditableBlock.module.css';

interface ContentEditableBlockProps {
  html: string;
  onChange: (html: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export default function ContentEditableBlock({
  html,
  onChange,
  className = '',
  style = {},
  placeholder = 'Start typing...',
  disabled = false,
  onClick,
}: ContentEditableBlockProps) {
  const editableRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef(html);

  // Update content when html prop changes from outside
  useEffect(() => {
    if (editableRef.current && editableRef.current.innerHTML !== html) {
      const selection = window.getSelection();
      const isEditorFocused = editableRef.current.contains(document.activeElement);
      
      if (!isEditorFocused) {
        editableRef.current.innerHTML = html || '';
        lastHtmlRef.current = html;
      }
    }
  }, [html]);

  const handleInput = useCallback(() => {
    if (editableRef.current) {
      const newHtml = editableRef.current.innerHTML;
      if (newHtml !== lastHtmlRef.current) {
        lastHtmlRef.current = newHtml;
        onChange(newHtml);
      }
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Allow keyboard shortcuts to bubble up for toolbar handling
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
        case 'i':
        case 'u':
          // Let the default behavior handle it
          break;
        case 'k':
          e.preventDefault();
          const url = prompt('Enter URL:', 'https://');
          if (url) {
            document.execCommand('createLink', false, url);
          }
          break;
      }
    }
  }, []);

  useEffect(() => {
    // Initialize content
    if (editableRef.current && !editableRef.current.innerHTML) {
      editableRef.current.innerHTML = html || '';
      lastHtmlRef.current = html;
    }
  }, []);

  return (
    <div
      ref={editableRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className={`${styles.editable} ${className}`}
      style={style}
      data-placeholder={placeholder}
      spellCheck
    />
  );
}
