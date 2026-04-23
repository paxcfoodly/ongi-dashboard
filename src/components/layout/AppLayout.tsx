import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { Footer } from './Footer';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { role } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabBar showAdmin={role === 'admin'} />
      <main className="flex-1 px-6 py-5 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
