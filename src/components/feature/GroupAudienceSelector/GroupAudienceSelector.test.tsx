import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GroupAudienceSelector from './GroupAudienceSelector';

const groups = [
  { id: 'group-static', name: 'New patients', groupType: 'static' as const },
  { id: 'group-dynamic', name: 'Adults', groupType: 'dynamic' as const },
];

describe('GroupAudienceSelector', () => {
  it('updates selected groups and explains the all-eligible default', () => {
    const onChange = vi.fn();
    render(
      <GroupAudienceSelector
        groups={groups}
        selectedGroupIds={[]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText(/Adults/));

    expect(onChange).toHaveBeenCalledWith(['group-dynamic']);
    expect(screen.getByText(/Leave all unchecked to include all eligible patients/)).toBeTruthy();
  });

  it('offers removal of selected groups that are no longer active', () => {
    const onChange = vi.fn();
    render(
      <GroupAudienceSelector
        groups={groups}
        selectedGroupIds={['group-static', 'archived-group']}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable groups' }));

    expect(onChange).toHaveBeenCalledWith(['group-static']);
  });

  it('keeps the retry action available when option loading fails', () => {
    const onRetry = vi.fn();
    render(
      <GroupAudienceSelector
        groups={[]}
        selectedGroupIds={[]}
        onChange={vi.fn()}
        error="Unable to load groups"
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
