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

// 목표값 조회 오류 시뮬레이션용 (테스트에서 true 로 바꿈)
const targetsState = vi.hoisted(() => ({ isError: false }));
vi.mock('../hooks/useKpiTargets', () => ({
  useKpiTargets: () => targetsState.isError ? { data: undefined, isError: true } : ({
    isError: false,
    data: {
      hourly_production_baseline: 1500, hourly_production: 1800,
      defect_rate_baseline: 2.0, defect_rate_max: 1.0,
      work_time_baseline: 2.4, work_time_per_ea: 2.0,
      manhour_baseline: 24, manhour_target: 16, lot_weight_kg: 300,
      leadtime_baseline: 15, leadtime_target: 12,
      job_conversion_baseline: 0, job_conversion_target: 50,
      satisfaction_baseline: 0, satisfaction_target: 4.5,
      claim_quarterly_baseline: 4, claim_quarterly_max: 1,
      daily_production: 15000,
    },
  }),
}));

vi.mock('../hooks/useManhourKpi', () => ({
  useManhourKpi: () => ({ data: { lot_count: 3, avg_man_hour: 17.5, latest_man_hour: 16.8 } }),
  useLeadtimeKpi: () => ({ data: { lot_count: 2, avg_lead_days: 13 } }),
  useRecentLotManhours: () => ({ data: [] }),
}));

vi.mock('../hooks/useHrKpi', () => ({
  useLatestHrKpi: () => ({ data: { job: null, satisfaction: null } }),
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
  it('공통/자율 성과지표 8개 카드를 렌더링한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('공통 성과지표')).toBeInTheDocument();
    expect(screen.getByText('자율 성과지표')).toBeInTheDocument();
    for (const label of [
      '생산성 (시간당 생산량)', '품질 (불량률)', '작업시간 / ea',
      '원가 (LOT당 작업공수)', '납기 (수주→출하)',
      '인력 직무 전환율', '직무 전환 후 만족도', '고객 클레임',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('17.5')).toBeInTheDocument();
    expect(screen.queryByText('제조원가 비율')).not.toBeInTheDocument();
  });

  it('인력 기록이 없으면 두 카드 모두 입력된 기록 없음을 표시한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getAllByText('입력된 기록 없음')).toHaveLength(2);
  });

  it('카드마다 산출식 박스를 표시한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getAllByText(/산출식:/).length).toBeGreaterThanOrEqual(8);
  });

  it('목표값 조회 실패 시 화면에 오류 안내를 표시한다', () => {
    targetsState.isError = true;
    try {
      render(wrap(<KpiPage />));
      expect(screen.getByRole('alert')).toHaveTextContent('목표값을 불러오지 못했습니다 — 새로고침 해주세요');
    } finally {
      targetsState.isError = false;
    }
  });

  it('목표값이 정상 로드되면 오류 안내가 없다', () => {
    render(wrap(<KpiPage />));
    expect(screen.queryByText(/목표값을 불러오지 못했습니다/)).not.toBeInTheDocument();
  });
});
