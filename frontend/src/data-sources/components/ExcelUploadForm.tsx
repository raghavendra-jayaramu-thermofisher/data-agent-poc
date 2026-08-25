import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { AppError } from '../../api/errors';
import { FormField } from '../../auth/components/FormField';
import { excelUploadSchema, type ExcelUploadValues } from '../schemas/data-source-schemas';
type Props = {
    onSubmit(name: string, file: File): Promise<void>;
};
export function ExcelUploadForm({ onSubmit }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ExcelUploadValues>({ resolver: zodResolver(excelUploadSchema), defaultValues: { name: '' } });
    const submit = handleSubmit(async ({ name }) => {
        if (!file) {
            setError('root', { message: 'Choose an .xlsx workbook.' });
            return;
        }
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            setError('root', { message: 'Only .xlsx workbooks are supported.' });
            return;
        }
        try {
            await onSubmit(name, file);
            setFile(null);
            if (inputRef.current)
                inputRef.current.value = '';
        }
        catch (error) {
            setError('root', { message: (error as AppError).message ?? 'Upload failed.' });
        }
    });
    return <form className="form-stack form-width" onSubmit={submit} noValidate>
    <FormField label="Name" {...register('name')} error={errors.name?.message}/>
    <div className="file-field"><label htmlFor="excel-file">Workbook</label><input ref={inputRef} id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}/><p>{file ? `${file.name} · ${Math.ceil(file.size / 1024)} KB` : 'Select an .xlsx workbook.'}</p></div>
    {errors.root?.message ? <div className="inline-error" role="alert">{errors.root.message}</div> : null}
    <div className="form-actions"><Button type="submit" variant="primary" isPending={isSubmitting}>Upload workbook</Button></div>
  </form>;
}
