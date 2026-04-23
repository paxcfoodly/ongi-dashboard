import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AdminGate() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <div className="text-xl font-semibold mb-2">접근 권한이 없습니다</div>
        <div className="text-text-dim">관리자 권한이 필요한 페이지입니다.</div>
      </div>
    );
  }
  return <Outlet />;
}
