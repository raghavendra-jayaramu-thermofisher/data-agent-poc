import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  BookmarkPlus,
  Code2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Maximize2,
  Table as TableIcon,
} from 'lucide-react';
import type { JobArtifact, SqlExecution } from '../api/execution-api';
import { AnalyticalTable } from '../../analytics/table/AnalyticalTable';
import { toTsv, type AnalyticalTableModel } from '../../analytics/table/table-domain';
import { notifications } from '../../components/notifications';
import { AssistantMarkdown } from '../../conversations/components/AssistantMarkdown';
import { AnalyticalChart } from '../../charts/AnalyticalChart';
import { MetricCard } from '../../charts/MetricCard';
import {
  combineCompatibleCharts,
  normalizeChartArtifact,
  type NormalizedChartModel,
} from '../../charts/chart-domain';
import { parseHtmlArtifact, parseTableArtifact, parseTextArtifact } from '../lib/artifacts';
import { HtmlArtifactCard } from './HtmlArtifactCard';

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
  const params = new URLSearchParams({
    sourceJobId: jobId,
    sourceSqlExecutionId: sqlExecutionId,
    artifactId,
  });
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
        <pre
          className="mt-2 p-2 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-[11px] font-mono text-[#252127] overflow-x-auto leading-relaxed"
          aria-label="SQL query"
        >
          {sql.sql_text}
        </pre>
      ) : null}
    </div>
  );
}

function CollapsibleTableArtifact({
  artifact,
  model,
  sourceSql,
  dataSourceNames,
  defaultOpen,
  jobId,
}: {
  artifact: JobArtifact;
  model: AnalyticalTableModel;
  sourceSql?: SqlExecution;
  dataSourceNames: Record<string, string>;
  defaultOpen: boolean;
  jobId: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sqlVisible, setSqlVisible] = useState(false);
  const sourceName = sourceSql
    ? (dataSourceNames[sourceSql.data_source_id] ?? 'Data source')
    : null;

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(toTsv(model));
      setCopied(true);
      notifications.success('Copied table to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notifications.error('Unable to copy table');
    }
  }

  return (
    <section className="artifact-block table-artifact mb-3 border border-[#DAD5CD] rounded-none bg-[#FFFDFC] overflow-hidden transition-all">
      <header
        className="flex items-center justify-between px-3.5 py-2 bg-[#FBFAF7] hover:bg-[#F0EEE9] border-b border-[#DAD5CD] cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TableIcon size={14} className="text-[#4B123F] shrink-0" />
          <span className="font-semibold text-xs text-[#252127] truncate">
            {artifact.name || 'Query result'}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 bg-[#EAE7E1] text-[#625C64] rounded font-medium shrink-0">
            {model.rowCount.toLocaleString()} row{model.rowCount === 1 ? '' : 's'}
            {model.truncated ? ' · truncated' : ''}
          </span>
          {sourceName ? (
            <span className="text-[11px] text-[#8B848C] hidden sm:inline truncate">
              · {sourceName}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOpen && (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFFDFC] hover:bg-[#EAE7E1] text-[#252127] border border-[#DAD5CD] rounded text-[11px] font-medium transition-colors cursor-pointer"
                onClick={handleCopy}
                title="Copy table to clipboard"
              >
                {copied ? <Check size={11} className="text-[#32745A]" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="p-1 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] border border-[#DAD5CD] bg-[#FFFDFC] rounded transition-colors cursor-pointer"
                onClick={() => setFullscreen(true)}
                title="Expand table to full screen"
              >
                <Maximize2 size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-[#4B123F] font-medium pl-1">
            <span className="text-[11px]">{isOpen ? 'Hide' : 'View'}</span>
            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </header>

      {isOpen && (
        <div>
          <AnalyticalTable
            model={model}
            label={artifact.name || 'Query result'}
            hideToolbar={true}
            fullscreen={fullscreen}
            onCloseFullscreen={() => setFullscreen(false)}
          />

          <div className="artifact-source border-t border-[#DAD5CD] px-3.5 py-2 flex items-center justify-between text-xs text-[#625C64] bg-[#FBFAF7]">
            <div className="flex items-center gap-3">
              {sourceSql?.duration_ms != null ? (
                <span className="text-[11px] text-[#8B848C]">
                  {sourceSql.duration_ms.toLocaleString()} ms
                </span>
              ) : null}
              {sourceSql ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4B123F] hover:underline cursor-pointer"
                  onClick={() => setSqlVisible((v) => !v)}
                >
                  <Code2 size={11} />
                  <span>{sqlVisible ? 'Hide SQL' : 'View SQL'}</span>
                  {sqlVisible ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              ) : null}
            </div>

            <SaveEntryPoint
              jobId={jobId}
              sqlExecutionId={artifact.source_sql_execution_id}
              artifactId={artifact.id}
            />
          </div>

          {sqlVisible && sourceSql ? (
            <pre
              className="p-3 bg-[#F0EEE9] border-t border-[#DAD5CD] text-[11px] font-mono text-[#252127] overflow-x-auto leading-relaxed"
              aria-label="SQL query"
            >
              {sourceSql.sql_text}
            </pre>
          ) : null}
        </div>
      )}
    </section>
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
  renderReferencedHiddenTables = false,
  onFollowUp,
}: {
  jobId: string;
  artifacts: JobArtifact[];
  sql: SqlExecution[];
  dataSourceNames?: Record<string, string>;
  excludeTextMarkdown?: string;
  renderReferencedHiddenTables?: boolean;
  onFollowUp?(question: string): Promise<void> | void;
}) {
  const sqlById = new Map(sql.map((item) => [item.id, item]));
  const artifactOrder = new Map(artifacts.map((artifact, index) => [artifact.id, index]));
  const chartArtifacts = artifacts.filter((artifact) => artifact.kind === 'chart');
  const normalizedCharts = chartArtifacts
    .map((artifact) => {
      const source = artifact.source_sql_execution_id
        ? sqlById.get(artifact.source_sql_execution_id)
        : undefined;
      return normalizeChartArtifact(
        artifact,
        source,
        source ? (dataSourceNames[source.data_source_id] ?? 'Data source') : 'Data source',
      );
    })
    .filter((item): item is NormalizedChartModel => item != null);
  const charts = combineCompatibleCharts(normalizedCharts);
  const validChartIds = new Set(
    normalizedCharts.flatMap((model) =>
      model.provenance.map((item) => item.artifactId).filter((id): id is string => Boolean(id)),
    ),
  );
  const invalidCharts = chartArtifacts.filter((item) => !validChartIds.has(item.id));
  const tables = artifacts
    .map((artifact) => ({ artifact, model: parseTableArtifact(artifact) }))
    .filter(
      (item): item is { artifact: JobArtifact; model: AnalyticalTableModel } => item.model != null,
    );
  const texts = artifacts
    .map((artifact) => ({ artifact, model: parseTextArtifact(artifact) }))
    .filter(
      (item) => item.model != null && item.model.markdown.trim() !== excludeTextMarkdown?.trim(),
    );
  const htmlArtifacts = artifacts
    .map((artifact) => ({ artifact, model: parseHtmlArtifact(artifact) }))
    .filter((item) => item.model != null);
  const allValidTextArtifactIds = artifacts
    .filter((artifact) => parseTextArtifact(artifact) != null)
    .map((artifact) => artifact.id);
  const supportedIds = new Set([
    ...tables.map((item) => item.artifact.id),
    ...allValidTextArtifactIds,
    ...chartArtifacts.map((item) => item.id),
    ...htmlArtifacts.map((item) => item.artifact.id),
  ]);
  const unsupported = artifacts.filter((artifact) => !supportedIds.has(artifact.id));
  if (!artifacts.length) return null;

  const hasCharts = charts.length > 0;
  // Filter out tables marked 'hidden' or 0-row exploratory retries when other successful data exists
  const visibleTables = tables.filter(({ model }) => {
    if (model.display === 'hidden' && !renderReferencedHiddenTables) return false;
    if (
      model.display === 'auto' &&
      model.rowCount === 0 &&
      (hasCharts || tables.some((t) => t.model.rowCount > 0))
    ) {
      return false;
    }
    return true;
  });

  const entries: Array<{ order: number; key: string; node: ReactNode }> = [];
  for (const chart of charts) {
    const sourceSql = chartSql(chart, sqlById);
    const sourceIds = chart.provenance
      .map((item) => item.artifactId)
      .filter((id): id is string => Boolean(id));
    const order = Math.min(
      ...sourceIds.map((id) => artifactOrder.get(id) ?? Number.MAX_SAFE_INTEGER),
    );
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

  for (const [i, { artifact, model }] of visibleTables.entries()) {
    const sourceSql = artifact.source_sql_execution_id
      ? sqlById.get(artifact.source_sql_execution_id)
      : undefined;
    const isLastTable = i === visibleTables.length - 1;

    let defaultOpen: boolean;
    if (model.display === 'expanded') {
      defaultOpen = true;
    } else if (model.display === 'collapsed') {
      defaultOpen = false;
    } else {
      // auto mode: collapsed if charts exist, or open if it's the primary table
      defaultOpen = hasCharts ? false : isLastTable;
    }

    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `table-${artifact.id}`,
      node: (
        <CollapsibleTableArtifact
          artifact={artifact}
          model={model}
          sourceSql={sourceSql}
          dataSourceNames={dataSourceNames}
          defaultOpen={defaultOpen}
          jobId={jobId}
        />
      ),
    });
  }

  for (const { artifact, model } of texts) {
    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `text-${artifact.id}`,
      node: (
        <section className="artifact-text mb-4">
          <h4 className="font-semibold text-xs text-[#252127] mb-2">
            {artifact.name || 'Text output'}
          </h4>
          <AssistantMarkdown content={model!.markdown} />
        </section>
      ),
    });
  }
  for (const { artifact, model } of htmlArtifacts) {
    entries.push({
      order: artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER,
      key: `html-${artifact.id}`,
      node: <HtmlArtifactCard jobId={jobId} artifact={artifact} model={model!} />,
    });
  }
  if (invalidCharts.length) {
    const order = Math.min(
      ...invalidCharts.map((artifact) => artifactOrder.get(artifact.id) ?? Number.MAX_SAFE_INTEGER),
    );
    entries.push({
      order,
      key: 'invalid-charts',
      node: (
        <div
          className="p-3 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545] mb-2"
          role="status"
        >
          <strong>Chart unavailable</strong>
          <p className="mt-1 text-[#625C64]">
            {invalidCharts.length} chart artifact{invalidCharts.length === 1 ? '' : 's'} could not
            be rendered because its field encoding or data is invalid.
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
        <div
          className="p-3 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-xs text-[#625C64] mb-2"
          role="status"
        >
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
