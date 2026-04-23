import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KpiPage } from './KpiPage';

vi.mock('../hooks/useKpiData', () => ({
  useKpiData: () => ({
    data: {
      today_production: 11240,
      runtime_sec_today: 22110,
      hourly_production: 1832,
      work_time_per_ea: 1.97,
      inspected: 11240,
      defects: 90,
      defect_rate_pct: 0.80,
      claims_count: 0,
    },
    isLoading: false,
  }),
  useHourlyProduction: () => ({ data: [] }),
}));

vi.mock('../hooks/useCostRatio', () => ({
  useCostRatio: () => ({ data: { wip_total: 1250, total_production: 11240, cost_ratio_pct: 11.2 } }),
  useCostRatio7Days: () => ({ data: [] }),
}));

vi.mock('../hooks/useDeviceStatus', () => ({
  useDeviceStatus: () => ({ data: [] }),
}));

vi.mock('../hooks/useAlarms', () => ({
  useAlarms: () => ({ data: [] }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('KpiPage', () => {
  it('renders all 6 KPI cards with values', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('오늘 생산량')).toBeInTheDocument();
    expect(screen.getAllByText('11,240').length).toBeGreaterThan(0);
    expect(screen.getByText('시간당 생산량')).toBeInTheDocument();
    expect(screen.getByText('1,832')).toBeInTheDocument();
    expect(screen.getByText('작업시간 / ea')).toBeInTheDocument();
    expect(screen.getByText('불량률')).toBeInTheDocument();
    expect(screen.getByText('제조원가 비율')).toBeInTheDocument();
    expect(screen.getByText('고객 클레임')).toBeInTheDocument();
  });

  it('renders formula boxes with calculation results', () => {
    render(wrap(<KpiPage />));
    expect(screen.getAllByText(/산출식:/).length).toBeGreaterThanOrEqual(6);
  });
});
