import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BookmarkPlus, Code2, ChevronDown, ChevronUp } from 'lucide-react';
import type { JobArtifact, SqlExecution } from '../api/execution-api';
import { AnalyticalTable } from '../../analytics/table/AnalyticalTable';
import { AssistantMarkdown } from '../../conversations/components/AssistantMarkdown';
import { AnalyticalChart } from '../../charts/AnalyticalChart';
import { MetricCard } from '../../charts/MetricCard';
import {
  combineCompatibleCharts,
  normalizeChartArtifact,
  type NormalizedChartModel,
} from '../../charts/chart-domain';
import { parseTableArtifact, parseTextArtifact } from '../lib/artifacts';

function SaveEntryPoint({
  jobId,
  sqlExecutionId,
  artifactId,
}: {
  jobId: string;
  sqlExecutionId?: string | null;
  artifactId: string;
}) {
  const navigate = useNavigate();
  if (!sqlExecutionId) return null;
  const params = new URLSearchParams({ sourceJobId: jobId, sourceSqlExecutionId: sqlExecutionId, artifactId });
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-medium transition-colors"
      onClick={() => navigate(`/dashboards?${params.toString()}`)}
    >
      <BookmarkPlus size={12} className="text-[#4B123F]" />
      <span>Save to dashboard</span>
    </button>
  );
}

function executionSummary(sql: SqlExecution | undefined, dataSourceNames: Record<string, string>) {
  if (!sql) return null;
  const source = dataSourceNames[sql.data_source_id] ?? 'Data source';
  const rows =
    sql.row_count == null
      ? null
      : `${sql.row_count.toLocaleString()} row${sql.row_count === 1 ? '' : 's'}`;
  const duration = sql.duration_ms == null ? null : `${sql.duration_ms.toLocaleString()} ms`;
  return [source, rows, duration, sql.truncated ? 'truncated' : null].filter(Boolean).join(' · ');
}

function ArtifactSource({
  sql,
  dataSourceNames,
}: {
  sql: SqlExecution | undefined;
  dataSourceNames: Record<string, string>;
}) {
  const [sqlVisible, setSqlVisible] = useState(false);
  if (!sql) return null;
  return (
    <div className="artifact-source mt-2 pt-2 border-t border-[#E7E3DC]">
      <div className="flex items-center justify-between text-xs text-[#625C64]">
        <span>{executionSummary(sql, dataSourceNames)}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4B123F] hover:underline"
          onClick={() => setSqlVisible((value) => !value)}
        >
          <Code2 size={11} />
          <span>{sqlVisible ? 'Hide SQL' : 'View SQL'}</span>
          {sqlVisible ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>
      {sqlVisible ? (
        <pre className="mt-2 p-2 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-[11px] font-mono text-[#252127] overflow-x-auto leading-relaxed" aria-label="SQL query">
          {sql.sql_text}
        </pre>
      ) : null}
    </div>
  );
}

function chartSql(chart: NormalizedChartModel, sqlById: Map<string, SqlExecution>) {
  if (chart.provenance.length !== 1) return undefined;
  const id = chart.provenance[0]?.executionId;
  return id ? sqlById.get(id) : undefined;
}

export function ArtifactRenderer({
  jobId,
  artifacts,
  sql,
  dataSourceNames = {},
  excludeTextMarkdown,
  onFollowUp,
}: {
  jobId: string;
  artifacts: JobArtifact[];
  sql: SqlExecution[];
  dataSourceNames?: Record<string, string>;
  excludeTextMarkdown?: string;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const sqlById = new Map(sql.map((item) => [item.id, item]));
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const chartArtifacts = artifacts.filter((artifact) => artifact.kind === 'chart');
  const normalizedCharts = chartArtifacts
    .map((artifact) => {
      const source = artifact.source_sql_execution_id ? sqlById.get(artifact.source_sql_execution_id) : undefined;
      return normalizeChartArtifact(
        artifact,
        source,
        source ? (dataSourceNames[source.data_source_id] ?? 'Data source') : 'Data source'
      );
    })
    .filter((item): item is NormalizedChartModel => item != null);
  const charts = combineCompatibleCharts(normalizedCharts);
  const validChartIds = new Set(
    normalizedCharts.flatMap((model) => model.provenance.map((item) => item.artifactId).filter((id): id is string => Boolean(id)))
  );
  const invalidCharts = chartArtifacts.filter((item) => !validChartIds.has(item.id));
  const tables = artifacts
    .map((artifact) => ({ artifact, model: parseTableArtifact(artifact) }))
    .filter((item) => item.model != null);
  const texts = artifacts
    .map((artifact) => ({ artifact, model: parseTextArtifact(artifact) }))
    .filter((item) => item.model != null && item.model.markdown.trim() !== excludeTextMarkdown?.trim());
  const allValidTextArtifactIds = artifacts
    .filter((artifact) => parseTextArtifact(artifact) != null)
    .map((artifact) => artifact.id);
  const supportedIds = new Set([
    ...tables.map((item) => item.artifact.id),
    ...allValidTextArtifactIds,
    ...chartArtifacts.map((item) => item.id),
  ]);
  const unsupported = artifacts.filter((artifact) => !supportedIds.has(artifact.id));
  if (!artifacts.length) return null;

  const entries: Array<{ order: number; key: string; node: ReactNode }> = [];
  for (const chart of charts) {
    const sourceSql = chartSql(chart, sqlById);
    const sourceIds = chart.provenance.map((item) => item.artifactId).filter((id): id is string => Boolean(id));
    const order = Math.min(...sourceIds.map((id) => artifactOrder.get(id) ?? Number.MAX_SAFE_INTEGER));
    entries.push({
      order,
      key: `chart-${chart.id}`,
      node: (
        <section className="artifact-block chart-artifact mb-4">
          {chart.chartType === 'metric' ? (
            <MetricCard model={chart} />
          ) : (
            <AnalyticalChart model={chart} onFollowUp={onFollowUp} />
          )}
          <ArtifactSource sql={sourceSql} dataSourceNames={dataSourceNames} />
          {chart.provenance.length === 1 && chart.provenance[0]?.artifactId ? (
            <div className="artifact-actions mt-2 flex justify-end">
              <SaveEntryPoint
                jobId={jobId}
                sqlExecutionId={chart.provenance[0].executionId}
                artifactId={chart.provenance[0].artifactId}
              />
            </div>
          ) : chart.provenance.length > 1 ? (
            <div className="artifact-actions mt-2 text-xs text-[#8B848C]">
              <span>Combined multi-source views remain separate when saved.</span>
            </div>
          ) : null}
        </section>
      ),
    });
  }
  for (const { artifact, model } of tables) {
    const sourceSql = artifact.source_sql_execution_id ? sqlById.get(artifact.source_sql_execution_id) : undefined;
    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `table-${artifact.id}`,
      node: (
        <section className="artifact-block table-artifact mb-4">
          <header className="artifact-heading flex items-center justify-between mb-2">
            <div>
              <h4 className="font-semibold text-xs text-[#252127]">{artifact.name || 'Query result'}</h4>
              <p className="text-[11px] text-[#625C64]">
                {model!.rowCount.toLocaleString()} row{model!.rowCount === 1 ? '' : 's'}
                {model!.truncated ? ' · truncated' : ''}
              </p>
            </div>
          </header>
          <AnalyticalTable model={model!} label={artifact.name || 'Query result'} />
          <ArtifactSource sql={sourceSql} dataSourceNames={dataSourceNames} />
          <div className="artifact-actions mt-2 flex justify-end">
            <SaveEntryPoint
              jobId={jobId}
              sqlExecutionId={artifact.source_sql_execution_id}
              artifactId={artifact.id}
            />
          </div>
        </section>
      ),
    });
  }
  for (const { artifact, model } of texts) {
    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `text-${artifact.id}`,
      node: (
        <section className="artifact-text mb-4">
          <h4 className="font-semibold text-xs text-[#252127] mb-2">{artifact.name || 'Text output'}</h4>
          <AssistantMarkdown content={model!.markdown} />
        </section>
      ),
    });
  }
  if (invalidCharts.length) {
    const order = Math.min(...invalidCharts.map((artifact) => artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER));
    entries.push({
      order,
      key: 'invalid-charts',
      node: (
        <div className="p-3 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545] mb-2" role="status">
          <strong>Chart unavailable</strong>
          <p className="mt-1 text-[#625C64]">
            {invalidCharts.length} chart artifact{invalidCharts.length === 1 ? '' : 's'} could not be rendered because its field encoding or data is invalid.
          </p>
        </div>
      ),
    });
  }
  for (const artifact of unsupported) {
    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `unsupported-${artifact.id}`,
      node: (
        <div className="p-3 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-xs text-[#625C64] mb-2" role="status">
          <strong>Unsupported artifact</strong>
          <p className="mt-1">{artifact.kind || 'Unknown'} output cannot be displayed safely.</p>
        </div>
      ),
    });
  }

  return (
    <div className="artifact-stack" aria-label="Analytical artifacts">
      {entries
        .sort((a, b) => a.order - b.order)
        .map((entry) => (
          <div key={entry.key} className="artifact-sequence-item">
            {entry.node}
          </div>
        ))}
    </div>
  );
}
