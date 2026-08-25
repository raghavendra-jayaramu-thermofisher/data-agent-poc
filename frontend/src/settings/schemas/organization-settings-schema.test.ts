import { describe, expect, it } from 'vitest';
import { organizationSettingsSchema } from './organization-settings-schema';

describe('organization settings schema', () => {
  it('trims and accepts a valid organization name', () => {
    expect(organizationSettingsSchema.parse({ name: '  Acme Analytics  ' }).name).toBe('Acme Analytics');
  });
  it('rejects blank and overlong names', () => {
    expect(organizationSettingsSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(organizationSettingsSchema.safeParse({ name: 'x'.repeat(161) }).success).toBe(false);
  });
});
