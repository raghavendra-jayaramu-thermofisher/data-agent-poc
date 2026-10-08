import { describe, expect, it } from 'vitest';
import { createAnswerOutline } from './answer-outline';

describe('answer outline', () => {
  it('builds section tabs from headings while ignoring fenced heading text', () => {
    const content = [
      '# Weekly Backlog',
      '',
      '## Executive Summary',
      'Backlog declined.',
      '',
      '### Japan',
      'Improved most.',
      '',
      '```md',
      '## Not a section',
      '```',
      '',
      '## KPI Summary',
      'Orders declined.',
    ].join('\n');
    const outline = createAnswerOutline(content);

    expect(outline.headings.map(({ label }) => label)).toEqual([
      'Weekly Backlog',
      'Executive Summary',
      'Japan',
      'KPI Summary',
    ]);
    expect(outline.sections.map(({ label }) => label)).toEqual([
      'Executive Summary',
      'KPI Summary',
    ]);
    expect(outline.preamble).toContain('# Weekly Backlog');
    expect(content.slice(outline.sections[0]!.start, outline.sections[0]!.end)).toContain(
      '### Japan',
    );
    expect(content.slice(outline.sections[0]!.start, outline.sections[0]!.end)).not.toContain(
      '## KPI Summary',
    );
  });

  it('keeps document-scoped reference links in the full answer', () => {
    const outline = createAnswerOutline(
      '## One\n[linked][ref]\n\n## Two\nText.\n\n[ref]: https://example.com',
    );
    expect(outline.headings).toHaveLength(2);
    expect(outline.sections).toEqual([]);
  });
});
