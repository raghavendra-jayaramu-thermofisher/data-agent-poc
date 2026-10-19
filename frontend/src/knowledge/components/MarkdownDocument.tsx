import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
export function MarkdownDocument({ children }: { children: string }) {
  return (
    <div className="markdown-document">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            void node;
            return <a {...props} target="_blank" rel="noreferrer noopener" />;
          },
          table: ({ node, ...props }) => {
            void node;
            return (
              <div
                className="knowledge-table-scroll"
                role="region"
                aria-label="Scrollable table"
                tabIndex={0}
              >
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
