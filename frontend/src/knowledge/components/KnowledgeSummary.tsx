import { useState } from 'react';
import { GitBranch, Database, Clock, Fingerprint, Copy, Check } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { formatLocalDateTime } from '../../lib/datetime';

type KnowledgeStatus = components['schemas']['KnowledgeStatusResponse'];

export function KnowledgeSummary({ status }: { status: KnowledgeStatus | undefined }) {
  const [copied, setCopied] = useState(false);

  const handleCopyFingerprint = async () => {
    if (!status?.schema_fingerprint) return;
    try {
      await navigator.clipboard.writeText(status.schema_fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback or ignore clipboard errors
    }
  };

  return (
    <div className="knowledge-stat-bar">
      <div className="knowledge-stat-card">
        <div className="knowledge-stat-label">
          <GitBranch size={13} className="text-[var(--db-primary)]" />
          <span>Active Version</span>
        </div>
        <div className="knowledge-stat-value">
          {status?.current_version_number != null ? `v${status.current_version_number}` : '—'}
        </div>
      </div>

      <div className="knowledge-stat-card">
        <div className="knowledge-stat-label">
          <Database size={13} className="text-[var(--db-primary)]" />
          <span>Schema Objects</span>
        </div>
        <div className="knowledge-stat-value">
          {status?.object_count?.toLocaleString() ?? '—'}
        </div>
      </div>

      <div className="knowledge-stat-card">
        <div className="knowledge-stat-label">
          <Clock size={13} className="text-[var(--db-primary)]" />
          <span>Last Generated</span>
        </div>
        <div className="knowledge-stat-subvalue truncate" title={status?.generated_at ? formatLocalDateTime(status.generated_at) : undefined}>
          {status?.generated_at ? formatLocalDateTime(status.generated_at) : 'Never'}
        </div>
      </div>

      <div className="knowledge-stat-card">
        <div className="knowledge-stat-label">
          <Fingerprint size={13} className="text-[var(--db-primary)]" />
          <span>Schema Fingerprint</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span
            className="text-xs font-mono font-medium text-[var(--db-text-primary)] truncate"
            title={status?.schema_fingerprint ?? undefined}
          >
            {status?.schema_fingerprint ? status.schema_fingerprint.slice(0, 16) : '—'}
          </span>
          {status?.schema_fingerprint ? (
            <button
              type="button"
              onClick={handleCopyFingerprint}
              title={copied ? 'Copied full fingerprint!' : 'Copy full fingerprint'}
              className="p-1 rounded text-[var(--db-text-muted)] hover:text-[var(--db-primary)] hover:bg-[var(--db-surface-hover)] transition-colors cursor-pointer shrink-0"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
