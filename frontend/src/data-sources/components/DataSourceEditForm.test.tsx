import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from '../../api/types';
import { DataSourceEditForm } from './DataSourceEditForm';

const source: DataSource = {
  organization_id: 'org1',
  created_by: 'u1',
  created_at: '2026-10-04T00:00:00Z',
  updated_at: '2026-10-04T00:00:00Z',
  last_tested_at: null,
  last_error_code: null,
  id: 's1',
  name: 'Sales Data',
  kind: 'postgres',
  display_type: 'postgres',
  status: 'active',
  config: {
    host: 'old.example.com',
    port: 5432,
    database: 'sales',
    schema_name: 'public',
    ssl_mode: 'require',
  },
};

describe('editing data-source connections', () => {
  it('prefills name and connection details and saves host changes without credentials', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<DataSourceEditForm source={source} onSubmit={submit} />);
    const user = userEvent.setup();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Sales Data');
    expect(screen.getByRole('spinbutton', { name: 'Port' })).toHaveValue(5432);
    expect(screen.getByRole('textbox', { name: 'Database' })).toHaveValue('sales');
    const host = screen.getByRole('combobox', { name: 'Host' });
    expect(host).toHaveValue('old.example.com');
    await user.clear(host);
    await user.type(host, 'new.example.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        {
          name: 'Sales Data',
          status: 'active',
          credentials: undefined,
          config: { ...source.config, host: 'new.example.com' },
        },
        false,
      ),
    );
  });

  it('does not resend unchanged config and requests a test when chosen', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<DataSourceEditForm source={source} onSubmit={submit} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save and test connection' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        { name: 'Sales Data', status: 'active', credentials: undefined },
        true,
      ),
    );
  });

  it('validates ports and requires both fields for credential replacement', async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(<DataSourceEditForm source={source} onSubmit={submit} />);
    const port = screen.getByRole('spinbutton', { name: 'Port' });
    await user.clear(port);
    await user.type(port, '70000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(submit).not.toHaveBeenCalled();
    await user.clear(port);
    await user.type(port, '5432');
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'reader');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('Enter both username and password to replace credentials.'),
    ).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('New password'), 'replacement');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: { username: 'reader', password: 'replacement' } }),
        false,
      ),
    );
  });

  it.each(['mysql', 'mssql'] as const)('shows and preserves %s options', async (kind) => {
    const config =
      kind === 'mysql'
        ? { host: 'db.example.com', port: 3306, database: 'sales', ssl: true }
        : {
            host: 'db.example.com',
            port: 1433,
            database: 'sales',
            schema_name: 'dbo',
            encrypt: true,
            trust_server_certificate: false,
            odbc_driver: 'ODBC Driver 18 for SQL Server',
          };
    const submit = vi.fn().mockResolvedValue(undefined);
    render(
      <DataSourceEditForm
        source={{ ...source, kind, display_type: kind, config }}
        onSubmit={submit}
      />,
    );
    expect(
      screen.getByRole('checkbox', {
        name: kind === 'mysql' ? 'Use SSL connection' : 'Encrypt connection',
      }),
    ).toBeChecked();
    const host = screen.getByRole('combobox', { name: 'Host' });
    const user = userEvent.setup();
    await user.clear(host);
    await user.type(host, 'fixed.example.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        expect.objectContaining({ config: { ...config, host: 'fixed.example.com' } }),
        false,
      ),
    );
  });

  it('keeps Excel edits separate from database connection and credentials', () => {
    render(
      <DataSourceEditForm
        source={{ ...source, kind: 'duckdb', display_type: 'excel', config: {} }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.queryByRole('combobox', { name: 'Host' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Username' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and test connection' }),
    ).not.toBeInTheDocument();
  });
});
