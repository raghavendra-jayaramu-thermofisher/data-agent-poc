import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Heading, PhrasingContent } from 'mdast';

export type AnswerHeading = {
  label: string;
  depth: number;
  offset: number;
};

export type AnswerSection = {
  label: string;
  start: number;
  end: number;
};

export type AnswerOutline = {
  headings: AnswerHeading[];
  sections: AnswerSection[];
  preamble: string;
};

const parser = unified().use(remarkParse).use(remarkGfm);

function headingText(node: PhrasingContent): string {
  if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return node.children.map(headingText).join('');
  return '';
}

function labelOf(node: Heading): string {
  return node.children.map(headingText).join('').trim();
}

export function createAnswerOutline(content: string): AnswerOutline {
  const tree = parser.parse(content);
  const headingNodes = tree.children.filter(
    (node): node is Heading => node.type === 'heading' && node.position?.start.offset != null,
  );
  const headings = headingNodes
    .map((node) => ({
      label: labelOf(node),
      depth: node.depth,
      offset: node.position!.start.offset!,
    }))
    .filter((heading) => heading.label.length > 0);

  if (
    headings.length < 2 ||
    tree.children.some((node) => node.type === 'definition' || node.type === 'footnoteDefinition')
  ) {
    return { headings, sections: [], preamble: '' };
  }

  const shallowest = Math.min(...headings.map((heading) => heading.depth));
  const shallowestHeadings = headings.filter((heading) => heading.depth === shallowest);
  const hasTitle = shallowestHeadings.length === 1 && headings[0] === shallowestHeadings[0];
  const depthsAfterTitle = [...new Set(headings.slice(1).map((heading) => heading.depth))].sort(
    (a, b) => a - b,
  );
  const sectionDepth = hasTitle
    ? (depthsAfterTitle.find(
        (depth) => headings.filter((heading) => heading.depth === depth).length > 1,
      ) ?? shallowest)
    : shallowest;
  const sectionHeadings = headings.filter((heading) => heading.depth === sectionDepth);
  if (sectionHeadings.length < 2) return { headings, sections: [], preamble: '' };

  const sections = sectionHeadings.map((heading, index) => ({
    label: heading.label,
    start: heading.offset,
    end: sectionHeadings[index + 1]?.offset ?? content.length,
  }));
  return { headings, sections, preamble: content.slice(0, sections[0]?.start ?? 0) };
}
