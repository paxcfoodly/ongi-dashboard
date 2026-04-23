import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AuthGate() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-text-dim">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
