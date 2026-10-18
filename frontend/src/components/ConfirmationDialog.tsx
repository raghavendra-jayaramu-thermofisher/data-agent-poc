import type React from 'react';
import { AlertDialog, Button } from '@heroui/react';

type Props = {
  triggerLabel: React.ReactNode;
  triggerVariant?: 'danger' | 'ghost' | 'secondary' | 'primary';
  triggerSize?: 'sm' | 'md' | 'lg';
  triggerClassName?: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm(): void;
};

export function ConfirmationDialog({
  triggerLabel,
  triggerVariant = 'danger',
  triggerSize,
  triggerClassName,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
}: Props) {
  return (
    <AlertDialog>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
      >
        {triggerLabel}
      </Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {description ? <AlertDialog.Body>{description}</AlertDialog.Body> : null}
            <AlertDialog.Footer>
              <AlertDialog.CloseTrigger>
                <Button variant="secondary">Cancel</Button>
              </AlertDialog.CloseTrigger>
              <AlertDialog.CloseTrigger>
                <Button variant="danger" onPress={onConfirm}>
                  {confirmLabel}
                </Button>
              </AlertDialog.CloseTrigger>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
