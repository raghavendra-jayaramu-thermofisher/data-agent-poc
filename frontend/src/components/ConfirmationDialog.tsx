import { AlertDialog, Button } from '@heroui/react';
type Props = {
    triggerLabel: string;
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm(): void;
};
export function ConfirmationDialog({ triggerLabel, title, description, confirmLabel = 'Confirm', onConfirm }: Props) { return <AlertDialog><Button variant="danger">{triggerLabel}</Button><AlertDialog.Backdrop><AlertDialog.Container><AlertDialog.Dialog><AlertDialog.Header><AlertDialog.Heading>{title}</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body>{description}</AlertDialog.Body><AlertDialog.Footer><AlertDialog.CloseTrigger><Button variant="secondary">Cancel</Button></AlertDialog.CloseTrigger><AlertDialog.CloseTrigger><Button variant="danger" onPress={onConfirm}>{confirmLabel}</Button></AlertDialog.CloseTrigger></AlertDialog.Footer></AlertDialog.Dialog></AlertDialog.Container></AlertDialog.Backdrop></AlertDialog>; }
