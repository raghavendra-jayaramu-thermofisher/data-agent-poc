import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageLoading } from '../../components/PageState';
export function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    if (isLoading)
        return <PageLoading label="Restoring your session…"/>;
    if (!isAuthenticated)
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>;
    return <Outlet />;
}
