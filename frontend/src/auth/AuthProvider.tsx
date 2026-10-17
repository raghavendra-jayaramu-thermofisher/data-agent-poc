import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import type { User } from '../api/client';
import { authSession } from './session-storage';
import * as authApi from './auth-api';
import type { LoginValues, SignupValues } from './schemas/auth-schemas';
type AuthContextValue = {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn(v: LoginValues): Promise<void>;
    signUp(v: SignupValues): Promise<void>;
    signOut(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();
    const hasSession = Boolean(authSession.read()?.refresh_token);
    const me = useQuery({ queryKey: queryKeys.auth.me, queryFn: authApi.getCurrentUser, enabled: hasSession, retry: false, staleTime: 60000 });
    const establish = useCallback(async (tokens: Awaited<ReturnType<typeof authApi.login>>) => { authSession.write(tokens); await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }); await queryClient.fetchQuery({ queryKey: queryKeys.auth.me, queryFn: authApi.getCurrentUser }); }, [queryClient]);
    const signIn = useCallback(async (values: LoginValues) => establish(await authApi.login(values)), [establish]);
    const signUp = useCallback(async (values: SignupValues) => establish(await authApi.signup(values)), [establish]);
    const signOut = useCallback(async () => {
        const refresh = authSession.read()?.refresh_token;
        try {
            if (refresh)
                await authApi.logout(refresh);
        }
        finally {
            authSession.clear();
            // Notify mounted auth consumers before removing their cached query.
            queryClient.setQueryData(queryKeys.auth.me, null);
            queryClient.clear();
        }
    }, [queryClient]);
    const value = useMemo(() => ({ user: me.data ?? null, isLoading: hasSession && me.isLoading, isAuthenticated: Boolean(me.data), signIn, signUp, signOut }), [me.data, me.isLoading, hasSession, signIn, signUp, signOut]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
