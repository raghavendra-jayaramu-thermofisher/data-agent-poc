import { useState } from 'react';
import { History, Copy, Check } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { formatLocalDateTime } from '../../lib/datetime';

type Version = components['schemas']['KnowledgeVersionResponse'];

export function KnowledgeVersionsTable({ versions }: { versions: Version[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs">
      <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[var(--db-border-subtle)]">
        <div className="p-1.5 rounded bg-[var(--db-primary-soft)] text-[var(--db-primary)]">
          <History size={16} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[var(--db-text-primary)] m-0 leading-tight">
            Version History
          </h2>
          <p className="text-xs text-[var(--db-text-muted)] mt-0.5">
            Immutable snapshots of generated schema documents and index fingerprints over time.
          </p>
        </div>
      </div>

      {versions.length ? (
        <div className="analytical-table-shell">
          <table className="analytical-table" aria-label="Knowledge versions">
            <thead>
              <tr>
                <th>Version</th>
                <th>Schema Fingerprint</th>
                <th>Generated At</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version, index) => (
                <tr key={version.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-[var(--db-text-primary)]">
                        v{version.version_number}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-[var(--db-text-secondary)]">
                        {version.schema_fingerprint.slice(0, 16)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(version.id, version.schema_fingerprint)}
                        className="p-1 rounded text-[var(--db-text-muted)] hover:text-[var(--db-primary)] hover:bg-[var(--db-surface-hover)] transition-colors cursor-pointer"
                        title={copiedId === version.id ? 'Copied full fingerprint!' : 'Copy full fingerprint'}
                      >
                        {copiedId === version.id ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="text-xs text-[var(--db-text-secondary)]">
                    {formatLocalDateTime(version.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[var(--db-text-muted)] py-6 text-center">
          No version history recorded yet.
        </p>
      )}
    </div>
  );
}
