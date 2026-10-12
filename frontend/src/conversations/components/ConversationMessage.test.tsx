vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { role: 'member' } }),
}));
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationMessage as Message } from '../api/conversation-api';
import { ConversationMessage } from './ConversationMessage';

vi.mock('../../agent/components/MessageAnalysisDetails', () => ({
  MessageAnalysisDetails: ({
    answerMarkdown,
    footerActions,
  }: {
    answerMarkdown: string;
    footerActions?: ReactNode;
  }) => (
    <>
      <div className="assistant-card-body">
        <div className="assistant-card-content">{answerMarkdown.replaceAll('**', '')}</div>
        <div className="assistant-card-artifacts">Chart artifact</div>
      </div>
      {footerActions ? (
        <footer className="assistant-card-footer">
          {footerActions}
        </footer>
      ) : null}
    </>
  ),
}));

const assistantMessage: Message = {
  id: 'message-1',
  conversation_id: 'conversation-1',
  role: 'assistant',
  content: '**Revenue declined 8%.**',
  job_id: 'job-1',
  metadata: {},
  created_at: '2026-09-16T12:00:00Z',
};

describe('ConversationMessage', () => {
  const renderMessage = (message: Message) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ConversationMessage message={message} />
      </QueryClientProvider>,
    );

  it('renders content and artifacts before the padded footer actions, without a header', () => {
    renderMessage(assistantMessage);

    const card = document.querySelector('.assistant-card');
    expect(card?.querySelector(':scope > .assistant-card-header')).toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-body .assistant-card-content')).not.toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-body .assistant-card-artifacts')).not.toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-footer')).not.toBeNull();
    expect(card?.querySelector('.assistant-card-footer .assistant-card-actions')).not.toBeNull();
    expect(screen.getByText('Revenue declined 8%.')).toBeInTheDocument();
  });

  it.each([null, 'job-1'])('shows suggestions outside the answer card and hides them while presenting (job %s)', async (jobId) => {
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}>
      <ConversationMessage message={{ ...assistantMessage, job_id: jobId, metadata: { follow_up_suggestions: ['Compare regions?'] } }} showSuggestions onFollowUp={vi.fn()} />
    </QueryClientProvider>);
    const region = screen.getByRole('region', { name: 'Suggested follow-ups' });
    expect(region.previousElementSibling).toHaveClass('assistant-card');
    expect(region.closest('.assistant-card')).toBeNull();
    expect(region.previousElementSibling?.lastElementChild).toHaveClass('assistant-card-footer');
    await user.click(screen.getByRole('button', { name: 'Present answer' }));
    expect(screen.queryByRole('region', { name: 'Suggested follow-ups' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Compare regions?' })).toBeInTheDocument();
  });

  it('offers heading tabs for assistant messages without an execution job', async () => {
    const user = userEvent.setup();
    renderMessage({
      ...assistantMessage,
      job_id: null,
      content: '# Report\n\n## Summary\nFirst.\n\n## Detail\nSecond.',
    });

    const card = document.querySelector('.assistant-card');
    expect(card?.firstElementChild).toHaveClass('assistant-card-body');
    expect(card?.lastElementChild).toHaveClass('assistant-card-footer');
    expect(card?.querySelector('.answer-main-content')).not.toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByText('Second.')).toBeInTheDocument();
    expect(screen.queryByText('First.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).not.toBeInTheDocument();
  });

  it('scrolls ahead when the selected tab approaches the visible right edge', async () => {
    const user = userEvent.setup();
    renderMessage({
      ...assistantMessage,
      job_id: null,
      content: '# Report\n\n## Summary\nFirst.\n\n## Detail\nSecond.\n\n## Actions\nThird.',
    });

    const scroller = document.querySelector<HTMLElement>('[data-slot="scroll-shadow"]')!;
    const selectedTab = screen.getByRole('tab', { name: 'Summary' });
    const nextTab = screen.getByRole('tab', { name: 'Detail' });
    const bounds = (left: number, right: number) =>
      ({ left, right, top: 0, bottom: 40, width: right - left, height: 40 }) as DOMRect;
    const scrollBy = vi.fn();
    Object.defineProperty(scroller, 'scrollBy', { configurable: true, value: scrollBy });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(bounds(0, 300));
    vi.spyOn(selectedTab, 'getBoundingClientRect').mockReturnValue(bounds(190, 280));
    vi.spyOn(nextTab, 'getBoundingClientRect').mockReturnValue(bounds(280, 400));

    await user.click(selectedTab);
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 112, behavior: 'smooth' }),
    );
  });

  it('scrolls left to reveal the preceding tab when navigating back', async () => {
    const user = userEvent.setup();
    renderMessage({
      ...assistantMessage,
      job_id: null,
      content: '# Report\n\n## Summary\nFirst.\n\n## Detail\nSecond.\n\n## Actions\nThird.',
    });

    const scroller = document.querySelector<HTMLElement>('[data-slot="scroll-shadow"]')!;
    const previousTab = screen.getByRole('tab', { name: 'Summary' });
    const selectedTab = screen.getByRole('tab', { name: 'Detail' });
    const nextTab = screen.getByRole('tab', { name: 'Actions' });
    const bounds = (left: number, right: number) =>
      ({ left, right, top: 0, bottom: 40, width: right - left, height: 40 }) as DOMRect;
    const scrollBy = vi.fn();
    Object.defineProperty(scroller, 'scrollBy', { configurable: true, value: scrollBy });
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(bounds(0, 300));
    vi.spyOn(previousTab, 'getBoundingClientRect').mockReturnValue(bounds(-100, 15));
    vi.spyOn(selectedTab, 'getBoundingClientRect').mockReturnValue(bounds(15, 120));
    vi.spyOn(nextTab, 'getBoundingClientRect').mockReturnValue(bounds(120, 420));

    await user.click(nextTab);
    scrollBy.mockClear();
    await user.click(selectedTab);
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: -112, behavior: 'smooth' }),
    );
  });

  it.each(['No heading, just an answer.', '# Only heading\n\nAnswer text.'])(
    'shows no tabs when the answer has fewer than two section headings',
    (content) => {
      renderMessage({ ...assistantMessage, job_id: null, content });
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(
        screen.getByText(content.startsWith('#') ? 'Answer text.' : content),
      ).toBeInTheDocument();
    },
  );

  it('keeps the question and answer while hiding author labels and timestamps', () => {
    const { rerender } = renderMessage({
      ...assistantMessage,
      role: 'user',
      content: 'What changed?',
    });
    expect(screen.getByText('What changed?')).toBeInTheDocument();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ConversationMessage message={{ ...assistantMessage, job_id: null }} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Revenue declined 8%.')).toBeInTheDocument();
    expect(screen.queryByText('Data Agent')).not.toBeInTheDocument();
    expect(document.querySelector('.assistant-card time')).toBeNull();
  });

  it('starts a presentation at the full answer and closes with Escape', async () => {
    const user = userEvent.setup();
    renderMessage({
      ...assistantMessage,
      job_id: null,
      content: '# Report\n\n## Summary\nFirst.\n\n## Detail\nSecond.',
    });

    await user.click(screen.getByRole('tab', { name: 'Detail' }));
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Present answer' }));
    expect(document.body.querySelector('.assistant-card--presenting')).not.toBeNull();
    const presentation = screen.getByRole('dialog', { name: 'Answer presentation' });
    const toolbar = screen.getByLabelText('Presentation controls');
    expect(presentation.firstElementChild).toBe(toolbar);
    expect(within(toolbar).getByRole('button', { name: 'Exit presentation' })).toBeInTheDocument();
    expect(presentation.querySelector('footer')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('tab', { name: 'Full answer' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Go to beginning' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to end' })).toBeInTheDocument();
    expect(screen.getByText('First.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous section' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next section' }));
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Next section' })).toBeDisabled();
    await user.keyboard('{PageUp}');
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Full answer' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Detail' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Previous section' }));
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Escape}');
    expect(document.body.querySelector('.assistant-card--presenting')).toBeNull();
    expect(screen.getByRole('button', { name: 'Present answer' })).toBeInTheDocument();
    expect(document.querySelector('.assistant-card-footer')).not.toBeNull();
    expect(screen.queryByLabelText('Presentation controls')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps a heading-free presentation as one answer without section controls', async () => {
    const user = userEvent.setup();
    renderMessage({ ...assistantMessage, job_id: null, content: 'A short answer.' });

    await user.click(screen.getByRole('button', { name: 'Present answer' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next section' })).not.toBeInTheDocument();
    expect(screen.getByText('A short answer.')).toBeInTheDocument();
  });

  it('places job-backed presentation actions above the content with no empty footer', async () => {
    const user = userEvent.setup();
    renderMessage(assistantMessage);

    await user.click(screen.getByRole('button', { name: 'Present answer' }));
    const presentation = screen.getByRole('dialog', { name: 'Answer presentation' });
    expect(presentation.firstElementChild).toHaveClass('assistant-presentation-toolbar');
    expect(presentation.lastElementChild).toHaveClass('assistant-card-body');
    expect(presentation.querySelector('footer')).toBeNull();
    expect(within(presentation).getByText('Chart artifact')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exit presentation' }));
    expect(document.querySelector('.assistant-card')?.lastElementChild).toHaveClass('assistant-card-footer');
  });
});
