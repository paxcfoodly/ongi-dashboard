import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate } from './routes/AuthGate';
import { AdminGate } from './routes/AdminGate';
import { LoginPage } from './pages/LoginPage';
import { KpiPage } from './pages/KpiPage';
import { AiPage } from './pages/AiPage';
import { CostPage } from './pages/CostPage';
import { LotHistoryPage } from './pages/LotHistoryPage';
import { LotManagePage } from './pages/admin/LotManagePage';
import { ClaimPage } from './pages/admin/ClaimPage';
import { DevicePage } from './pages/admin/DevicePage';
import { AlarmRulePage } from './pages/admin/AlarmRulePage';
import { TargetPage } from './pages/admin/TargetPage';
import { UserPage } from './pages/admin/UserPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGate />}>
          <Route path="/" element={<Navigate to="/kpi" replace />} />
          <Route path="/kpi" element={<KpiPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/cost" element={<CostPage />} />
          <Route path="/lot" element={<LotHistoryPage />} />
          <Route element={<AdminGate />}>
            <Route path="/admin/lots"        element={<LotManagePage />} />
            <Route path="/admin/claims"      element={<ClaimPage />} />
            <Route path="/admin/devices"     element={<DevicePage />} />
            <Route path="/admin/alarm-rules" element={<AlarmRulePage />} />
            <Route path="/admin/targets"     element={<TargetPage />} />
            <Route path="/admin/users"       element={<UserPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
