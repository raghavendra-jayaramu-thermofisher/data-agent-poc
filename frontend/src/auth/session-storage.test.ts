import { describe, expect, it } from 'vitest';
import { authSession } from './session-storage';
import { preferences } from '../lib/preferences';
describe('storage boundaries', () => {
    it('restores auth tokens only from centralized session storage', () => { authSession.write({ access_token: 'a', refresh_token: 'r'.repeat(32), expires_in: 900, token_type: 'bearer' }); expect(authSession.read()?.access_token).toBe('a'); expect(localStorage.length).toBe(0); });
    it('stores only safe preferences in localStorage', () => { preferences.set('sidebarCollapsed', true); preferences.set('lastOrganizationId', 'org-1'); expect(preferences.get('sidebarCollapsed')).toBe(true); expect(localStorage.getItem('db-assistant.preferences.v1')).not.toContain('password'); });
    it('clears session tokens on logout boundary', () => { authSession.write({ access_token: 'a', refresh_token: 'r'.repeat(32), expires_in: 900, token_type: 'bearer' }); authSession.clear(); expect(authSession.read()).toBeNull(); });
});
