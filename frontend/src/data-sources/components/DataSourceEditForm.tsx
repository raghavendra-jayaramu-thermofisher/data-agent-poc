import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { useId, type FormEvent } from 'react';
import type { AppError } from '../../api/errors';
import type { DataSource } from '../../api/types';
import { FormField } from '../../auth/components/FormField';
import { SecretField } from '../../components/SecretField';
import { SingleSelect } from '../../components/SingleSelect';
import type { DataSourceUpdate } from '../api/data-source-api';
import {
  authenticationOptions,
  windowsAuthenticationHelp,
  dataSourceEditSchema,
  type DataSourceEditValues,
} from '../schemas/data-source-schemas';
import { buildRelationalPayload } from './RelationalDataSourceForm';
import { ConnectionSuggestions } from './ConnectionSuggestions';
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
  const suggestionId = useId();
  const hostListId = `${suggestionId}-hosts`;
  const portListId = `${suggestionId}-ports`;
  const driverListId = `${suggestionId}-drivers`;
  const relational =
    source.kind === 'postgres' || source.kind === 'mysql' || source.kind === 'mssql';
  const config = source.config;
  const {
    control,
    handleSubmit,
    resetField,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DataSourceEditValues>({
    resolver: zodResolver(dataSourceEditSchema),
    defaultValues: {
      name: source.name,
      status: source.status === 'disabled' ? 'disabled' : 'active',
      username: '',
      password: '',
      originalAuthenticationMode:
        source.kind === 'mssql' && config.authentication_mode === 'windows' ? 'windows' : 'sql',
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
            authenticationMode:
              source.kind === 'mssql' && config.authentication_mode === 'windows'
                ? 'windows'
                : 'sql',
          }
        : undefined,
    },
  });
  const windowsAuth =
    source.kind === 'mssql' && watch('connection.authenticationMode') === 'windows';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    const testConnection =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-test-connection') === 'true';
    return handleSubmit(async (values) => {
      try {
        const credentials =
          !windowsAuth && values.username && values.password
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
          const merged: Record<string, unknown> = { ...config, ...built };
          // Keep an unchanged legacy SQL connection unchanged on save.
          if (
            source.kind === 'mssql' &&
            config.authentication_mode == null &&
            merged.authentication_mode === 'sql'
          )
            delete merged.authentication_mode;
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
            <span>Connection</span>
            <hr />
          </div>
          <p className="text-xs text-[var(--db-text-secondary)]">
            After changing connection settings, test the connection and refresh its schema in
            Knowledge.
          </p>
          <div className="form-grid-2">
            <Controller
              control={control}
              name="connection.host"
              render={({ field }) => (
                <FormField
                  label="Host"
                  list={hostListId}
                  {...field}
                  error={errors.connection?.host?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="connection.port"
              render={({ field }) => (
                <FormField
                  label="Port"
                  type="number"
                  list={portListId}
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
          <ConnectionSuggestions
            kind={source.kind}
            hostListId={hostListId}
            portListId={portListId}
            driverListId={driverListId}
          />
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
                    list={driverListId}
                    {...field}
                    error={errors.connection?.odbcDriver?.message}
                  />
                )}
              />
              <p className="text-xs text-[var(--db-text-secondary)]">
                Use a driver installed on the machine running the API and worker.
              </p>
            </>
          )}
        </>
      )}

      {source.kind === 'mssql' && (
        <Controller
          control={control}
          name="connection.authenticationMode"
          render={({ field }) => (
            <SingleSelect
              label="Authentication method"
              value={field.value ?? 'sql'}
              options={authenticationOptions}
              onChange={(next) => {
                field.onChange(next);
                setValue('username', '');
                setValue('password', '');
              }}
            />
          )}
        />
      )}
      {windowsAuth && (
        <p className="text-xs text-[var(--db-text-secondary)]">{windowsAuthenticationHelp}</p>
      )}
      {relational && !windowsAuth && (
        <>
          <div className="form-section-divider">
            <span>Replace credentials</span>
            <hr />
          </div>
          <p className="text-xs text-[var(--db-text-secondary)] -mt-2 mb-1">
            {source.kind === 'mssql' && config.authentication_mode === 'windows'
              ? 'Enter new username and password to switch to SQL authentication.'
              : 'Leave both fields blank to keep the saved credentials.'}
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
            Save and test connection
          </Button>
        )}
      </div>
    </form>
  );
}
