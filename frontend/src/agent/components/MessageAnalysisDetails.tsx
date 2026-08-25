import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Code2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { useExecutionTrace } from '../hooks/useExecutionTrace';
import { ArtifactRenderer } from './ArtifactRenderer';
import { ExecutionTimeline } from './ExecutionTimeline';

export function MessageAnalysisDetails({
  jobId,
  answerMarkdown,
  onFollowUp,
}: {
  jobId: string;
  answerMarkdown: string;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const trace = useExecutionTrace(jobId);
  const dataSources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
  const sourceNames = Object.fromEntries(
    (dataSources.data ?? []).map((source) => [source.id, source.name])
  );

  return (
    <div className="message-analysis-details">
      {trace.data ? (
        <ArtifactRenderer
          jobId={jobId}
          artifacts={trace.data.artifacts ?? []}
          sql={trace.data.sql ?? []}
          dataSourceNames={sourceNames}
          excludeTextMarkdown={answerMarkdown}
          onFollowUp={onFollowUp}
        />
      ) : null}

      <div className="execution-ledger">
        <button
          type="button"
          className="execution-ledger-summary"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="execution-ledger-summary-main">
            <Code2 size={13} className="text-[#4B123F]" />
            <span>Execution ledger</span>
          </span>

          <span className="execution-ledger-stats">
            {trace.isLoading ? (
              <span className="execution-ledger-stat">Loading…</span>
            ) : trace.data ? (
              <>
                <span className="execution-ledger-stat">
                  {(trace.data.tools ?? []).length} tool{(trace.data.tools ?? []).length === 1 ? '' : 's'} executed
                </span>
                <span className="execution-ledger-stat">
                  {(trace.data.sql ?? []).length} SQL quer{(trace.data.sql ?? []).length === 1 ? 'y' : 'ies'}
                </span>
                <span className="execution-ledger-stat">
                  {(trace.data.artifacts ?? []).length} artifact{(trace.data.artifacts ?? []).length === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              <span className="execution-ledger-stat">Execution details unavailable</span>
            )}
          </span>

          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {expanded ? (
          <div className="execution-inspector" aria-label="Execution inspector">
            {trace.isLoading ? (
              <p className="text-xs text-[#8B848C] py-2">Loading execution trace…</p>
            ) : trace.isError ? (
              <div className="p-3 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]" role="alert">
                <strong>Execution trace unavailable</strong>
                <p className="mt-1 text-[#625C64]">The durable answer remains available. Retry the trace request separately.</p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs font-medium hover:bg-[#F0EEE9]"
                  onClick={() => void trace.refetch()}
                >
                  <RefreshCw size={11} />
                  <span>Retry</span>
                </button>
              </div>
            ) : trace.data ? (
              <ExecutionTimeline trace={trace.data} dataSourceNames={sourceNames} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
