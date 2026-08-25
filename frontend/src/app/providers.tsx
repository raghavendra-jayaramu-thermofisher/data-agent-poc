import { Toast } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { JobManagerProvider } from '../jobs/JobManagerProvider';
import { OrganizationProvider } from '../organizations/OrganizationProvider';
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: false } } });
export function AppProviders({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}><AuthProvider><OrganizationProvider><JobManagerProvider>{children}</JobManagerProvider></OrganizationProvider></AuthProvider><Toast.Provider placement="bottom"/></QueryClientProvider>; }
