import { Button } from '@heroui/react';
import type { ReactNode } from 'react';
export function PageLoading({ label = 'Loading…' }: {
    label?: string;
}) { return <div className="page-state" aria-live="polite"><div className="skeleton-line"/><p>{label}</p></div>; }
export function PageError({ title = 'Unable to load this page', message, retry }: {
    title?: string;
    message?: string;
    retry?: () => void;
}) { return <div className="page-state" role="alert"><h2>{title}</h2>{message ? <p>{message}</p> : null}{retry ? <Button variant="secondary" onPress={retry}>Try again</Button> : null}</div>; }
export function PageState({ title, description, loading = false, action }: {
    title: string;
    description?: string;
    loading?: boolean;
    action?: ReactNode;
}) { return <div className="page-state" aria-live={loading ? 'polite' : undefined}>{loading ? <div className="skeleton-line"/> : null}<h2>{title}</h2>{description ? <p>{description}</p> : null}{action}</div>; }
