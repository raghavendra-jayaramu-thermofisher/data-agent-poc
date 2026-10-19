export function KnowledgeStatus({ status }: { status: string }) {
  const states: Record<string, { label: string; tone: string }> = {
    ready: { label: 'Ready', tone: 'success' },
    generating: { label: 'Updating', tone: 'accent' },
    empty: { label: 'Not set up', tone: 'neutral' },
    failed: { label: 'Needs attention', tone: 'danger' },
    error: { label: 'Needs attention', tone: 'danger' },
    loading: { label: 'Loading…', tone: 'neutral' },
    unavailable: { label: 'Unavailable', tone: 'danger' },
  };
  const state = states[status] ?? states.empty!;
  return (
    <span className="knowledge-status" data-tone={state.tone}>
      {state.label}
    </span>
  );
}
