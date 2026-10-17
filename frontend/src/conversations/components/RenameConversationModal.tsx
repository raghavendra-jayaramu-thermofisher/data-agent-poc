import { Button, Modal } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { FormField } from '../../auth/components/FormField';
import { useRenameConversation } from '../hooks/useConversations';

export function RenameConversationModal({
  id,
  title,
  defaultOpen = false,
  hideTrigger = false,
  onClose,
}: {
  id: string;
  title: string | null;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
  onClose?(): void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState(title ?? '');
  const [error, setError] = useState<string | null>(null);
  const rename = useRenameConversation();
  function close() {
    setOpen(false);
    onClose?.();
  }

  async function save() {
    const cleaned = draft.trim();
    if (!cleaned) {
      setError('Enter a chat title.');
      return;
    }
    setError(null);
    try {
      await rename.mutateAsync({ id, title: cleaned });
      close();
    } catch (caught) {
      setError((caught as { message?: string }).message ?? 'Unable to rename the chat.');
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          className="conversation-header-icon"
          aria-label="Rename chat"
          title="Rename chat"
          onClick={() => {
            setDraft(title ?? '');
            setError(null);
            setOpen(true);
          }}
        >
          <Pencil size={15} />
        </button>
      )}
      <Modal.Backdrop
        isOpen={open}
        isDismissable={!rename.isPending}
        isKeyboardDismissDisabled={rename.isPending}
        onOpenChange={(value) => {
          if (!rename.isPending && !value) close();
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog className="conversation-management-dialog">
            <Modal.CloseTrigger isDisabled={rename.isPending} />
            <Modal.Header>
              <Modal.Heading>Rename chat</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form
                id={`rename-chat-${id}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!rename.isPending) void save();
                }}
              >
                <FormField
                  label="Chat title"
                  value={draft}
                  maxLength={240}
                  autoFocus
                  disabled={rename.isPending}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  error={error ?? undefined}
                />
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" isDisabled={rename.isPending} onPress={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form={`rename-chat-${id}`}
                isPending={rename.isPending}
              >
                Save
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
