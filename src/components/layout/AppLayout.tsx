import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { AlarmToast } from '../alarm/AlarmToast';

export function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <AlarmToast />
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 px-4 py-3 max-w-[1720px] w-full mx-auto">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
