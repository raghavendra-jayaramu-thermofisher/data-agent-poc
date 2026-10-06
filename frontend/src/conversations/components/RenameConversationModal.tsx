import { Button, Modal } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { FormField } from '../../auth/components/FormField';
import { useRenameConversation } from '../hooks/useConversations';

export function RenameConversationModal({ id, title }: { id: string; title: string | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rename = useRenameConversation();

  async function save() {
    const cleaned = draft.trim();
    if (!cleaned) {
      setError('Enter a chat title.');
      return;
    }
    setError(null);
    try {
      await rename.mutateAsync({ id, title: cleaned });
      setOpen(false);
    } catch (caught) {
      setError((caught as { message?: string }).message ?? 'Unable to rename the chat.');
    }
  }

  return (
    <>
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
      <Modal.Backdrop
        isOpen={open}
        isDismissable={!rename.isPending}
        isKeyboardDismissDisabled={rename.isPending}
        onOpenChange={(value) => {
          if (!rename.isPending) setOpen(value);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
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
              <Button
                variant="secondary"
                isDisabled={rename.isPending}
                onPress={() => setOpen(false)}
              >
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
