import type { InputHTMLAttributes } from 'react';
import { Input, Label, TextField } from '@heroui/react';
type Props = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
};
export function FormField({ label, error, ...props }: Props) { return <TextField isInvalid={Boolean(error)}><Label>{label}</Label><Input {...props}/>{error ? <p className="field-error" role="alert">{error}</p> : null}</TextField>; }
