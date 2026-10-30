import { Button, Tooltip } from '@heroui/react';
import { Copy } from 'lucide-react';

/** An icon-only copy action whose tooltip and accessible name both state what is copied. */
export function CopyIconButton({
  label,
  onPress,
  isDisabled,
  isPending,
}: {
  label: string;
  onPress(): void;
  isDisabled?: boolean;
  isPending?: boolean;
}) {
  return (
    <Tooltip delay={350}>
      <Button
        isIconOnly
        variant="secondary"
        aria-label={label}
        isDisabled={isDisabled}
        isPending={isPending}
        onPress={onPress}
      >
        <Copy size={15} aria-hidden="true" />
      </Button>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
