import { Button, Dropdown, Label, Modal } from '@heroui/react';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Database, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useDeleteConversation } from '../hooks/useConversations';
import { RenameConversationModal } from './RenameConversationModal';
import type { SourceTableScope } from './table-scope';

export function ConversationActions({
  id,
  title,
  sources,
  tableScope = [],
  compact = false,
}: {
  id: string;
  title: string | null;
  sources?: Array<{ id: string; name: string }>;
  tableScope?: SourceTableScope[];
  compact?: boolean;
}) {
  const [dialog, setDialog] = useState<'rename' | 'delete' | 'details' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const focusVersion = useRef(0);
  const remove = useDeleteConversation();
  const navigate = useNavigate();
  const location = useLocation();
  const label = title?.trim() || 'Untitled analysis';
  function close() {
    setDialog(null);
    setError(null);
    const version = ++focusVersion.current;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (version === focusVersion.current) trigger.current?.focus({ preventScroll: true });
      }),
    );
  }
  async function deleteChat() {
    try {
      await remove.mutateAsync(id);
      if (location.pathname === `/conversations/${id}`) void navigate('/ask', { replace: true });
      close();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to delete the chat. Please try again.',
      );
    }
  }
  return (
    <>
      <Dropdown>
        <Dropdown.Trigger
          ref={trigger}
          onPress={() => {
            focusVersion.current++;
          }}
          className={`shell-icon-button conversation-actions-trigger ${compact ? 'conversation-actions-trigger--compact' : ''}`}
          aria-label={compact ? `Actions for ${label}` : 'Conversation actions'}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </Dropdown.Trigger>
        <Dropdown.Popover className="shell-popover">
          <Dropdown.Menu
            aria-label={`Actions for ${label}`}
            onAction={(key) => {
              trigger.current?.focus();
              setError(null);
              setDialog(key as 'rename' | 'delete' | 'details');
            }}
          >
            <Dropdown.Item id="rename" textValue="Rename chat">
              <Pencil size={15} />
              <Label>Rename chat</Label>
            </Dropdown.Item>
            {sources !== undefined && (
              <Dropdown.Item id="details" textValue="Conversation details">
                <Database size={15} />
                <Label>Conversation details</Label>
              </Dropdown.Item>
            )}
            <Dropdown.Item id="delete" textValue="Delete chat" variant="danger">
              <Trash2 size={15} />
              <Label>Delete chat</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {dialog === 'rename' && (
        <RenameConversationModal id={id} title={title} defaultOpen hideTrigger onClose={close} />
      )}
      {dialog === 'delete' && (
        <Modal.Backdrop
          isOpen
          isDismissable={!remove.isPending}
          isKeyboardDismissDisabled={remove.isPending}
          onOpenChange={(open) => {
            if (!open && !remove.isPending) close();
          }}
        >
          <Modal.Container size="sm">
            <Modal.Dialog aria-label="Delete chat" className="conversation-management-dialog">
              <Modal.Header>
                <Modal.Heading>Delete chat?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>“{label}” and its messages will be deleted.</p>
                {error && (
                  <p role="alert" className="text-danger">
                    {error}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" isDisabled={remove.isPending} onPress={close}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  isPending={remove.isPending}
                  onPress={() => void deleteChat()}
                >
                  Delete chat
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
      {dialog === 'details' && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <Modal.Container size="md">
            <Modal.Dialog
              aria-label="Conversation details"
              className="conversation-management-dialog"
            >
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Conversation details</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="conversation-details-title">{label}</p>
                <h3>Data sources and table scope</h3>
                {sources?.length ? (
                  sources.map((source) => {
                    const scope = tableScope.find((item) => item.data_source_id === source.id);
                    return (
                      <section className="conversation-source-detail" key={source.id}>
                        <strong>{source.name}</strong>
                        <p>
                          {scope?.mode === 'selected'
                            ? (scope.tables ?? [])
                                .map((table) =>
                                  [table.schema, table.name].filter(Boolean).join('.'),
                                )
                                .join(', ')
                            : 'All tables'}
                        </p>
                      </section>
                    );
                  })
                ) : (
                  <p>No data sources are recorded for this conversation.</p>
                )}
                <p className="conversation-details-note">
                  Source and table scope are fixed for this conversation. Start a new analysis to
                  use a different scope.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={close}>
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  );
}
