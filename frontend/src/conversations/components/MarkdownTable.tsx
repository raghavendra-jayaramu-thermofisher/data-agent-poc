import { useRef, type ReactNode } from 'react';
import { ExcelExportButton } from '../../analytics/table/ExcelExportButton';
import type { ExcelTableExport } from '../../analytics/table/excel-export';

export function MarkdownTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);
  function getTable(): ExcelTableExport {
    const table = ref.current;
    if (!table) throw new Error('Table is unavailable.');
    let heading = table.closest('.markdown-table-wrapper')?.previousElementSibling;
    while (heading && !/^H[1-6]$/.test(heading.tagName)) heading = heading.previousElementSibling;
    return {
      title: heading?.textContent?.trim().slice(0, 240) || 'Answer table',
      headers: Array.from(table.tHead?.rows[0]?.cells ?? []).map((cell) => cell.textContent?.trim() ?? ''),
      rows: Array.from(table.tBodies).flatMap((body) => Array.from(body.rows)
        .map((row) => Array.from(row.cells).map((cell) => cell.textContent?.trim() ?? ''))),
      truncated: false,
    };
  }
  return <div className="markdown-table-wrapper border border-[#DAD5CD] rounded-lg my-3 shadow-2xs bg-[#FFFDFC] overflow-hidden">
    <div className="markdown-table-actions"><ExcelExportButton getTable={getTable} /></div>
    <div className="markdown-table-scroll max-h-[480px] overflow-auto">
      <table ref={ref} className="w-full text-xs">{children}</table>
    </div>
  </div>;
}
