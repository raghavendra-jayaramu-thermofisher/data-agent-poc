import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Gauge,
  Info,
  Lock,
  Minus,
  Package,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { MetricChartModel } from './chart-domain';
import {
  computeMetricChange,
  formatMetricValue,
  type MetricCardModel,
  type MetricDirection,
  type MetricIconName,
  type MetricTone,
} from './metric-domain';
import {
  ArtifactFrame,
  type ArtifactAction,
  type ArtifactMetadata,
} from '../analytics/components/ArtifactFrame';
import './metric-card.css';

const ICONS: Record<MetricIconName, LucideIcon> = {
  alert: AlertCircle,
  calendar: Calendar,
  chart: BarChart3,
  check: CheckCircle2,
  clock: Clock,
  currency: CircleDollarSign,
  lock: Lock,
  package: Package,
  truck: Truck,
  users: Users,
};

/** Colour is never the only signal: every non-neutral tone also carries an icon and a text cue. */
const TONE_CUES: Record<Exclude<MetricTone, 'neutral'>, { icon: LucideIcon; text: string }> = {
  positive: { icon: CheckCircle2, text: 'Favourable' },
  negative: { icon: AlertCircle, text: 'Needs attention' },
  warning: { icon: AlertCircle, text: 'Warning' },
  info: { icon: Info, text: 'For information' },
};

const DIRECTION_ICONS: Record<MetricDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

export function MetricTile({
  model,
  primary = false,
}: {
  model: MetricCardModel;
  primary?: boolean;
}) {
  const { headline, exact } = formatMetricValue(model.value, model.format, model.unit);
  const change = model.comparison
    ? computeMetricChange(model.value, model.comparison.value, {
        format: model.format,
        unit: model.unit,
        polarity: model.polarity,
        label: model.comparison.label,
      })
    : null;
  const Icon = model.icon ? ICONS[model.icon] : null;
  const cue = model.tone === 'neutral' ? null : TONE_CUES[model.tone];
  const CueIcon = cue?.icon;
  const DirectionIcon = change ? DIRECTION_ICONS[change.direction] : null;
  return (
    <article
      className={`metric-tile metric-tone-${model.tone}${primary ? ' metric-tile-primary' : ''}`}
      aria-label={`${model.label}: ${headline}`}
    >
      <header className="metric-tile-head">
        {Icon && (
          <span className="metric-tile-icon" aria-hidden="true">
            <Icon size={15} />
          </span>
        )}
        <span className="metric-tile-label" title={model.label}>
          {model.label}
        </span>
        {cue && CueIcon && (
          <span className="metric-tile-cue" title={cue.text}>
            <CueIcon size={14} aria-hidden="true" />
            <span className="sr-only">{cue.text}</span>
          </span>
        )}
      </header>
      <div className="metric-tile-value" title={exact ?? undefined}>
        {headline}
      </div>
      {exact && <div className="metric-tile-exact">{exact}</div>}
      {change && DirectionIcon && (
        <div className={`metric-change metric-change-${change.tone}`}>
          <DirectionIcon size={14} aria-hidden="true" />
          <span aria-hidden="true">
            {change.percentText ?? change.amountText}
            {change.percentText && change.direction !== 'flat' && (
              <span className="metric-change-amount"> · {change.amountText}</span>
            )}
          </span>
          {change.label && (
            <span className="metric-change-label" aria-hidden="true">
              {change.label}
            </span>
          )}
          <span className="sr-only">{change.spokenText}</span>
        </div>
      )}
      {(model.details.length > 0 || model.caption) && (
        <footer className="metric-tile-foot">
          {model.details.length > 0 && (
            <dl className="metric-tile-details">
              {model.details.map((detail) => (
                <div key={detail.field} className="metric-tile-detail">
                  <dt title={detail.label}>{detail.label}</dt>
                  <dd>
                    {detail.value == null
                      ? '—'
                      : formatMetricValue(detail.value, detail.format, detail.unit).headline}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {model.caption && <p className="metric-tile-caption">{model.caption}</p>}
        </footer>
      )}
    </article>
  );
}

/** Responsive grid: wraps onto new rows instead of scrolling, and never nests a scroll area. */
export function MetricGroup({ metrics }: { metrics: MetricCardModel[] }) {
  return (
    <div className="metric-group-frame">
      <div className="metric-group" data-count={metrics.length}>
        {metrics.map((metric, index) => (
          <MetricTile
            key={metric.field}
            model={metric}
            primary={metrics.length > 1 && index === 0}
          />
        ))}
      </div>
    </div>
  );
}

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
      {/* The artifact owns the inset; the group itself only owns the gap between its cards. */}
      <div className="metric-card-body">
        <MetricGroup metrics={model.metrics} />
      </div>
    </ArtifactFrame>
  );
}
