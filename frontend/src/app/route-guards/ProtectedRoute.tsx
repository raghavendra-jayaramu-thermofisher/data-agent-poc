import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { Spinner } from '@heroui/react';
export function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading)
        return <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading"><Spinner /></div>;
    if (!isAuthenticated)
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
    return <Outlet />;
}
