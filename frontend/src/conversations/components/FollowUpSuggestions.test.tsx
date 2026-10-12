import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FollowUpSuggestions } from './FollowUpSuggestions';

describe('FollowUpSuggestions', () => {
  it('shows only valid distinct questions as text', () => {
    render(<FollowUpSuggestions suggestions={['Compare regions?', 'Compare regions?', '', 123, '<script>text</script>', 'x'.repeat(601)]} onSubmit={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '<script>text</script>' })).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
  it('keeps more than three questions and allows longer questions', () => {
    const longerQuestion = 'Which orders explain the change, considering the selected snapshot and exclusions? '.repeat(4).trim();
    render(<FollowUpSuggestions suggestions={['Compare regions?', 'Compare weeks?', 'Show aging?', longerQuestion]} onSubmit={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByRole('button', { name: longerQuestion })).toBeInTheDocument();
  });
  it('does not show an empty suggestions area', () => {
    render(<FollowUpSuggestions suggestions={undefined} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
  it('prevents duplicate requests and lets a failed request be retried', async () => {
    let reject!: (error: Error) => void;
    const onSubmit = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; })).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FollowUpSuggestions suggestions={['Compare regions?']} onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: 'Compare regions?' });
    await user.dblClick(button);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    await act(async () => reject(new Error('Network unavailable')));
    expect(screen.getByRole('alert')).toHaveTextContent('Please try again');
    await user.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('disables suggestions during an active analysis', () => {
    render(<FollowUpSuggestions suggestions={['Compare regions?']} onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Compare regions?' })).toBeDisabled();
  });
});
