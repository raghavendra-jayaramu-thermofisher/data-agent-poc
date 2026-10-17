import { useRouteError, useNavigate } from 'react-router';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const errorMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'An unexpected application error occurred.';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--db-canvas)]">
      <div className="max-w-md w-full p-6 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4 text-[var(--db-danger)]">
          <div className="p-2 bg-[var(--db-danger-soft)] rounded-full">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-base font-semibold text-[var(--db-text-primary)]">Application Error</h2>
        </div>

        <p className="text-xs text-[var(--db-text-secondary)] mb-4 leading-relaxed font-mono p-2.5 bg-[var(--db-surface-muted)] rounded border border-[var(--db-border-default)] overflow-x-auto">
          {errorMessage}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-medium transition-colors"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={13} />
            <span>Reload Page</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-medium transition-colors"
            onClick={() => navigate('/ask')}
          >
            <Home size={13} />
            <span>Go to Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
}
