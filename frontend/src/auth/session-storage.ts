import type { components } from '../api/generated/schema';
type TokenResponse = components['schemas']['TokenResponse'];
const KEY = 'db-assistant.auth.v1';
export type AuthTokens = Pick<TokenResponse, 'access_token' | 'refresh_token' | 'expires_in' | 'token_type'>;
export const authSession = {
    read(): AuthTokens | null {
        try {
            const raw = sessionStorage.getItem(KEY);
            return raw ? JSON.parse(raw) as AuthTokens : null;
        }
        catch {
            return null;
        }
    },
    write(tokens: AuthTokens) { sessionStorage.setItem(KEY, JSON.stringify(tokens)); },
    clear() { sessionStorage.removeItem(KEY); },
};
