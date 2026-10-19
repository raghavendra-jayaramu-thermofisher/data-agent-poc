import { Button, Modal, Switch } from '@heroui/react';
import { AlertCircle, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { AppError } from '../../api/errors';
import type { AgentInstruction, InstructionCreate } from '../../settings/api/instructions-api';

type FormState = {
  name: string;
  description: string;
  command: string;
  prompt_template: string;
  content: string;
  is_default: boolean;
  enabled: boolean;
};

export function TemplateEditor({
  item,
  currentDefault,
  saving,
  onSave,
  onClose,
}: {
  item: AgentInstruction | null;
  currentDefault?: AgentInstruction;
  saving: boolean;
  onSave(body: InstructionCreate): Promise<void>;
  onClose(): void;
}) {
  const id = useId();
  const [values, setValues] = useState<FormState>({
    name: item?.name ?? '',
    description: item?.description ?? '',
    command: item?.command ?? '',
    prompt_template: item?.prompt_template ?? '',
    content: item?.content ?? '',
    is_default: item?.is_default ?? false,
    enabled: item?.enabled ?? true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaveError(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const name = values.name.trim();
    const content = values.content.trim();
    const command = values.command.trim().replace(/^\/+/, '').toLowerCase();
    const invalid: typeof errors = {};
    if (!name) invalid.name = 'Enter a template name.';
    if (!content) invalid.content = 'Add instructions for this template.';
    if (command && !/^[a-z0-9_-]+$/.test(command))
      invalid.command = 'Use letters, numbers, hyphens, or underscores. Spaces aren’t supported.';
    setErrors(invalid);
    const firstInvalid = Object.keys(invalid)[0];
    if (firstInvalid) {
      document.getElementById(id + '-' + firstInvalid)?.focus();
      return;
    }
    setSaveError(null);
    try {
      await onSave({
        name,
        content,
        description: values.description.trim() || null,
        command: command || null,
        prompt_template: values.prompt_template.trim() || null,
        is_default: values.is_default,
        enabled: values.is_default || values.enabled,
      });
    } catch (error) {
      setSaveError(
        (error as AppError | null)?.message || 'Unable to save this template. Please try again.',
      );
    }
  }
  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!saving}
      isKeyboardDismissDisabled={saving}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      className="template-editor-backdrop"
    >
      <Modal.Container size="lg" scroll="inside" className="template-editor-container">
        <Modal.Dialog className="template-editor" aria-labelledby={id + '-title'}>
          <Modal.Header className="template-editor-header">
            <Modal.Heading id={id + '-title'}>
              {item ? 'Edit template' : 'New template'}
            </Modal.Heading>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              aria-label="Close template editor"
              isDisabled={saving}
              onPress={onClose}
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </Modal.Header>
          <Modal.Body className="template-editor-body">
            <form id={id + '-form'} noValidate onSubmit={(event) => void submit(event)}>
              <fieldset disabled={saving} className="template-editor-fields">
                {saveError && (
                  <div role="alert" className="template-save-error">
                    <AlertCircle size={17} aria-hidden="true" />
                    <span>{saveError}</span>
                  </div>
                )}
                <div className="template-field">
                  <label htmlFor={id + '-name'}>
                    Template name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={id + '-name'}
                    autoFocus
                    required
                    maxLength={180}
                    value={values.name}
                    placeholder="e.g. Weekly backlog review"
                    onChange={(event) => change('name', event.target.value)}
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? id + '-name-error' : undefined}
                  />
                  {errors.name && (
                    <p id={id + '-name-error'} className="template-field-error">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="template-field">
                  <label htmlFor={id + '-description'}>
                    Description <span className="template-optional">Optional</span>
                  </label>
                  <input
                    id={id + '-description'}
                    maxLength={500}
                    value={values.description}
                    placeholder="A short summary to help people choose this template"
                    onChange={(event) => change('description', event.target.value)}
                  />
                </div>
                <div className="template-field">
                  <label htmlFor={id + '-content'}>
                    Instructions <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id={id + '-content'}
                    required
                    rows={6}
                    maxLength={20000}
                    value={values.content}
                    placeholder="Describe what to analyze, the rules to follow, and how to present the results."
                    onChange={(event) => change('content', event.target.value)}
                    aria-invalid={Boolean(errors.content)}
                    aria-describedby={id + (errors.content ? '-content-error' : '-content-help')}
                  />
                  {errors.content ? (
                    <p id={id + '-content-error'} className="template-field-error">
                      {errors.content}
                    </p>
                  ) : (
                    <p id={id + '-content-help'} className="template-field-help">
                      Include any reporting rules, definitions, or preferred output format.
                    </p>
                  )}
                </div>
                <section
                  className="template-shortcut-section"
                  aria-labelledby={id + '-shortcut-heading'}
                >
                  <h3 id={id + '-shortcut-heading'}>
                    Shortcut and prompt <span className="template-optional">Optional</span>
                  </h3>
                  <div className="template-shortcut-fields">
                    <div className="template-field">
                      <label htmlFor={id + '-command'}>Slash command</label>
                      <div className="template-command-input">
                        <span aria-hidden="true">/</span>
                        <input
                          id={id + '-command'}
                          maxLength={64}
                          value={values.command}
                          placeholder="backlog-review"
                          onChange={(event) =>
                            change('command', event.target.value.replace(/^\/+/, '').toLowerCase())
                          }
                          aria-invalid={Boolean(errors.command)}
                          aria-describedby={
                            id + (errors.command ? '-command-error' : '-command-help')
                          }
                        />
                      </div>
                      {errors.command ? (
                        <p id={id + '-command-error'} className="template-field-error">
                          {errors.command}
                        </p>
                      ) : (
                        <p id={id + '-command-help'} className="template-field-help">
                          Type this shortcut in a question.
                        </p>
                      )}
                    </div>
                    <div className="template-field">
                      <label htmlFor={id + '-prompt'}>Prompt template</label>
                      <textarea
                        id={id + '-prompt'}
                        rows={2}
                        maxLength={5000}
                        value={values.prompt_template}
                        placeholder={'Review the weekly backlog for: {prompt}'}
                        onChange={(event) => change('prompt_template', event.target.value)}
                        aria-describedby={id + '-prompt-help'}
                      />
                      <p id={id + '-prompt-help'} className="template-field-help">
                        Use <code>{'{prompt}'}</code> where the person’s question should appear.
                      </p>
                    </div>
                  </div>
                </section>
                <div className="template-options">
                  <Switch
                    size="sm"
                    className="template-option"
                    aria-label="Workspace default"
                    isSelected={values.is_default}
                    isDisabled={saving}
                    onChange={(selected) =>
                      setValues((current) => ({
                        ...current,
                        is_default: selected,
                        enabled: selected || current.enabled,
                      }))
                    }
                  >
                    <Switch.Content>
                      <span className="template-option-copy">
                        <span className="template-option-title">Workspace default</span>
                        <span className="template-option-description">
                          {values.is_default && currentDefault && currentDefault.id !== item?.id
                            ? 'Replaces “' +
                              currentDefault.name +
                              '” as the default for every question.'
                            : 'Apply these instructions automatically to every question.'}
                        </span>
                      </span>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                  <Switch
                    size="sm"
                    className="template-option"
                    aria-label="Template enabled"
                    isSelected={values.enabled}
                    isDisabled={saving || values.is_default}
                    onChange={(selected) => change('enabled', selected)}
                  >
                    <Switch.Content>
                      <span className="template-option-copy">
                        <span className="template-option-title">Template enabled</span>
                        <span className="template-option-description">
                          {values.is_default
                            ? 'The workspace default must stay enabled.'
                            : 'Make this template available when asking a question.'}
                        </span>
                      </span>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              </fieldset>
            </form>
          </Modal.Body>
          <Modal.Footer className="template-editor-footer">
            <span className="template-required-note">* Required fields</span>
            <Button variant="secondary" isDisabled={saving} onPress={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={id + '-form'} isPending={saving}>
              {saving ? 'Saving…' : 'Save template'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
