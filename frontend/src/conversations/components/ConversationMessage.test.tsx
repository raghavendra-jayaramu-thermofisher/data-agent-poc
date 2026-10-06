vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { role: 'member' } }) }));
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationMessage as Message } from '../api/conversation-api';
import { ConversationMessage } from './ConversationMessage';

vi.mock('../../agent/components/MessageAnalysisDetails', () => ({
  MessageAnalysisDetails: ({ answerMarkdown }: { answerMarkdown: string }) => (
    <>
      <div className="assistant-card-content">{answerMarkdown.replaceAll('**', '')}</div>
      <div className="assistant-card-artifacts">Chart artifact</div>
      <footer className="assistant-card-footer">Compact execution ledger</footer>
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
  it('renders assistant responses as separate header, content, artifact, and footer regions', () => {
    render(<ConversationMessage message={assistantMessage} />);

    const card = document.querySelector('.assistant-card');
    expect(card?.querySelector(':scope > .assistant-card-header')).not.toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-content')).not.toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-artifacts')).not.toBeNull();
    expect(card?.querySelector(':scope > .assistant-card-footer')).not.toBeNull();
    expect(screen.getByText('Revenue declined 8%.')).toBeInTheDocument();
  });
});
