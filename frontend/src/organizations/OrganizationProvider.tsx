import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren, } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Organization } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { useAuth } from '../auth/AuthProvider';
import { preferences } from '../lib/preferences';
import { listOrganizations } from './organization-api';
import { setApiOrganizationId } from './organization-store';
type Value = {
    organizations: Organization[];
    activeOrganization: Organization | null;
    isLoading: boolean;
    setActiveOrganization(id: string): void;
};
const Ctx = createContext<Value | null>(null);
export function OrganizationProvider({ children }: PropsWithChildren) {
    const { isAuthenticated } = useAuth();
    const queryClient = useQueryClient();
    const organizationsQuery = useQuery({
        queryKey: queryKeys.organizations.list,
        queryFn: listOrganizations,
        enabled: isAuthenticated,
        retry: false,
    });
    const [activeId, setActiveId] = useState<string | null>(() => preferences.get('lastOrganizationId') ?? null);
    const organizations = organizationsQuery.data ?? [];
    const activeOrganization = organizations.find((organization) => organization.id === activeId) ?? organizations[0] ?? null;
    useEffect(() => {
        if (!isAuthenticated) {
            setApiOrganizationId(null);
            return;
        }
        const id = activeOrganization?.id ?? null;
        setApiOrganizationId(id);
        if (id) {
            if (id !== activeId)
                setActiveId(id);
            preferences.set('lastOrganizationId', id);
        }
    }, [activeId, activeOrganization?.id, isAuthenticated]);
    function setActiveOrganization(id: string) {
        if (!organizations.some((organization) => organization.id === id))
            return;
        setActiveId(id);
        setApiOrganizationId(id);
        preferences.set('lastOrganizationId', id);
        // Reset organization-owned server state so the previous workspace's data
        // cannot remain visible while the new workspace refetches.
        void queryClient.resetQueries({
            predicate: (query) => {
                const root = query.queryKey[0];
                return root !== 'auth' && root !== 'organizations';
            },
        });
    }
    const value = useMemo(() => ({
        organizations,
        activeOrganization,
        isLoading: organizationsQuery.isLoading,
        setActiveOrganization,
    }), [activeOrganization, organizations, organizationsQuery.isLoading]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useOrganization() {
    const value = useContext(Ctx);
    if (!value)
        throw new Error('useOrganization must be used inside OrganizationProvider');
    return value;
}
