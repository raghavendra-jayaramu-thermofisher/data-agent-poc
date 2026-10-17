import { ExternalLink, FileCode2 } from 'lucide-react';
import { useState } from 'react';

import { getHtmlArtifactUrl, type JobArtifact } from '../api/execution-api';
import type { HtmlArtifactModel } from '../lib/artifacts';

export function HtmlArtifactCard({
  jobId,
  artifact,
  model,
}: {
  jobId: string;
  artifact: JobArtifact;
  model: HtmlArtifactModel;
}) {
  const [open, setOpen] = useState(false);
  const url = getHtmlArtifactUrl(jobId, artifact.id);

  return (
    <section className="html-artifact mb-4 overflow-hidden rounded-lg border border-[var(--db-border-default)] bg-[var(--db-surface-raised)]">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileCode2 size={18} className="shrink-0 text-[var(--db-primary)]" />
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-[var(--db-text-primary)]">
              {artifact.name || 'HTML artifact'}
            </h4>
            <p className="text-[11px] text-[var(--db-text-muted)]">
              {model.fileName} · {model.sizeBytes.toLocaleString()} bytes
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-[var(--db-border-default)] px-2.5 py-1.5 text-xs font-medium text-[var(--db-primary)] hover:bg-[var(--db-surface-muted)]"
          >
            Open <ExternalLink size={12} />
          </a>
          <button
            type="button"
            className="rounded bg-[var(--db-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#641754]"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Hide preview' : 'Preview'}
          </button>
        </div>
      </header>
      {open ? (
        <iframe
          title={artifact.name || 'HTML artifact preview'}
          src={url}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          className="h-[520px] w-full border-0 border-t border-[var(--db-border-default)] bg-white"
        />
      ) : null}
    </section>
  );
}
