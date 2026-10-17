import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';
import { authSession } from './session-storage';

vi.mock('./auth-api', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1', display_name: 'Alex' }),
  logout: vi.fn().mockResolvedValue(undefined),
}));

it('clears the displayed user on sign-out without another page render', async () => {
  authSession.write({
    access_token: 'a',
    refresh_token: 'r',
    token_type: 'bearer',
    expires_in: 900,
  });
  function AccountProbe() {
    const { user, isAuthenticated, signOut } = useAuth();
    return (
      <>
        <p>{isAuthenticated ? user?.display_name : 'Signed out'}</p>
        <button onClick={() => void signOut()}>Sign out</button>
      </>
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AccountProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Alex')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
  expect(authSession.read()).toBeNull();
});
