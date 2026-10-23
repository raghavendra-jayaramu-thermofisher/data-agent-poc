import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClarificationRequest } from '../clarification';
import { ClarificationCard } from './ClarificationCard';

const request: ClarificationRequest = {
  reason: 'Division and period change the totals.',
  questions: [
    {
      id: 'division',
      kind: 'choice',
      prompt: 'Which division?',
      options: [{ label: 'BID' }, { label: 'LSG' }, { label: 'Other', is_other: true }],
    },
    {
      id: 'regions',
      kind: 'choice',
      prompt: 'Which regions?',
      multiple: true,
      options: [{ label: 'ANZ' }, { label: 'Japan' }, { label: 'Other', is_other: true }],
    },
    { id: 'exclude', kind: 'text', prompt: 'Anything to exclude?', required: false },
  ],
};

function renderCard(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<ClarificationCard request={request} answered={null} canAnswer onSubmit={onSubmit} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('ClarificationCard', () => {
  it('asks every question in one card with "Other" and a free-text box', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { name: 'A few questions before I continue' }),
    ).toBeInTheDocument();
    const division = screen.getByRole('group', { name: /Which division\?/ });
    expect(
      within(division)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')!.textContent),
    ).toEqual(['BID', 'LSG', 'Other']);
    expect(
      within(screen.getByRole('group', { name: /Which regions\?/ })).getAllByRole('checkbox'),
    ).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Anything to exclude?' })).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('requires answers and text for "Other" before sending all answers together', async () => {
    const { onSubmit, user } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Send answers' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('Choose an option.')).toHaveLength(2);

    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.click(screen.getByRole('checkbox', { name: 'ANZ' }));
    await user.click(screen.getByRole('checkbox', { name: 'Japan' }));
    await user.click(screen.getByRole('button', { name: 'Send answers' }));
    expect(screen.getByText("Describe your answer for 'Other'.")).toBeInTheDocument();

    await user.type(
      screen.getByRole('textbox', { name: 'Other answer for: Which division?' }),
      'Clinical',
    );
    await user.type(screen.getByRole('textbox', { name: 'Anything to exclude?' }), 'Samples');
    await user.click(screen.getByRole('button', { name: 'Send answers' }));
    expect(onSubmit).toHaveBeenCalledWith([
      { question_id: 'division', selected: ['Other'], other_text: 'Clinical' },
      { question_id: 'regions', selected: ['ANZ', 'Japan'] },
      { question_id: 'exclude', text: 'Samples' },
    ]);
    expect(await screen.findByText('Other: Clinical')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send answers' })).not.toBeInTheDocument();
  });

  it('shows server validation messages next to the question', async () => {
    const onSubmit = vi.fn().mockRejectedValue({
      code: 'CLARIFICATION_ANSWER_INVALID',
      message: 'Some answers need attention.',
      fieldErrors: { division: 'Choose from the listed options.' },
    });
    const { user } = renderCard(onSubmit);
    await user.click(screen.getByRole('radio', { name: 'BID' }));
    await user.click(screen.getByRole('checkbox', { name: 'ANZ' }));
    await user.click(screen.getByRole('button', { name: 'Send answers' }));
    expect(await screen.findByText('Choose from the listed options.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Some answers need attention.');
    expect(screen.getByRole('group', { name: /Which division\?/ })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows saved answers read-only and closed questions as not answered', () => {
    const { rerender } = render(
      <ClarificationCard
        request={request}
        answered={[
          { question_id: 'division', selected: ['BID'] },
          { question_id: 'regions', selected: ['Japan', 'Other'], other_text: 'Korea' },
          { question_id: 'exclude', text: null },
        ]}
        canAnswer
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('BID')).toBeInTheDocument();
    expect(screen.getByText('Japan; Other: Korea')).toBeInTheDocument();
    expect(screen.getByText('No answer')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(
      <ClarificationCard request={request} answered={null} canAnswer={false} onSubmit={vi.fn()} />,
    );
    expect(screen.getAllByText('Not answered')).toHaveLength(3);
  });
});
