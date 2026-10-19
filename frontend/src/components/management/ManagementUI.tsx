import { AlertDialog, Button, Dropdown, Label } from '@heroui/react';
import { ArrowLeft, MoreHorizontal, Search, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { AppError } from '../../api/errors';
import './management.css';

export function ManagementHeader({
  title,
  backTo,
  backLabel,
  children,
  badge,
}: {
  title: string;
  backTo?: string;
  backLabel?: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="management-header">
      <div className="management-heading">
        {backTo && (
          <Link to={backTo} className="management-back" aria-label={backLabel ?? 'Back'}>
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        )}
        <h1>{title}</h1>
        {badge}
      </div>
      {children && <div className="management-header-actions">{children}</div>}
    </header>
  );
}
export function ManagementSearch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange(value: string): void;
  label: string;
}) {
  return (
    <div className="management-search db-icon-search" role="search">
      <Search size={16} aria-hidden="true" />
      <input
        type="search"
        className="db-icon-search__input"
        aria-label={label}
        placeholder={label + '…'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
export function ManagementStatus({ status }: { status: string }) {
  const known: Record<string, [string, string]> = {
    active: ['Active', 'success'],
    ready: ['Ready', 'success'],
    ok: ['Connected', 'success'],
    succeeded: ['Connected', 'success'],
    error: ['Needs attention', 'danger'],
    failed: ['Needs attention', 'danger'],
    disabled: ['Disabled', 'neutral'],
    inactive: ['Inactive', 'neutral'],
    enabled: ['Enabled', 'neutral'],
    untested: ['Not tested', 'neutral'],
    pending: ['Preparing', 'accent'],
    queued: ['Queued', 'accent'],
    running: ['Testing', 'accent'],
    preparing: ['Preparing', 'accent'],
  };
  const [label, tone] = known[status] ?? [
    status ? status[0]!.toUpperCase() + status.slice(1).replaceAll('_', ' ') : 'Not tested',
    'neutral',
  ];
  return (
    <span className="management-badge" data-tone={tone}>
      {label}
    </span>
  );
}
export type ManagementAction = {
  id: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
};
export function ManagementMenu({
  name,
  actions,
  onAction,
  disabled = false,
}: {
  name: string;
  actions: ManagementAction[];
  onAction(key: string): void;
  disabled?: boolean;
}) {
  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        className="management-more"
        aria-label={'More actions for ' + name}
        isDisabled={disabled}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={'Actions for ' + name}
          disabledKeys={actions.filter((item) => item.disabled).map((item) => item.id)}
          onAction={(key) => onAction(String(key))}
        >
          {actions.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              variant={item.danger ? 'danger' : undefined}
            >
              {item.icon}
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
export function ManagementDeleteDialog({
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onClose(): void;
  onConfirm(): Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setError((error as AppError)?.message || 'Unable to delete. Please try again.');
    } finally {
      setPending(false);
    }
  }
  return (
    <AlertDialog.Backdrop
      isOpen
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog className="management-delete-dialog">
          <AlertDialog.Header>
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{description}</p>
            {error && (
              <p role="alert" className="management-error">
                {error}
              </p>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="secondary" isDisabled={pending} onPress={onClose}>
              Cancel
            </Button>
            <Button variant="danger" isPending={pending} onPress={() => void confirm()}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
