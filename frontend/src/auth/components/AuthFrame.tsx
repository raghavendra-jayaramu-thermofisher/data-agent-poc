import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
export function AuthFrame({ title, subtitle, children, footer }: PropsWithChildren<{
    title: string;
    subtitle: string;
    footer?: ReactNode;
}>) {
    return <main className="auth-page"><section className="auth-panel"><Link className="brand" to="/login" aria-label="DB Assistant home"><span className="brand-mark">DB</span><span>DB Assistant</span></Link><div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>{children}{footer ? <div className="auth-footer">{footer}</div> : null}</section><aside className="auth-context" aria-hidden="true"><div><span className="eyebrow">Conversational analytics</span><h2>Ask your data. Inspect the answer.</h2><p>Designed for trustworthy analysis, durable jobs, SQL provenance, and reusable dashboards.</p></div></aside></main>;
}
