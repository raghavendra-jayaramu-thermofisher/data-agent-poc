import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Conversation } from '../api/conversation-api';
import { ConversationListItemContent } from './ConversationListItemContent';

const conversation: Conversation = {
  id: 'c1', organization_id: 'o1', created_by: 'u1', model_profile_id: null,
  title: 'Quarterly Revenue Analysis', created_at: '2026-10-06T09:00:00Z', updated_at: '2026-10-06T09:00:00Z',
};
describe('conversation review indicators', () => {
  it('uses an icon without an extra review label for one correct answer', () => {
    render(<ConversationListItemContent conversation={{ ...conversation, answer_review_counts: { total: 1, correct: 1, partially_correct: 0, incorrect: 0, unreviewed: 0 } }} />);
    expect(screen.getByRole('img', { name: /1 reviewed · 0 unreviewed/ })).toHaveClass('text-green-700');
    expect(screen.queryByText('1 reviewed · 0 unreviewed')).not.toBeInTheDocument();
  });
  it('shows mixed coverage without marking the conversation fully correct', () => {
    render(<ConversationListItemContent conversation={{ ...conversation, answer_review_counts: { total: 3, correct: 2, partially_correct: 0, incorrect: 0, unreviewed: 1 } }} />);
    expect(screen.getByText('2 reviewed · 1 unreviewed')).toBeInTheDocument();
    expect(screen.getByRole('img')).not.toHaveClass('text-green-700');
  });
  it.each([
    [{ total: 2, correct: 1, partially_correct: 1, incorrect: 0, unreviewed: 0 }, 'text-amber-700', /1 partially correct/],
    [{ total: 3, correct: 1, partially_correct: 1, incorrect: 1, unreviewed: 0 }, 'text-red-700', /1 incorrect/],
  ])('distinguishes partial and incorrect results from review coverage', (counts, color, label) => {
    render(<ConversationListItemContent conversation={{ ...conversation, answer_review_counts: counts }} />);
    expect(screen.getByRole('img', { name: label })).toHaveClass(color);
  });
  it('keeps unreviewed or empty conversations neutral', () => {
    render(<ConversationListItemContent conversation={conversation} />);
    expect(screen.getByRole('img', { name: 'No answers yet' })).toHaveClass('text-[#8B848C]');
  });
});
