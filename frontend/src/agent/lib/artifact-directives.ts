import type { JobArtifact } from '../api/execution-api';

export type ResponseSegment =
  { type: 'markdown'; content: string } | { type: 'artifact'; artifactId: string };

const directivePattern =
  /^\s*\[\[artifact:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]\s*$/;
const anyDirectivePattern = /\[\[artifact:([0-9a-fA-F-]{36})\]\]/g;

export function parseArtifactDirectives(markdown: string): ResponseSegment[] {
  const segments: ResponseSegment[] = [];
  const buffer: string[] = [];
  let fence: '```' | '~~~' | null = null;

  const flush = () => {
    const content = buffer.join('\n');
    if (content.trim()) segments.push({ type: 'markdown', content });
    buffer.length = 0;
  };

  for (const line of markdown.split('\n')) {
    const stripped = line.trimStart();
    const marker = stripped.startsWith('```') ? '```' : stripped.startsWith('~~~') ? '~~~' : null;
    if (marker) {
      fence = fence == null ? marker : fence === marker ? null : fence;
      buffer.push(line);
      continue;
    }

    const match = fence == null ? directivePattern.exec(line) : null;
    if (!match) {
      buffer.push(line);
      continue;
    }
    flush();
    segments.push({ type: 'artifact', artifactId: match[1]! });
  }
  flush();
  return segments;
}

export function hasArtifactDirectives(markdown: string): boolean {
  return parseArtifactDirectives(markdown).some((segment) => segment.type === 'artifact');
}

export function formatMarkdownForCopy(markdown: string, artifacts: JobArtifact[]): string {
  const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  return markdown.replace(anyDirectivePattern, (_directive, artifactId: string) => {
    const artifact = artifactsById.get(artifactId.toLowerCase());
    if (!artifact) return '[Output]';
    const kind =
      artifact.kind === 'html'
        ? 'Report'
        : `${artifact.kind.charAt(0).toUpperCase()}${artifact.kind.slice(1)}`;
    return `[${kind}: ${artifact.name || 'Output'}]`;
  });
}
