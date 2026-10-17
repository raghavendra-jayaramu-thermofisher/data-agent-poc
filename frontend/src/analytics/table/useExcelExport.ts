import { useRef, useState } from 'react';
import { notifications } from '../../components/notifications';
import { downloadExcel, type ExcelTableExport } from './excel-export';

export function useExcelExport(getTable: () => ExcelTableExport) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  async function exportExcel() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      const table = getTable();
      await downloadExcel(table);
      notifications.success(
        table.truncated
          ? 'Excel downloaded with all available rows. The source result was truncated.'
          : 'Excel downloaded',
      );
    } catch {
      notifications.error('Unable to export this table to Excel. Please try again.');
    } finally {
      running.current = false;
      setPending(false);
    }
  }
  return { pending, exportExcel };
}
