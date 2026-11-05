import { useCallback } from 'react';

export function useRichTextFormatting() {
  const applyFormat = useCallback((command: string, value?: string) => {
    // Save current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Apply formatting based on command
    switch (command) {
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
      case 'ul':
        document.execCommand('insertUnorderedList', false);
        break;
      case 'insertOrderedList':
      case 'ol':
        document.execCommand('insertOrderedList', false);
        break;
      case 'createLink':
      case 'link': {
        const url = value || prompt('Enter URL:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          // Style the link
          const links = document.querySelectorAll('a[href]:not([style])');
          links.forEach((link) => {
            (link as HTMLElement).style.color = '#2563eb';
            (link as HTMLElement).style.textDecoration = 'underline';
          });
        }
        break;
      }
      case 'removeFormat':
        document.execCommand('removeFormat', false);
        break;
      default:
        if (value !== undefined) {
          document.execCommand(command, false, value);
        }
    }
  }, []);

  return { applyFormat };
}
