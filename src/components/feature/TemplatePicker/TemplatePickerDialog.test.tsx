import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemplatePickerDialog from './TemplatePickerDialog';

const templates = [
  { id: 'one', name: 'Spring reminder', channel: 'email', status: 'published', isSystem: false },
  { id: 'two', name: 'Birthday wishes', channel: 'email', status: 'published', isSystem: true, description: 'A birthday email template' },
];

describe('TemplatePickerDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('searches templates and selects the matching template', () => {
    const onSelect = vi.fn();
    render(
      <TemplatePickerDialog
        open
        title="Templates"
        description="Select a template"
        templates={templates}
        onClose={vi.fn()}
        onSelect={onSelect}
        libraryHref="/workspace/templates"
        emptyMessage="No templates available."
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), { target: { value: 'birthday' } });

    const dialog = screen.getByRole('dialog', { name: 'Templates' });
    expect(within(dialog).getByText('Birthday wishes')).toBeDefined();
    expect(within(dialog).queryByText('Spring reminder')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select' }));
    expect(onSelect).toHaveBeenCalledWith(templates[1]);
  });

  it('shows an empty state when no template matches the search', () => {
    render(
      <TemplatePickerDialog
        open
        title="Templates"
        description="Select a template"
        templates={templates}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        libraryHref="/workspace/templates"
        emptyMessage="No templates available."
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search templates' }), { target: { value: 'recall' } });
    expect(screen.getByText('No templates match your search.')).toBeDefined();
  });

  it('offers cloning only for system templates', () => {
    const onClone = vi.fn();
    render(
      <TemplatePickerDialog
        open
        title="Templates"
        description="Select a template"
        templates={templates}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        onClone={onClone}
        libraryHref="/workspace/templates"
        emptyMessage="No templates available."
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Templates' });
    const systemTemplate = within(dialog).getByText('Birthday wishes').closest('article');
    const practiceTemplate = within(dialog).getByText('Spring reminder').closest('article');

    if (!systemTemplate || !practiceTemplate) throw new Error('Expected both template cards to be rendered.');
    fireEvent.click(within(systemTemplate).getByRole('button', { name: 'Clone' }));
    expect(onClone).toHaveBeenCalledWith(templates[1]);
    expect(within(practiceTemplate).queryByRole('button', { name: 'Clone' })).toBeNull();
  });
});
