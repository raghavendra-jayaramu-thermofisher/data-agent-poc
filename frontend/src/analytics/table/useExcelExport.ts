import { useRef, useState } from 'react';
import { notifications } from '../../components/notifications';

/** Runs one workbook download at a time and reports the outcome. */
export function useExcelExport(exportWorkbook: () => Promise<{ truncated: boolean }>) {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  async function exportExcel() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      const { truncated } = await exportWorkbook();
      notifications.success(
        truncated
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
