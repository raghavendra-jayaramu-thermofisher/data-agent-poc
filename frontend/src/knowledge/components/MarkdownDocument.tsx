import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function MarkdownDocument({ children }: {
    children: string;
}) { return <div className="markdown-document"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener"/> }}>{children}</ReactMarkdown></div>; }
