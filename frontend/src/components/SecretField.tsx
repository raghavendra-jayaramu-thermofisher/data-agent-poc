import { useState } from 'react';
import { Button, Input, Label, TextField } from '@heroui/react';
type Props = {
    label: string;
    value: string;
    onChange(value: string): void;
    name?: string;
    error?: string;
    autoComplete?: string;
};
export function SecretField({ label, value, onChange, name, error, autoComplete }: Props) {
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        if (!value)
            return;
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };
    return <TextField name={name} isInvalid={Boolean(error)}><Label>{label}</Label><div className="secret-field-row"><Input type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete}/><Button type="button" variant="ghost" size="sm" onPress={() => setVisible(v => !v)}>{visible ? 'Hide' : 'Show'}</Button><Button type="button" variant="ghost" size="sm" isDisabled={!value} onPress={() => void copy()}>{copied ? 'Copied' : 'Copy'}</Button></div>{error ? <p className="field-error" role="alert">{error}</p> : null}</TextField>;
}
