import { Download, LoaderCircle } from 'lucide-react';
import { ArtifactIconButton } from '../components/ArtifactFrame';
import { downloadExcel, type ExcelTableExport } from './excel-export';
import { useExcelExport } from './useExcelExport';

export function ExcelExportButton({
  getTable,
  disabled = false,
}: {
  getTable(): ExcelTableExport;
  disabled?: boolean;
}) {
  const { pending, exportExcel } = useExcelExport(() => downloadExcel(getTable()));
  return (
    <ArtifactIconButton
      action={{
        id: 'export',
        label: pending ? 'Exporting to Excel' : 'Export to Excel',
        icon: pending ? LoaderCircle : Download,
        busy: pending,
        disabled,
        run: exportExcel,
      }}
    />
  );
}
