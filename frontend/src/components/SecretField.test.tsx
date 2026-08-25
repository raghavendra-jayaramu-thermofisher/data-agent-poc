import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SecretField } from './SecretField';
describe('SecretField', () => {
    it('masks, reveals, and copies only the current in-memory value', async () => { const user = userEvent.setup(); const writeText = vi.mocked(navigator.clipboard.writeText); render(<SecretField label="Password" value="CurrentSecret123" onChange={() => { }}/>); const input = screen.getByLabelText('Password'); expect(input).toHaveAttribute('type', 'password'); await user.click(screen.getByRole('button', { name: 'Show' })); expect(input).toHaveAttribute('type', 'text'); await user.click(screen.getByRole('button', { name: 'Copy' })); expect(writeText).toHaveBeenCalledWith('CurrentSecret123'); expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument(); });
    it('disables copy when no value is available', () => { render(<SecretField label="API key" value="" onChange={() => { }}/>); expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled(); });
});
