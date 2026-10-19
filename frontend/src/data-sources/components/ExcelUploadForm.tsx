import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import type { AppError } from '../../api/errors';
import { FormField } from '../../auth/components/FormField';
import { excelUploadSchema, type ExcelUploadValues } from '../schemas/data-source-schemas';

type Props = {
  onSubmit(name: string, file: File): Promise<void>;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.ceil(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExcelUploadForm({ onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ExcelUploadValues>({
    resolver: zodResolver(excelUploadSchema),
    defaultValues: { name: '' },
  });

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
      setError('root', { message: 'Only .xlsx workbooks are supported.' });
      return;
    }

    clearErrors('root');
    setFile(selectedFile);

    // Auto-populate data source name if currently empty
    const currentName = getValues('name');
    if (!currentName.trim()) {
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setValue('name', baseName, { shouldValidate: true });
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const submit = async ({ name }: ExcelUploadValues) => {
    if (!file) {
      setError('root', { message: 'Please select an .xlsx workbook to upload.' });
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('root', { message: 'Only .xlsx workbooks are supported.' });
      return;
    }
    try {
      await onSubmit(name, file);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      setError('root', { message: (error as AppError).message ?? 'Upload failed.' });
    }
  };

  return (
    <form className="form-stack" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
      <FormField
        label="Data source name"
        placeholder="e.g. Sales Report Q3"
        {...register('name')}
        error={errors.name?.message}
      />

      <div>
        <label
          htmlFor="excel-file"
          className="block text-xs font-medium text-[var(--db-text-secondary)] mb-2"
        >
          Workbook file
        </label>

        <input
          ref={inputRef}
          id="excel-file"
          type="file"
          className="hidden"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => handleFileSelect(event.currentTarget.files?.[0] ?? null)}
        />

        {!file ? (
          <div
            className={`dropzone ${isDragOver ? 'is-dragover' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <div className="dropzone-icon">
              <UploadCloud size={24} />
            </div>
            <p className="dropzone-title">
              Click to choose a file{' '}
              <span className="font-normal text-[var(--db-text-secondary)]">or drag and drop</span>
            </p>
            <p className="dropzone-hint">Microsoft Excel workbook (.xlsx)</p>
          </div>
        ) : (
          <div className="file-preview-card">
            <div className="file-preview-info">
              <div className="file-preview-icon">
                <FileSpreadsheet size={20} />
              </div>
              <div className="file-preview-details">
                <span className="file-preview-name" title={file.name}>
                  {file.name}
                </span>
                <span className="file-preview-size">{formatFileSize(file.size)}</span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--db-surface-hover)] text-[var(--db-text-secondary)] hover:text-[var(--db-danger)] transition-colors cursor-pointer"
              onClick={handleRemoveFile}
              title="Remove file"
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {errors.root?.message ? (
        <div className="inline-error" role="alert">
          {errors.root.message}
        </div>
      ) : null}

      <div className="form-actions pt-2">
        <Button type="submit" variant="primary" isPending={isSubmitting} isDisabled={!file}>
          Upload workbook
        </Button>
      </div>
    </form>
  );
}
