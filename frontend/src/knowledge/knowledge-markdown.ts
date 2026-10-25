import type { components } from '../api/generated/schema';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];

// The agent reads data source and metric notes with the table index, then table and column notes.
const SCOPES: Record<string, { order: number; label: string }> = {
  datasource: { order: 0, label: 'Data source' },
  metric: { order: 1, label: 'Metric' },
  table: { order: 2, label: 'Table' },
  column: { order: 3, label: 'Column' },
};

/** Every note's text unchanged, each under the scope it applies to. */
export function knowledgeMarkdown(sourceName: string, annotations: Annotation[], copiedAt: Date) {
  const scope = (item: Annotation) => SCOPES[item.scope_type] ?? SCOPES.datasource!;
  const notes = annotations
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        scope(a.item).order - scope(b.item).order ||
        (a.item.scope_key ?? '').localeCompare(b.item.scope_key ?? '') ||
        a.index - b.index,
    )
    .map(({ item }) => {
      const appliesTo = scope(item).label + (item.scope_key ? ` · ${item.scope_key}` : '');
      return `---\n\nApplies to: ${appliesTo}\n\n${item.content.trim()}\n`;
    });
  const date = copiedAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const count = `${annotations.length} note${annotations.length === 1 ? '' : 's'}`;
  return [`# Business knowledge: ${sourceName}\n\n${count} · copied ${date}\n`, ...notes].join('\n');
}
