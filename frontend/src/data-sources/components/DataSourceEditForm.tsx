import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import type { FormEvent } from 'react';
import type { AppError } from '../../api/errors';
import type { DataSource } from '../../api/types';
import { FormField } from '../../auth/components/FormField';
import { SecretField } from '../../components/SecretField';
import { SingleSelect } from '../../components/SingleSelect';
import type { DataSourceUpdate } from '../api/data-source-api';
import { dataSourceEditSchema, type DataSourceEditValues } from '../schemas/data-source-schemas';
import { buildRelationalPayload } from './RelationalDataSourceForm';
const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
] as const;
export function DataSourceEditForm({
  source,
  onSubmit,
}: {
  source: DataSource;
  onSubmit(values: DataSourceUpdate, testConnection?: boolean): Promise<void>;
}) {
  const relational =
    source.kind === 'postgres' || source.kind === 'mysql' || source.kind === 'mssql';
  const config = source.config;
  const {
    control,
    handleSubmit,
    resetField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DataSourceEditValues>({
    resolver: zodResolver(dataSourceEditSchema),
    defaultValues: {
      name: source.name,
      status: source.status === 'disabled' ? 'disabled' : 'active',
      username: '',
      password: '',
      connection: relational
        ? {
            host: String(config.host ?? ''),
            port: Number(
              config.port ??
                (source.kind === 'postgres' ? 5432 : source.kind === 'mysql' ? 3306 : 1433),
            ),
            database: String(config.database ?? ''),
            schemaName: String(
              config.schema_name ?? (source.kind === 'postgres' ? 'public' : 'dbo'),
            ),
            sslMode: (config.ssl_mode ?? 'prefer') as 'prefer',
            ssl: Boolean(config.ssl),
            encrypt: config.encrypt !== false,
            trustServerCertificate: Boolean(config.trust_server_certificate),
            odbcDriver: String(config.odbc_driver ?? 'ODBC Driver 18 for SQL Server'),
          }
        : undefined,
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const testConnection =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-test-connection') === 'true';
    return handleSubmit(async (values) => {
      try {
        const credentials =
          values.username && values.password
            ? { username: values.username, password: values.password }
            : undefined;
        let nextConfig: DataSourceUpdate['config'];
        if (values.connection && relational) {
          const built = buildRelationalPayload({
            ...values.connection,
            name: values.name,
            kind: source.kind as 'postgres' | 'mysql' | 'mssql',
            username: '',
            password: '',
          }).config;
          const merged = { ...config, ...built };
          if (Object.entries(merged).some(([key, value]) => config[key] !== value))
            nextConfig = merged;
        }
        await onSubmit(
          {
            name: values.name,
            status: values.status,
            credentials,
            ...(nextConfig ? { config: nextConfig } : {}),
          },
          testConnection,
        );
        resetField('username');
        resetField('password');
      } catch (error) {
        setError('root', { message: (error as AppError).message ?? 'Update failed.' });
      }
    })(event);
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <div className="form-grid-2">
        <Controller
          control={control}
          name="name"
          render={({ field }) => <FormField label="Name" {...field} error={errors.name?.message} />}
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SingleSelect
              label="Status"
              value={field.value}
              onChange={field.onChange}
              options={statuses}
            />
          )}
        />
      </div>

      {relational && (
        <>
          <div className="form-section-divider">
            <span>Connection · {source.display_type.toUpperCase()}</span>
            <hr />
          </div>
          <p className="text-xs text-[var(--db-text-secondary)]">
            After changing the host, port, database, or schema, test the connection and regenerate its knowledge in Knowledge.
          </p>
          <div className="form-grid-2">
            <Controller
              control={control}
              name="connection.host"
              render={({ field }) => (
                <FormField label="Host" {...field} error={errors.connection?.host?.message} />
              )}
            />
            <Controller
              control={control}
              name="connection.port"
              render={({ field }) => (
                <FormField
                  label="Port"
                  type="number"
                  min={1}
                  max={65535}
                  {...field}
                  onChange={(event) =>
                    field.onChange(event.target.value === '' ? NaN : Number(event.target.value))
                  }
                  error={errors.connection?.port?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="connection.database"
              render={({ field }) => (
                <FormField
                  label="Database"
                  {...field}
                  error={errors.connection?.database?.message}
                />
              )}
            />
            {source.kind !== 'mysql' && (
              <Controller
                control={control}
                name="connection.schemaName"
                render={({ field }) => (
                  <FormField
                    label="Schema"
                    {...field}
                    error={errors.connection?.schemaName?.message}
                  />
                )}
              />
            )}
          </div>
          {source.kind === 'postgres' && (
            <Controller
              control={control}
              name="connection.sslMode"
              render={({ field }) => (
                <SingleSelect
                  label="SSL mode"
                  value={field.value ?? 'prefer'}
                  onChange={field.onChange}
                  options={['disable', 'prefer', 'require', 'verify-ca', 'verify-full'].map(
                    (value) => ({ value, label: value }),
                  )}
                />
              )}
            />
          )}
          {source.kind === 'mysql' && (
            <Controller
              control={control}
              name="connection.ssl"
              render={({ field }) => (
                <label>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />{' '}
                  Use SSL connection
                </label>
              )}
            />
          )}
          {source.kind === 'mssql' && (
            <>
              <Controller
                control={control}
                name="connection.encrypt"
                render={({ field }) => (
                  <label>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />{' '}
                    Encrypt connection
                  </label>
                )}
              />
              <Controller
                control={control}
                name="connection.trustServerCertificate"
                render={({ field }) => (
                  <label>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />{' '}
                    Trust server certificate
                  </label>
                )}
              />
              <Controller
                control={control}
                name="connection.odbcDriver"
                render={({ field }) => (
                  <FormField
                    label="ODBC driver"
                    {...field}
                    error={errors.connection?.odbcDriver?.message}
                  />
                )}
              />
            </>
          )}
        </>
      )}

      {relational && (
        <>
          <div className="form-section-divider">
            <span>Replace credentials</span>
            <hr />
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] -mt-2 mb-1">
            Stored credentials are never redisplayed. Leave both fields blank to keep the current
            secret.
          </p>

          <div className="form-grid-2">
            <Controller
              control={control}
              name="username"
              render={({ field }) => (
                <FormField
                  label="Username"
                  autoComplete="off"
                  {...field}
                  error={errors.username?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <SecretField
                  label="New password"
                  {...field}
                  value={field.value ?? ''}
                  autoComplete="new-password"
                  error={errors.password?.message}
                />
              )}
            />
          </div>
        </>
      )}

      {errors.root?.message ? (
        <div className="inline-error" role="alert">
          {errors.root.message}
        </div>
      ) : null}

      <div className="form-actions pt-2">
        <Button type="submit" variant="primary" isPending={isSubmitting}>
          Save changes
        </Button>
        {relational && (
          <Button
            type="submit"
            data-test-connection="true"
            variant="secondary"
            isDisabled={isSubmitting}
          >
            Save &amp; Test Connection
          </Button>
        )}
      </div>
    </form>
  );
}
