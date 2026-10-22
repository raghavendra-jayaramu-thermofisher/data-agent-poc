const PRIVATE_KEY_PATTERN = /(password|credential|secret|api[_-]?key|authorization|token|prompt|reasoning|scratchpad|chain[_-]?of[_-]?thought)/i;

export function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds == null) return '—';
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
}

export function formatElapsed(startedAt: string, finishedAt: string | null | undefined): string {
  if (!finishedAt) return '—';
  const milliseconds = Date.parse(finishedAt) - Date.parse(startedAt);
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? formatDuration(milliseconds) : '—';
}

/** US dollars; small per-call costs keep four decimals so they don't round to $0.00. */
export function formatCost(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(value < 1 ? 4 : 2)}`;
}

export type UsageSummary = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Sum of priced calls; null when no call has a cost. */
  cost: number | null;
  /** Calls with tokens but no cost because the model profile has no price. */
  unpricedCalls: number;
};

export function summarizeUsage(
  models: ReadonlyArray<{
    input_tokens: number | null;
    output_tokens: number | null;
    cost?: number | null;
  }>,
): UsageSummary {
  let cost: number | null = null;
  let unpricedCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const model of models) {
    inputTokens += model.input_tokens ?? 0;
    outputTokens += model.output_tokens ?? 0;
    if (model.cost != null) cost = (cost ?? 0) + model.cost;
    else if (model.input_tokens != null || model.output_tokens != null) unpricedCalls += 1;
  }
  return { calls: models.length, inputTokens, outputTokens, cost, unpricedCalls };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeOperationalText(value: string | null | undefined): string | null {
  if (!value) return null;
  const firstLine = value.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
  return firstLine.slice(0, 600) || null;
}

function renderSummaryValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value.length > 220 ? `${value.slice(0, 217)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return 'Structured value';
}

export function safeSummaryEntries(summary: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!summary) return [];
  return Object.entries(summary)
    .filter(([key]) => !PRIVATE_KEY_PATTERN.test(key))
    .slice(0, 12)
    .map(([key, value]) => [key.replaceAll('_', ' '), renderSummaryValue(value)]);
}
