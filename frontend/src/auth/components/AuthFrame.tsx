import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router';
import { BRANDING } from '../../lib/branding';
import { BrandLogo } from '../../components/BrandLogo';

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
  showContext = true,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  footer?: ReactNode;
  showContext?: boolean;
}>) {
  return (
    <main className={`auth-page${showContext ? '' : ' auth-page--simple'}`}>
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
      {showContext && (
        <aside className="auth-context" aria-hidden="true">
          <div>
            <h2>{BRANDING.tagline}</h2>
            <p>{BRANDING.subtitle}</p>
          </div>
        </aside>
      )}
    </main>
  );
}
