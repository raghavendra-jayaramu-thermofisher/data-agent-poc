import { PageError, PageLoading, PageState } from '../../components/PageState';
import { safeDisplayEntries, safeJsonStringify } from '../../lib/security';
import { AdminSettingsGate } from '../components/AdminSettingsGate';
import { useOperationalStatus } from '../hooks/useSettings';

function displayValue(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return safeJsonStringify(value);
}

function OperationsContent() {
  const query = useOperationalStatus(true);
  if (query.isLoading) return <PageLoading label="Loading operational status…" />;
  if (query.isError)
    return (
      <PageError
        title="Unable to load operational status"
        message={(query.error as Error).message}
        retry={() => void query.refetch()}
      />
    );
  const entries = safeDisplayEntries(query.data ?? {});
  if (!entries.length) {
    return (
      <PageState
        title="No operational status reported"
        description="The backend returned no user-displayable operational fields."
      />
    );
  }

  return (
    <div>
      <div className="pb-3 mb-4 border-b border-[var(--db-border-default)]">
        <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Operational Status</h2>
        <p className="text-xs text-[var(--db-text-secondary)]">Sanitized backend health signals and limits for this workspace.</p>
      </div>

      <div className="analytical-table-shell">
        <table className="analytical-table" aria-label="Operational status">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td className="font-medium text-xs text-[var(--db-text-primary)] capitalize">{key.replaceAll('_', ' ')}</td>
                <td>
                  <pre className="font-mono text-xs text-[var(--db-text-secondary)] whitespace-pre-wrap">{displayValue(value)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OperationsSettingsPage() {
  return (
    <AdminSettingsGate>
      <OperationsContent />
    </AdminSettingsGate>
  );
}
