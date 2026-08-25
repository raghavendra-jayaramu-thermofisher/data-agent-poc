import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { email: 'user@example.com', display_name: 'Alex' }, signOut: vi.fn() }) }));
vi.mock('../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ organizations: [{ id: 'org-1', name: 'Acme' }], activeOrganization: { id: 'org-1', name: 'Acme' }, setActiveOrganization: vi.fn() }) }));
describe('AppShell', () => {
    it('exposes desktop and mobile navigation controls semantically', () => {
        render(<MemoryRouter initialEntries={['/ask']}><Routes><Route element={<AppShell />}><Route path="/ask" element={<div>Ask content</div>}/></Route></Routes></MemoryRouter>);
        expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
        expect(screen.getByText('Ask content')).toBeInTheDocument();
        expect(screen.getByText('Acme')).toBeInTheDocument();
    });
});
