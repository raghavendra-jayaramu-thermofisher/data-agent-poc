import { describe, expect, it } from 'vitest';
import { promptTemplateParts, templateOutline } from './template-outline';

describe('template outline', () => {
  it('separates the intro from the sections the answer should contain', () => {
    const outline = templateOutline(
      'Build a report.\r\nUse these sections:\n\n## Summary\nOne sentence.\n\n## Detail ##\n- Table\n- Chart',
    );
    expect(outline.intro).toBe('Build a report.\nUse these sections:');
    expect(outline.sections).toEqual([
      { title: 'Summary', body: 'One sentence.' },
      { title: 'Detail', body: '- Table\n- Chart' },
    ]);
  });

  it('keeps headings inside code blocks and other heading levels as section content', () => {
    const outline = templateOutline('Intro\n```md\n## Not a section\n```\n# Title\n### Sub\n## Real');
    expect(outline.intro).toBe('Intro\n```md\n## Not a section\n```\n# Title\n### Sub');
    expect(outline.sections.map((section) => section.title)).toEqual(['Real']);
  });

  it('treats instructions without sections as one intro', () => {
    expect(templateOutline('Answer briefly.')).toEqual({ intro: 'Answer briefly.', sections: [] });
  });

  it('splits a prompt template around each placeholder', () => {
    expect(promptTemplateParts('Report for {prompt}. Scope: all.')).toEqual(['Report for ', '. Scope: all.']);
    expect(promptTemplateParts('No placeholder')).toEqual(['No placeholder']);
  });
});
