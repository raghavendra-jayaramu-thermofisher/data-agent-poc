export type TemplateSection = { title: string; body: string };
export type TemplateOutline = { intro: string; sections: TemplateSection[] };

const SECTION_HEADING = /^ {0,3}##[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const FENCE = /^ {0,3}(```|~~~)/;

/** Split template instructions into the intro and the `##` sections it asks the answer to contain. */
export function templateOutline(content: string): TemplateOutline {
  const intro: string[] = [];
  const sections: { title: string; lines: string[] }[] = [];
  let fence: string | null = null;
  for (const line of content.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (marker) fence = fence === marker ? null : (fence ?? marker);
    const heading = fence || marker ? null : SECTION_HEADING.exec(line);
    if (heading) sections.push({ title: heading[1]!.trim(), lines: [] });
    else (sections.at(-1)?.lines ?? intro).push(line);
  }
  return {
    intro: intro.join('\n').trim(),
    sections: sections.map(({ title, lines }) => ({ title, body: lines.join('\n').trim() })),
  };
}

/** Split a prompt template around its `{prompt}` placeholder for highlighting. */
export function promptTemplateParts(template: string): string[] {
  return template.split('{prompt}');
}
