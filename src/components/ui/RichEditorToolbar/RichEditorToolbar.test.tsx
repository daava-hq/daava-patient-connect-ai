import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasBlock } from '@/lib/templates/document-schema';
import RichEditorToolbar from './RichEditorToolbar';

describe('RichEditorToolbar', () => {
  it('runs formatting actions from button clicks and updates text properties', () => {
    const onFormat = vi.fn();
    const onPropChange = vi.fn();
    const activeBlock: CanvasBlock = {
      id: 'block-1',
      type: 'paragraph',
      properties: { text: 'Message' },
    };

    render(
      <RichEditorToolbar
        activeBlock={activeBlock}
        onFormat={onFormat}
        onPropChange={onPropChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bold (Ctrl+B)' }));
    expect(onFormat).toHaveBeenCalledWith('block-1', 'bold', undefined);

    fireEvent.change(screen.getByRole('combobox', { name: 'Font family' }), {
      target: { value: 'serif' },
    });
    expect(onPropChange).toHaveBeenCalledWith('block-1', 'fontFamily', 'serif');
  });
});
