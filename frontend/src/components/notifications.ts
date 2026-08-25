import { toast } from '@heroui/react';
export const notifications = {
    success(message: string, description?: string) {
        toast.success(message, description ? { description } : undefined);
    },
    info(message: string, description?: string) {
        toast.info(message, description ? { description } : undefined);
    },
    warning(message: string, description?: string) {
        toast.warning(message, description ? { description } : undefined);
    },
    error(message: string, description?: string) {
        toast.danger(message, description ? { description } : undefined);
    },
};
