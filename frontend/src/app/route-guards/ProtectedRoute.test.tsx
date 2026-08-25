import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi, describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
vi.mock('../../auth/AuthProvider', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../../auth/AuthProvider';
const mockUseAuth = vi.mocked(useAuth);
describe('ProtectedRoute', () => {
    it('redirects unauthenticated users to login', () => { mockUseAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() }); render(<MemoryRouter initialEntries={['/ask']}><Routes><Route path="/login" element={<div>Login screen</div>}/><Route element={<ProtectedRoute />}><Route path="/ask" element={<div>Ask screen</div>}/></Route></Routes></MemoryRouter>); expect(screen.getByText('Login screen')).toBeInTheDocument(); });
    it('renders protected content for an authenticated session', () => { mockUseAuth.mockReturnValue({ user: { id: 'u', email: 'u@e.com', display_name: null, is_active: true, email_verified_at: null, created_at: '', updated_at: '' }, isLoading: false, isAuthenticated: true, signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn() }); render(<MemoryRouter initialEntries={['/ask']}><Routes><Route element={<ProtectedRoute />}><Route path="/ask" element={<div>Ask screen</div>}/></Route></Routes></MemoryRouter>); expect(screen.getByText('Ask screen')).toBeInTheDocument(); });
});
