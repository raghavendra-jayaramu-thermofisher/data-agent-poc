import { z } from 'zod';
export const relationalDataSourceSchema = z.object({
    kind: z.enum(['postgres', 'mysql', 'mssql']),
    name: z.string().trim().min(1, 'Name is required').max(180),
    host: z.string().trim().min(1, 'Host is required').max(255),
    port: z.number().int().min(1).max(65535),
    database: z.string().trim().min(1, 'Database is required').max(255),
    schemaName: z.string().trim().max(255).optional(),
    username: z.string().trim().min(1, 'Username is required').max(255),
    password: z.string().min(1, 'Password is required').max(4096),
    sslMode: z.enum(['disable', 'prefer', 'require', 'verify-ca', 'verify-full']).optional(),
    ssl: z.boolean(),
    encrypt: z.boolean(),
    trustServerCertificate: z.boolean(),
    odbcDriver: z.string().trim().max(255).optional(),
});
export type RelationalDataSourceValues = z.infer<typeof relationalDataSourceSchema>;
export const modelDefaultsByKind = {
    postgres: { port: 5432, schemaName: 'public' },
    mysql: { port: 3306, schemaName: '' },
    mssql: { port: 1433, schemaName: 'dbo' },
} as const;
export const dataSourceEditSchema = z.object({
    name: z.string().trim().min(1).max(180),
    status: z.enum(['active', 'disabled']),
    username: z.string().trim().max(255).optional(),
    password: z.string().max(4096).optional(),
}).superRefine((value, context) => {
    if ((value.username && !value.password) || (!value.username && value.password)) {
        context.addIssue({ code: 'custom', path: ['password'], message: 'Enter both username and password to replace credentials.' });
    }
});
export type DataSourceEditValues = z.infer<typeof dataSourceEditSchema>;
export const excelUploadSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(180) });
export type ExcelUploadValues = z.infer<typeof excelUploadSchema>;
