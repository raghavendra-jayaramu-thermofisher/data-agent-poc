import { Chip } from '@heroui/react';
type Props = {
    status: string;
};
function color(status: string): 'default' | 'accent' | 'success' | 'warning' | 'danger' {
    if (['succeeded', 'active', 'ready', 'ok'].includes(status))
        return 'success';
    if (['failed', 'error', 'disabled'].includes(status))
        return 'danger';
    if (['queued', 'preparing', 'generating', 'warning'].includes(status))
        return 'warning';
    if (['running'].includes(status))
        return 'accent';
    return 'default';
}
export function StatusChip({ status }: Props) {
    return <Chip size="sm" variant="soft" color={color(status)}>{status}</Chip>;
}
