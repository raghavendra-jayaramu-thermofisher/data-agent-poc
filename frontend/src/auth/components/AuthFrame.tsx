import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
import { BRANDING } from '../../lib/branding';
import { BrandLogo } from '../../components/BrandLogo';

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  footer?: ReactNode;
}>) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand" to="/login" aria-label={BRANDING.ariaHomeLabel}>
          <BrandLogo decorative />
          <span>{BRANDING.name}</span>
        </Link>
        <div className="auth-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </section>
      <aside className="auth-context" aria-hidden="true">
        <div>
          <span className="eyebrow">Conversational analytics</span>
          <h2>{BRANDING.tagline}</h2>
          <p>{BRANDING.subtitle}</p>
        </div>
      </aside>
    </main>
  );
}
