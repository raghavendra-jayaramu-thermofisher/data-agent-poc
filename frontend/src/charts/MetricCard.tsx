import { Gauge } from 'lucide-react';
import type { MetricChartModel } from './chart-domain';
import { formatAnalyticalValue } from '../analytics/table/table-domain';
import {
  ArtifactFrame,
  type ArtifactAction,
  type ArtifactMetadata,
} from '../analytics/components/ArtifactFrame';

export function MetricCard({
  model,
  metadata,
  extraActions = [],
}: {
  model: MetricChartModel;
  metadata?: ArtifactMetadata;
  extraActions?: ArtifactAction[];
}) {
  return (
    <ArtifactFrame
      title={model.title}
      kind="metric"
      icon={Gauge}
      metadata={metadata}
      actions={extraActions}
      warning={
        metadata?.sources?.some((source) => source.truncated) ? 'Truncated result' : undefined
      }
      collapsible={false}
    >
      <div className="metric-widget-value">
        <span>{model.label}</span>
        <strong>{formatAnalyticalValue(model.value)}</strong>
      </div>
    </ArtifactFrame>
  );
}
