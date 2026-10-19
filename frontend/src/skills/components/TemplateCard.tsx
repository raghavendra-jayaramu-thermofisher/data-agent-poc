import { Button, Dropdown, Label, Modal } from '@heroui/react';
import { Check, Copy, Edit2, Eye, LayoutTemplate, MoreHorizontal, Star, Trash2, X } from 'lucide-react';
import { Fragment, useId, useMemo, useState } from 'react';
import { MarkdownDocument } from '../../knowledge/components/MarkdownDocument';
import type { AgentInstruction } from '../../settings/api/instructions-api';
import { promptTemplateParts, templateOutline } from '../template-outline';

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
  const sectionsHeadingId = useId();
  const [viewing, setViewing] = useState(false);
  const [copied, setCopied] = useState(false);
  const outline = useMemo(() => templateOutline(item.content), [item.content]);

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
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
                {(item.command || item.prompt_template) && (
                  <section className="template-viewer-usage" aria-label="How to use">
                    {item.command && (
                      <div className="template-viewer-usage-row">
                        <span className="template-viewer-label">Use</span>
                        <code>
                          /{item.command} <span className="template-viewer-placeholder">your request</span>
                        </code>
                      </div>
                    )}
                    {item.prompt_template && (
                      <div className="template-viewer-usage-row">
                        <span className="template-viewer-label">Sends</span>
                        <p>
                          {promptTemplateParts(item.prompt_template).map((part, index) => (
                            <Fragment key={index}>
                              {index > 0 && <span className="template-viewer-placeholder">your request</span>}
                              {part}
                            </Fragment>
                          ))}
                        </p>
                      </div>
                    )}
                  </section>
                )}
                {outline.intro && (
                  <section className="template-viewer-intro" aria-label="Instructions">
                    <MarkdownDocument>{outline.intro}</MarkdownDocument>
                  </section>
                )}
                {outline.sections.length > 0 && (
                  <section aria-labelledby={sectionsHeadingId}>
                    <h3 id={sectionsHeadingId} className="template-viewer-sections-title">
                      Report sections <span>{outline.sections.length}</span>
                    </h3>
                    <ol className="template-viewer-sections">
                      {outline.sections.map((section, index) => (
                        <li key={`${section.title}-${index}`} className="template-viewer-section">
                          <span className="template-viewer-section-number" aria-hidden="true">
                            {index + 1}
                          </span>
                          <div>
                            <h4>{section.title}</h4>
                            {section.body && <MarkdownDocument>{section.body}</MarkdownDocument>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </Modal.Body>
              <Modal.Footer className="template-editor-footer">
                <Button variant="ghost" onPress={() => void copyInstructions()}>
                  {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy instructions'}
                </Button>
                {canManage && (
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setViewing(false);
                      onEdit();
                    }}
                  >
                    <Edit2 size={15} aria-hidden="true" />
                    Edit
                  </Button>
                )}
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
