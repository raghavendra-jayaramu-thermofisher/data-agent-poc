import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('/') || href.startsWith('#')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
      ? href
      : undefined;
  } catch {
    return undefined;
  }
}

export function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const safe = safeHref(href);
            return safe ? (
              <a
                href={safe}
                target={safe.startsWith('http') ? '_blank' : undefined}
                rel={safe.startsWith('http') ? 'noreferrer noopener' : undefined}
                {...props}
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },
          img: () => null, // Suppress hallucinated markdown images so broken image icons never appear
          table: ({ children, ...props }) => (
            <div className="markdown-table-wrapper max-h-[480px] overflow-auto border border-[#DAD5CD] rounded-lg my-3 shadow-2xs bg-[#FFFDFC]">
              <table {...props} className="w-full text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="sticky top-0 bg-[#F0EEE9] px-3 py-2 text-left text-xs font-semibold text-[#252127] border-b border-[#DAD5CD] z-10"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="px-3 py-2 text-xs text-[#252127] border-b border-[#EAE7E1]">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
