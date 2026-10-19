import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionDiagnosticsPanel } from './ConnectionDiagnosticsPanel';

vi.mock('../../components/notifications', () => ({
  notifications: { success: vi.fn(), error: vi.fn() },
}));
const diagnostics = {
  category: 'authentication',
  stage: 'connection test',
  message: 'The database rejected the login.',
  driver_message: "Login failed for user '[redacted]' (18456)",
  sqlstate: '28000',
  error_number: 18456,
  next_steps: ['Check the username and password.'],
  job_id: 'j1',
};
function show(canManage = true, details: typeof diagnostics | null = diagnostics) {
  const onTest = vi.fn();
  render(
    <MemoryRouter>
      <ConnectionDiagnosticsPanel
        diagnostics={details}
        code="DATASOURCE_CONNECTION_AUTHENTICATION"
        sourceId="s1"
        canManage={canManage}
        testing={false}
        onTest={onTest}
      />
    </MemoryRouter>,
  );
  return onTest;
}
describe('connection diagnostics', () => {
  it('shows evidence, troubleshooting, job link, retry and copying', async () => {
    const retry = show();
    const user = userEvent.setup();
    expect(screen.getByText(diagnostics.message)).toBeInTheDocument();
    expect(screen.getByText(diagnostics.next_steps[0]!)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit connection' })).toHaveAttribute(
      'href',
      '/data-sources/s1/edit',
    );
    expect(screen.getByRole('link', { name: 'View test result' })).toHaveAttribute(
      'href',
      '/jobs/j1',
    );
    await user.click(screen.getByText('Technical details'));
    expect(screen.getByText('28000')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Test again' }));
    expect(retry).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Copy diagnostics' }));
    expect(await navigator.clipboard.readText()).toContain('[redacted]');
  });
  it('respects member permissions and supports failures recorded before diagnostics existed', () => {
    show(false, null);
    expect(screen.getByText(/Test the connection again/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit connection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test again' })).not.toBeInTheDocument();
  });
});
