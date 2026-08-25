import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema } from './auth-schemas';
describe('auth validation', () => {
    it('rejects an invalid login email', () => expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false));
    it('accepts a login payload without imposing signup complexity', () => expect(loginSchema.safeParse({ email: 'user@example.com', password: 'whatever' }).success).toBe(true));
    it.each(['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoNumberHere'])('rejects invalid signup password %s', password => expect(signupSchema.safeParse({ email: 'user@example.com', password }).success).toBe(false));
    it('accepts backend-compatible signup password rules', () => expect(signupSchema.safeParse({ email: 'user@example.com', password: 'StrongPass123' }).success).toBe(true));
});
