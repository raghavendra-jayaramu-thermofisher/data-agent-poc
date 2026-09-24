import { describe, expect, it } from 'vitest';
import type { JobArtifact } from '../api/execution-api';
import {
  formatMarkdownForCopy,
  hasArtifactDirectives,
  parseArtifactDirectives,
} from './artifact-directives';

const artifactId = '11111111-1111-4111-8111-111111111111';

describe('artifact directives', () => {
  it('splits standalone directives while preserving surrounding Markdown', () => {
    const segments = parseArtifactDirectives(
      `### Answer\n\nSummary.\n\n[[artifact:${artifactId}]]\n\nMore detail.`,
    );
    expect(segments).toEqual([
      { type: 'markdown', content: '### Answer\n\nSummary.\n' },
      { type: 'artifact', artifactId },
      { type: 'markdown', content: '\nMore detail.' },
    ]);
    expect(hasArtifactDirectives(`[[artifact:${artifactId}]]`)).toBe(true);
  });

  it('does not treat fenced or inline text as a render directive', () => {
    expect(parseArtifactDirectives(`\`\`\`\n[[artifact:${artifactId}]]\n\`\`\``)).toEqual([
      { type: 'markdown', content: `\`\`\`\n[[artifact:${artifactId}]]\n\`\`\`` },
    ]);
    expect(parseArtifactDirectives(`See [[artifact:${artifactId}]] here.`)).toEqual([
      { type: 'markdown', content: `See [[artifact:${artifactId}]] here.` },
    ]);
  });

  it('replaces raw directives with descriptive labels for copying', () => {
    const artifact: JobArtifact = {
      id: artifactId,
      job_id: 'job-1',
      kind: 'chart',
      name: 'Orders by status',
      source_sql_execution_id: null,
      payload: {},
      created_at: '2026-09-24T00:00:00Z',
    };
    expect(formatMarkdownForCopy(`[[artifact:${artifactId}]]`, [artifact])).toBe(
      '[Chart: Orders by status]',
    );
  });
});
