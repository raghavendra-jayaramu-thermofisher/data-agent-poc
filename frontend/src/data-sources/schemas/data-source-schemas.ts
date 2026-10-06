import { z } from 'zod';
const relationalFields = z.object({
  kind: z.enum(['postgres', 'mysql', 'mssql']),
  name: z.string().trim().min(1, 'Name is required').max(180),
  host: z.string().trim().min(1, 'Host is required').max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1, 'Database is required').max(255),
  schemaName: z.string().trim().max(255).optional(),
  authenticationMode: z.enum(['sql', 'windows']).optional(),
  username: z.string().trim().max(255),
  password: z.string().max(4096),
  sslMode: z.enum(['disable', 'prefer', 'require', 'verify-ca', 'verify-full']).optional(),
  ssl: z.boolean(),
  encrypt: z.boolean(),
  trustServerCertificate: z.boolean(),
  odbcDriver: z.string().trim().max(255).optional(),
});
export const relationalDataSourceSchema = relationalFields.superRefine((value, context) => {
  if (value.kind === 'mssql' && value.authenticationMode === 'windows') return;
  if (!value.username)
    context.addIssue({ code: 'custom', path: ['username'], message: 'Username is required' });
  if (!value.password)
    context.addIssue({ code: 'custom', path: ['password'], message: 'Password is required' });
});
export const authenticationOptions = [
  { value: 'sql', label: 'SQL Authentication' },
  { value: 'windows', label: 'Windows Authentication' },
] as const;
export const windowsAuthenticationHelp =
  'Uses the Windows account running the API and worker. Run both directly on Windows under the same account with access to SQL Server.';
export type RelationalDataSourceValues = z.infer<typeof relationalDataSourceSchema>;
export const modelDefaultsByKind = {
  postgres: { port: 5432, schemaName: 'public' },
  mysql: { port: 3306, schemaName: '' },
  mssql: { port: 1433, schemaName: 'dbo' },
} as const;
export const dataSourceEditSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    status: z.enum(['active', 'disabled']),
    username: z.string().trim().max(255).optional(),
    password: z.string().max(4096).optional(),
    originalAuthenticationMode: z.enum(['sql', 'windows']).optional(),
    connection: relationalFields
      .omit({ kind: true, name: true, username: true, password: true })
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.connection?.authenticationMode === 'windows') return;
    if (value.originalAuthenticationMode === 'windows' && (!value.username || !value.password)) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Enter username and password when switching to SQL authentication.',
      });
      return;
    }
    if ((value.username && !value.password) || (!value.username && value.password)) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Enter both username and password to replace credentials.',
      });
    }
  });
export type DataSourceEditValues = z.infer<typeof dataSourceEditSchema>;
export const excelUploadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(180),
});
export type ExcelUploadValues = z.infer<typeof excelUploadSchema>;
