import { PageError, PageLoading, PageState } from '../../components/PageState';
import { formatLocalDateTime } from '../../lib/datetime';
import { safeJsonStringify } from '../../lib/security';
import { AdminSettingsGate } from '../components/AdminSettingsGate';
import { useAuditLogs } from '../hooks/useSettings';

function AuditContent() {
  const query = useAuditLogs(true);
  if (query.isLoading) return <PageLoading label="Loading audit history…" />;
  if (query.isError)
    return (
      <PageError
        title="Unable to load audit history"
        message={(query.error as Error).message}
        retry={() => void query.refetch()}
      />
    );
  if (!query.data?.length) {
    return <PageState title="No audit events" description="Auditable organization actions will appear here." />;
  }

  return (
    <div>
      <div className="pb-3 mb-4 border-b border-[var(--db-border-default)]">
        <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Audit Trail</h2>
        <p className="text-xs text-[var(--db-text-secondary)]">Most recent immutable organization audit logs.</p>
      </div>

      <div className="analytical-table-shell">
        <table className="analytical-table" aria-label="Audit log">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((entry) => (
              <tr key={entry.id}>
                <td className="text-xs text-[var(--db-text-secondary)] whitespace-nowrap">
                  {formatLocalDateTime(entry.created_at)}
                </td>
                <td className="font-semibold text-xs text-[var(--db-primary)]">{entry.action}</td>
                <td className="text-xs text-[var(--db-text-primary)]">
                  <span>{entry.resource_type}</span>
                  {entry.resource_id ? (
                    <div className="font-mono text-[10px] text-[var(--db-text-muted)]">{entry.resource_id}</div>
                  ) : null}
                </td>
                <td className="font-mono text-xs text-[var(--db-text-secondary)]">
                  {entry.user_id ? entry.user_id : 'System'}
                </td>
                <td className="text-xs">
                  {Object.keys(entry.metadata).length ? (
                    <details className="cursor-pointer">
                      <summary className="text-[var(--db-primary)] hover:underline font-medium">View JSON</summary>
                      <pre className="p-2 mt-1 bg-[var(--db-surface-muted)] border border-[var(--db-border-default)] rounded text-[10px] font-mono overflow-x-auto max-w-xs">
                        {safeJsonStringify(entry.metadata)}
                      </pre>
                    </details>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditSettingsPage() {
  return (
    <AdminSettingsGate>
      <AuditContent />
    </AdminSettingsGate>
  );
}
