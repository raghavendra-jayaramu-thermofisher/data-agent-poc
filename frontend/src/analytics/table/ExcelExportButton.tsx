import { useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { notifications } from '../../components/notifications';
import { downloadExcel, type ExcelTableExport } from './excel-export';

export function ExcelExportButton({ getTable, disabled = false }: {
  getTable(): ExcelTableExport;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const exporting = useRef(false);
  async function handleExport() {
    if (exporting.current || disabled) return;
    exporting.current = true;
    setPending(true);
    try {
      const table = getTable();
      await downloadExcel(table);
      notifications.success(table.truncated
        ? 'Excel downloaded with all available rows. The source result was truncated.'
        : 'Excel downloaded');
    } catch {
      notifications.error('Unable to export this table to Excel. Please try again.');
    } finally {
      exporting.current = false;
      setPending(false);
    }
  }
  return <button type="button" className="excel-export-button" disabled={disabled || pending}
    aria-label={pending ? 'Exporting to Excel' : 'Export to Excel'}
    aria-busy={pending}
    title="Export all available rows to Excel"
    onClick={(event) => { event.stopPropagation(); void handleExport(); }}>
    {pending ? <LoaderCircle size={12} className="animate-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />}
    <span>{pending ? 'Exporting…' : 'Export'}</span>
  </button>;
}
