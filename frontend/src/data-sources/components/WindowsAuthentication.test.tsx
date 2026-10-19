import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from '../../api/types';
import { DataSourceEditForm } from './DataSourceEditForm';
import { RelationalDataSourceForm } from './RelationalDataSourceForm';

// Exercise form behavior independently of the shared select's popover implementation.
vi.mock('../../components/SingleSelect', () => ({
  SingleSelect: ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange(value: string): void;
    options: readonly { value: string; label: string }[];
  }) => (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

const source: DataSource = {
  id: 'source1',
  organization_id: 'org1',
  created_by: 'user1',
  name: 'Sales',
  created_at: '2026-10-05T00:00:00Z',
  updated_at: '2026-10-05T00:00:00Z',
  kind: 'mssql',
  display_type: 'mssql',
  status: 'active',
  last_error_code: null,
  last_tested_at: null,
  config: {
    host: 'localhost',
    port: 1433,
    database: 'sales',
    schema_name: 'dbo',
    encrypt: true,
    trust_server_certificate: false,
    odbc_driver: 'ODBC Driver 18 for SQL Server',
    authentication_mode: 'windows',
  },
};

describe('MSSQL Windows authentication', () => {
  it('toggles both security controls by clicking the track and submits their independent states', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RelationalDataSourceForm onSubmit={submit} />);
    await user.selectOptions(screen.getByLabelText('Database type'), 'mssql');
    await user.selectOptions(screen.getByLabelText('Authentication method'), 'windows');
    await user.type(screen.getByLabelText('Data source name'), 'Sales');
    await user.type(screen.getByLabelText('Host'), 'localhost');
    await user.type(screen.getByLabelText('Database'), 'sales');
    const encrypt = screen.getByRole('switch', { name: 'Encrypt connection' });
    const trust = screen.getByRole('switch', { name: 'Trust server certificate' });
    expect(encrypt).toBeChecked();
    expect(trust).not.toBeChecked();
    const track = (element: HTMLElement) => {
      const control = element
        .closest('[data-slot="switch"]')
        ?.querySelector('[data-slot="switch-control"]');
      if (!(control instanceof HTMLElement)) throw new Error('Switch track is missing');
      return control;
    };
    await user.click(track(encrypt));
    expect(encrypt).not.toBeChecked();
    expect(trust).not.toBeChecked();
    await user.click(track(trust));
    expect(trust).toBeChecked();
    expect(encrypt).not.toBeChecked();
    await user.click(screen.getByText('Encrypt connection'));
    expect(encrypt).toBeChecked();
    encrypt.focus();
    await user.keyboard('[Space]');
    expect(encrypt).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save data source' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0]![0].config).toMatchObject({
      encrypt: false,
      trust_server_certificate: true,
    });
  });

  it('creates a trusted connection without asking for or sending credentials', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RelationalDataSourceForm onSubmit={submit} />);
    await user.selectOptions(screen.getByLabelText('Database type'), 'mssql');
    await user.type(screen.getByLabelText('Data source name'), 'Sales');
    await user.type(screen.getByLabelText('Host'), 'localhost');
    await user.type(screen.getByLabelText('Database'), 'sales');
    await user.type(screen.getByLabelText('Username'), 'old-reader');
    await user.type(screen.getByLabelText('Password'), 'old-secret');
    await user.selectOptions(screen.getByLabelText('Authentication method'), 'windows');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByText(/Windows account running the API and worker/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save data source' }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const payload = submit.mock.calls[0]![0];
    expect(payload).not.toHaveProperty('credentials');
    expect(payload.config.authentication_mode).toBe('windows');
  });

  it('switches existing SQL authentication to Windows without resending old credentials', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <DataSourceEditForm
        source={{ ...source, config: { ...source.config, authentication_mode: 'sql' } }}
        onSubmit={submit}
      />,
    );
    await user.type(screen.getByLabelText('Username'), 'old-reader');
    await user.type(screen.getByLabelText('New password'), 'old-secret');
    await user.selectOptions(screen.getByLabelText('Authentication method'), 'windows');
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and test connection' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: undefined, config: { ...source.config } }),
        true,
      ),
    );
  });

  it('requires fresh credentials when changing a Windows connection to SQL authentication', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DataSourceEditForm source={source} onSubmit={submit} />);
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Authentication method'), 'sql');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter username and password when switching to SQL authentication.'),
    ).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Username'), 'reader');
    await user.type(screen.getByLabelText('New password'), 'fresh-secret');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: { username: 'reader', password: 'fresh-secret' },
          config: { ...source.config, authentication_mode: 'sql' },
        }),
        false,
      ),
    );
  });

  it('still requires credentials for PostgreSQL after selecting Windows on MSSQL', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<RelationalDataSourceForm onSubmit={submit} />);
    await user.selectOptions(screen.getByLabelText('Database type'), 'mssql');
    await user.selectOptions(screen.getByLabelText('Authentication method'), 'windows');
    await user.selectOptions(screen.getByLabelText('Database type'), 'postgres');
    await user.click(screen.getByRole('button', { name: 'Save data source' }));
    expect(await screen.findByText('Username is required')).toBeInTheDocument();
    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
