import { Button, Modal } from '@heroui/react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useDeleteAllConversations } from '../hooks/useConversations';

export function DeleteAllChatsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const removeAll = useDeleteAllConversations();
  const navigate = useNavigate();
  const location = useLocation();

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleDeleteAll() {
    try {
      setError(null);
      await removeAll.mutateAsync();
      if (location.pathname.startsWith('/conversations/')) {
        void navigate('/ask', { replace: true });
      }
      handleClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to delete all chats. Please try again.',
      );
    }
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      isDismissable={!removeAll.isPending}
      isKeyboardDismissDisabled={removeAll.isPending}
      onOpenChange={(open) => {
        if (!open && !removeAll.isPending) handleClose();
      }}
    >
      <Modal.Container size="sm">
        <Modal.Dialog aria-label="Delete all chats" className="conversation-management-dialog">
          <Modal.Header>
            <Modal.Heading>Delete all chats?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>
              All chats and their message history in this workspace will be permanently deleted.
              This action cannot be undone.
            </p>
            {error && (
              <p role="alert" className="text-danger mt-2">
                {error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" isDisabled={removeAll.isPending} onPress={handleClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={removeAll.isPending}
              onPress={() => void handleDeleteAll()}
            >
              Delete all chats
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
