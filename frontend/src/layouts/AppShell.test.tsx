import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { email: 'user@example.com', display_name: 'Alex' }, signOut: vi.fn() }) }));
vi.mock('../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ organizations: [{ id: 'org-1', name: 'Acme' }], activeOrganization: { id: 'org-1', name: 'Acme' }, setActiveOrganization: vi.fn() }) }));
vi.mock('../conversations/hooks/useConversations', () => ({
    useConversationList: () => ({ data: [] }),
    useDeleteConversation: () => ({ mutate: vi.fn() }),
}));
describe('AppShell', () => {
    beforeEach(() => localStorage.clear());

    it('exposes desktop and mobile navigation controls semantically', () => {
        render(<MemoryRouter initialEntries={['/ask']}><Routes><Route element={<AppShell />}><Route path="/ask" element={<div>Ask content</div>}/></Route></Routes></MemoryRouter>);
        expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
        expect(screen.getByText('Ask content')).toBeInTheDocument();
        expect(screen.getByText('Acme')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Skills' })).toHaveAttribute('href', '/skills');
    });

    it('keeps Skills outside the Settings navigation', () => {
        render(<MemoryRouter initialEntries={['/settings']}><Routes><Route element={<AppShell />}><Route path="/settings" element={<div>Settings content</div>}/></Route></Routes></MemoryRouter>);
        expect(screen.getByRole('link', { name: 'Skills' })).toHaveAttribute('href', '/skills');
        expect(screen.queryByText('AI Instructions & Commands')).not.toBeInTheDocument();
    });

    it('hides and restores chat history while persisting the collapsed state', async () => {
        const user = userEvent.setup();
        render(<MemoryRouter initialEntries={['/ask']}><Routes><Route element={<AppShell />}><Route path="/ask" element={<div>Ask content</div>}/></Route></Routes></MemoryRouter>);

        expect(screen.getByLabelText('Search conversation history')).toHaveClass('db-icon-search__input');
        await user.click(screen.getByRole('button', { name: 'Hide chat history' }));
        expect(screen.queryByText('Recent Analyses')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Search conversation history')).not.toBeInTheDocument();
        expect(localStorage.getItem('db-assistant.preferences.v1')).toContain('"sidebarCollapsed":true');

        await user.click(screen.getByRole('button', { name: 'Show chat history' }));
        expect(screen.getByText('Recent Analyses')).toBeInTheDocument();
        expect(screen.getByLabelText('Search conversation history')).toBeInTheDocument();
    });
});
