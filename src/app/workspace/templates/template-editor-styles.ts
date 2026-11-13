import type { CSSProperties } from 'react';
import type { CanvasBlock, CanvasSection } from '@/lib/templates/document-schema';

export interface TemplateEditorStyle extends CSSProperties {
  [property: `--${string}`]: string | number;
}

export function getSectionStyle(section: CanvasSection): TemplateEditorStyle {
  return {
    '--section-background': section.backgroundColor || 'var(--color-surface)',
    '--section-padding': section.padding || 'var(--space-4)',
  };
}

export function getBlockStyle(block: CanvasBlock): TemplateEditorStyle {
  const defaultColor = block.type === 'button'
    ? 'var(--color-surface)'
    : block.type === 'paragraph' || block.type === 'footer'
      ? 'var(--color-text-muted)'
      : 'var(--color-text)';
  const defaultFontSize = block.type === 'heading'
    ? 'var(--font-size-xl)'
    : block.type === 'footer'
      ? 'var(--font-size-xs)'
      : 'var(--font-size-md)';

  return {
    '--block-color': block.properties.color || defaultColor,
    '--block-font-size': block.properties.fontSize || defaultFontSize,
    '--block-font-family': block.properties.fontFamily || 'var(--font-sans)',
    '--block-alignment': block.properties.alignment || 'left',
    '--block-width': block.properties.width || (block.type === 'logo' ? '7.5rem' : '100%'),
    '--block-height': block.properties.height || '1.25rem',
    '--block-background': block.properties.backgroundColor || 'var(--color-primary)',
  };
}
