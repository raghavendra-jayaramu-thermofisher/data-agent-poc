import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DeleteAllChatsModal } from './DeleteAllChatsModal';

const mockMutateAsync = vi.fn();
vi.mock('../hooks/useConversations', () => ({
  useDeleteAllConversations: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('DeleteAllChatsModal', () => {
  it('does not render when closed', () => {
    render(
      <MemoryRouter>
        <DeleteAllChatsModal isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog', { name: 'Delete all chats' })).not.toBeInTheDocument();
  });

  it('renders confirmation dialog and cancels without deleting', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DeleteAllChatsModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('dialog', { name: 'Delete all chats' })).toBeInTheDocument();
    expect(
      screen.getByText(/All chats and their message history in this workspace will be permanently deleted/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handleClose).toHaveBeenCalled();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('triggers delete all and navigates to /ask when inside a conversation', async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/conversations/123']}>
        <Routes>
          <Route
            path="/conversations/:id"
            element={
              <div>
                <span>Conversation Page</span>
                <DeleteAllChatsModal isOpen={true} onClose={handleClose} />
              </div>
            }
          />
          <Route path="/ask" element={<div>Ask Landing Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete all chats' }));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Ask Landing Page')).toBeInTheDocument();
    expect(handleClose).toHaveBeenCalled();
  });

  it('displays error message when deletion fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network error deleting chats'));
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DeleteAllChatsModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Delete all chats' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error deleting chats');
    expect(handleClose).not.toHaveBeenCalled();
  });
});
