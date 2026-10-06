import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Label, Switch } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { useId } from 'react';
import type { AppError } from '../../api/errors';
import { SecretField } from '../../components/SecretField';
import { SingleSelect } from '../../components/SingleSelect';
import { FormField } from '../../auth/components/FormField';
import type { RelationalDataSourceCreate } from '../api/data-source-api';
import { ConnectionSuggestions } from './ConnectionSuggestions';
import {
  authenticationOptions,
  windowsAuthenticationHelp,
  modelDefaultsByKind,
  relationalDataSourceSchema,
  type RelationalDataSourceValues,
} from '../schemas/data-source-schemas';
type Props = {
  onSubmit(values: RelationalDataSourceCreate): Promise<void>;
};
const kindOptions = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'Microsoft SQL Server' },
] as const;
const sslModeOptions = [
  { value: 'disable', label: 'Disable' },
  { value: 'prefer', label: 'Prefer' },
  { value: 'require', label: 'Require' },
  { value: 'verify-ca', label: 'Verify CA' },
  { value: 'verify-full', label: 'Verify full' },
] as const;
export function buildRelationalPayload(
  values: RelationalDataSourceValues,
): RelationalDataSourceCreate {
  const credentials = { username: values.username, password: values.password };
  if (values.kind === 'postgres')
    return {
      kind: 'postgres',
      name: values.name,
      credentials,
      config: {
        host: values.host,
        port: values.port,
        database: values.database,
        schema_name: values.schemaName || 'public',
        ssl_mode: values.sslMode ?? 'prefer',
      },
    };
  if (values.kind === 'mysql')
    return {
      kind: 'mysql',
      name: values.name,
      credentials,
      config: { host: values.host, port: values.port, database: values.database, ssl: values.ssl },
    };
  const authenticationMode = values.authenticationMode ?? 'sql';
  return {
    kind: 'mssql',
    name: values.name,
    ...(authenticationMode === 'sql' ? { credentials } : {}),
    config: {
      host: values.host,
      port: values.port,
      database: values.database,
      schema_name: values.schemaName || 'dbo',
      authentication_mode: authenticationMode,
      encrypt: values.encrypt,
      trust_server_certificate: values.trustServerCertificate,
      odbc_driver: values.odbcDriver || 'ODBC Driver 18 for SQL Server',
    },
  };
}
export function RelationalDataSourceForm({ onSubmit }: Props) {
  const suggestionId = useId();
  const hostListId = `${suggestionId}-hosts`;
  const portListId = `${suggestionId}-ports`;
  const driverListId = `${suggestionId}-drivers`;
  const {
    register,
    control,
    watch,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RelationalDataSourceValues>({
    resolver: zodResolver(relationalDataSourceSchema),
    defaultValues: {
      kind: 'postgres',
      name: '',
      host: '',
      port: 5432,
      database: '',
      schemaName: 'public',
      authenticationMode: 'sql',
      username: '',
      password: '',
      sslMode: 'prefer',
      ssl: false,
      encrypt: true,
      trustServerCertificate: false,
      odbcDriver: 'ODBC Driver 18 for SQL Server',
    },
  });
  const kind = watch('kind');
  const windowsAuth = kind === 'mssql' && watch('authenticationMode') === 'windows';
  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(buildRelationalPayload(values));
    } catch (error) {
      const appError = error as AppError;
      if (appError.fieldErrors)
        Object.entries(appError.fieldErrors).forEach(([key, message]) =>
          setError(key as keyof RelationalDataSourceValues, { message }),
        );
      else setError('root', { message: appError.message ?? 'Unable to save data source.' });
    }
  });
  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {/* Source Definition */}
      <div className="form-grid-2">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <SingleSelect
              label="Database type"
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                const defaults = modelDefaultsByKind[next];
                setValue('port', defaults.port);
                setValue('schemaName', defaults.schemaName);
              }}
              options={kindOptions}
            />
          )}
        />
        <FormField
          label="Data source name"
          placeholder="e.g. Analytics DB"
          {...register('name')}
          error={errors.name?.message}
        />
      </div>

      {/* Connection Parameters */}
      <div className="form-section-divider">
        <span>Connection</span>
        <hr />
      </div>

      <div className="form-grid-host-port">
        <FormField
          label="Host"
          placeholder="e.g. localhost or db.example.com"
          list={hostListId}
          {...register('host')}
          error={errors.host?.message}
        />
        <FormField
          label="Port"
          type="number"
          list={portListId}
          min={1}
          max={65535}
          {...register('port', { valueAsNumber: true })}
          error={errors.port?.message}
        />
      </div>

      <ConnectionSuggestions
        kind={kind}
        hostListId={hostListId}
        portListId={portListId}
        driverListId={driverListId}
      />

      <div className={kind !== 'mysql' ? 'form-grid-2' : ''}>
        <FormField
          label="Database"
          placeholder="e.g. my_database"
          {...register('database')}
          error={errors.database?.message}
        />
        {kind !== 'mysql' ? (
          <FormField
            label="Schema"
            placeholder={kind === 'postgres' ? 'public' : 'dbo'}
            {...register('schemaName')}
            error={errors.schemaName?.message}
          />
        ) : null}
      </div>

      {/* Authentication */}
      <div className="form-section-divider">
        <span>Authentication</span>
        <hr />
      </div>

      {kind === 'mssql' && (
        <Controller
          control={control}
          name="authenticationMode"
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
      {windowsAuth ? (
        <p className="text-xs text-[var(--db-text-secondary)]">{windowsAuthenticationHelp}</p>
      ) : (
        <div className="form-grid-2">
          <FormField
            label="Username"
            autoComplete="username"
            placeholder="e.g. postgres"
            {...register('username')}
            error={errors.username?.message}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <SecretField
                label="Password"
                {...field}
                autoComplete="new-password"
                error={errors.password?.message}
              />
            )}
          />
        </div>
      )}

      {/* Security & Protocols */}
      <div className="form-section-divider">
        <span>Security</span>
        <hr />
      </div>

      {kind === 'postgres' ? (
        <Controller
          control={control}
          name="sslMode"
          render={({ field }) => (
            <SingleSelect
              label="SSL mode"
              value={field.value ?? 'prefer'}
              onChange={field.onChange}
              options={sslModeOptions}
            />
          )}
        />
      ) : null}

      {kind === 'mysql' ? (
        <Controller
          control={control}
          name="ssl"
          render={({ field }) => (
            <BooleanSwitch
              label="Use SSL connection"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      ) : null}

      {kind === 'mssql' ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-6">
            <Controller
              control={control}
              name="encrypt"
              render={({ field }) => (
                <BooleanSwitch
                  label="Encrypt connection"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={control}
              name="trustServerCertificate"
              render={({ field }) => (
                <BooleanSwitch
                  label="Trust server certificate"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="odbcDriver"
            render={({ field }) => (
              <FormField
                label="ODBC driver"
                list={driverListId}
                {...field}
                value={field.value ?? ''}
                error={errors.odbcDriver?.message}
              />
            )}
          />
          <p className="text-xs text-[var(--db-text-secondary)]">
            Use a driver installed on the machine running the API and worker.
          </p>
        </div>
      ) : null}

      {errors.root?.message ? (
        <div className="inline-error" role="alert">
          {errors.root.message}
        </div>
      ) : null}

      <div className="form-actions pt-2">
        <Button type="submit" variant="primary" isPending={isSubmitting}>
          Save data source
        </Button>
      </div>
    </form>
  );
}
function BooleanSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <Switch isSelected={value} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{label}</Label>
      </Switch.Content>
    </Switch>
  );
}
