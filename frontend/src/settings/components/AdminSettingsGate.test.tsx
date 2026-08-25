import { describe, expect, it } from 'vitest';
import { hasAdminRole } from './AdminSettingsGate';

describe('settings role policy', () => {
  it('allows only owner/admin roles for audit and operations', () => {
    expect(hasAdminRole('owner')).toBe(true);
    expect(hasAdminRole('admin')).toBe(true);
    expect(hasAdminRole('member')).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
  });
});
