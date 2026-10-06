import { render as renderUI, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { queryKeys } from '../../api/queryKeys';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnswerVerification } from './AnswerVerification';
import type { ConversationMessage } from '../api/conversation-api';
const state = vi.hoisted(() => ({ role: 'admin', save: vi.fn() }));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: 'org-1', role: state.role } }) }));
vi.mock('../api/conversation-api', () => ({ saveVerification: state.save }));
const message: ConversationMessage = { id: 'm1', conversation_id: 'c1', role: 'assistant', content: 'Answer', metadata: {}, job_id: null, created_at: '2026-10-06T09:00:00Z' };
function render(ui: ReactElement) {
  return renderUI(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
}
describe('answer verification', () => {
  it('shows only a collapsed badge initially and expands the safe Markdown summary', async () => {
    render(<AnswerVerification message={{ ...message, verification_status: 'CORRECT', verification_summary: '**Checked totals** <script>alert(1)</script>', verified_by_name: 'Reviewer', verified_at: message.created_at }} />);
    const badge = screen.getByLabelText('Verified · Correct');
    expect(badge.closest('details')).not.toHaveAttribute('open');
    await userEvent.setup().click(badge);
    expect(badge.closest('details')).toHaveAttribute('open');
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText(/Reviewed by Reviewer/)).toBeInTheDocument();
  });
  it('saves a partial review and displays its percentage', async () => {
    const user = userEvent.setup();
    state.save.mockResolvedValue({ ...message, verification_status: 'PARTIALLY_CORRECT', verification_percentage: 80, verification_summary: '8 of 10 claims match.' });
    render(<AnswerVerification message={message} />);
    await user.click(screen.getByLabelText('Not verified'));
    await user.click(screen.getByText('Verify answer'));
    await user.selectOptions(screen.getByLabelText('Verification status'), 'PARTIALLY_CORRECT');
    await user.type(screen.getByLabelText(/Correctness percentage/), '80');
    await user.type(screen.getByLabelText('Verification summary (Markdown)'), '8 of 10 claims match.');
    await user.click(screen.getByText('Save verification'));
    await waitFor(() => expect(screen.getByLabelText('Verified · Partially correct · 80%')).toBeInTheDocument());
    expect(state.save).toHaveBeenCalledWith(message, { verification_status: 'PARTIALLY_CORRECT', verification_percentage: 80, verification_summary: '8 of 10 claims match.' });
  });
  it('allows members to view reviews without edit controls', async () => {
    state.role = 'member';
    render(<AnswerVerification message={message} />);
    await userEvent.setup().click(screen.getByLabelText('Not verified'));
    expect(screen.queryByText('Verify answer')).not.toBeInTheDocument();
    state.role = 'admin';
  });
  it('refreshes sidebar review counts when verification is cleared', async () => {
    const client = new QueryClient();
    const key = queryKeys.conversations.list('org-1');
    client.setQueryData(key, [{ id: 'c1' }]);
    state.save.mockResolvedValue({ ...message, verification_status: null });
    renderUI(<QueryClientProvider client={client}><AnswerVerification message={{ ...message, verification_status: 'CORRECT', verification_summary: 'Checked.' }} /></QueryClientProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Verified · Correct'));
    await user.click(screen.getByText('Clear verification'));
    await waitFor(() => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(screen.getByLabelText('Not verified')).toBeInTheDocument();
  });
});
