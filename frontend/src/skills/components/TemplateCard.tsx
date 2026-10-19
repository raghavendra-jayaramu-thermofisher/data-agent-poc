import { Button, Dropdown, Label, Modal } from '@heroui/react';
import { Edit2, Eye, LayoutTemplate, MoreHorizontal, Star, Trash2, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { AgentInstruction } from '../../settings/api/instructions-api';

type Props = {
  item: AgentInstruction;
  canManage: boolean;
  busy: boolean;
  onEdit(): void;
  onMakeDefault(): void;
  onDelete(): void;
};

export function TemplateCard({ item, canManage, busy, onEdit, onMakeDefault, onDelete }: Props) {
  const headingId = useId();
  const [viewing, setViewing] = useState(false);
  return (
    <>
      <article
        className={'template-card' + (item.is_default ? ' template-card--default' : '')}
        aria-labelledby={headingId}
      >
        <div className="template-card-heading">
          <div className="template-card-icon" aria-hidden="true">
            {item.is_default ? <Star size={17} /> : <LayoutTemplate size={17} />}
          </div>
          <div className="template-card-summary">
            <div className="template-card-title-row">
              <h2 id={headingId}>{item.name}</h2>
              {item.is_default && (
                <span className="template-badge template-badge--default">Workspace default</span>
              )}
              {!item.enabled && <span className="template-badge">Disabled</span>}
            </div>
          </div>
          <Dropdown>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="template-more-button"
              aria-label={'More actions for ' + item.name}
              isDisabled={busy}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </Button>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                aria-label={'Actions for ' + item.name}
                onAction={(key) => {
                  if (key === 'view') setViewing(true);
                  if (key === 'edit') onEdit();
                  if (key === 'default') onMakeDefault();
                  if (key === 'delete') onDelete();
                }}
              >
                <Dropdown.Item id="view" textValue="View instructions">
                  <Eye size={15} aria-hidden="true" />
                  <Label>View instructions</Label>
                </Dropdown.Item>
                {canManage && (
                  <Dropdown.Item id="edit" textValue="Edit template">
                    <Edit2 size={15} aria-hidden="true" />
                    <Label>Edit template</Label>
                  </Dropdown.Item>
                )}
                {canManage && !item.is_default && item.enabled && (
                  <Dropdown.Item id="default" textValue="Make workspace default">
                    <Star size={15} aria-hidden="true" />
                    <Label>Make workspace default</Label>
                  </Dropdown.Item>
                )}
                {canManage && (
                  <Dropdown.Item id="delete" textValue="Delete template" variant="danger">
                    <Trash2 size={15} aria-hidden="true" />
                    <Label>Delete template</Label>
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </article>
      {viewing && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => {
            if (!open) setViewing(false);
          }}
          className="template-editor-backdrop"
        >
          <Modal.Container size="lg" scroll="inside" className="template-editor-container">
            <Modal.Dialog
              className="template-editor template-viewer"
              aria-label={'Template instructions: ' + item.name}
            >
              <Modal.Header className="template-editor-header">
                <div className="template-dialog-title">
                  <Modal.Heading>{item.name}</Modal.Heading>
                  {item.is_default && (
                    <span className="template-badge template-badge--default">
                      Workspace default
                    </span>
                  )}
                  {!item.enabled && <span className="template-badge">Disabled</span>}
                  {item.command && <code className="template-command">/{item.command}</code>}
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  aria-label="Close template instructions"
                  onPress={() => setViewing(false)}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </Modal.Header>
              <Modal.Body className="template-editor-body template-viewer-body">
                {item.description && (
                  <p className="template-viewer-description">{item.description}</p>
                )}
                <section className="template-viewer-instructions">
                  <h3>Instructions</h3>
                  <pre>{item.content}</pre>
                </section>
                {item.prompt_template && (
                  <section className="template-prompt-preview">
                    <h3>Prompt template</h3>
                    <p>{item.prompt_template}</p>
                  </section>
                )}
              </Modal.Body>
              <Modal.Footer className="template-editor-footer">
                <Button variant="secondary" onPress={() => setViewing(false)}>
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
