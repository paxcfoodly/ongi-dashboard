import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const dailyState = vi.hoisted(() => ({ isError: false }));
vi.mock('../hooks/usePeriodKpi', () => ({
  usePeriodDaily: () => dailyState.isError ? ({ isError: true, isLoading: false, data: undefined }) : ({
    isError: false,
    isLoading: false,
    data: [
      { day: '2026-01-05', production: 58, runtime_sec: 112, inspected: 30, defects: 1, unknown: 1, inspection_time_sec: 55.5, claims: 0 },
      { day: '2026-01-06', production: 0, runtime_sec: 0, inspected: 0, defects: 0, unknown: 0, inspection_time_sec: 0, claims: 0 },
    ],
  }),
  usePeriodLotManhours: () => ({ data: [] }),
  usePeriodLotLeadtimes: () => ({ data: [] }),
  usePeriodHrKpi: () => ({ data: { job: null, satisfaction: null } }),
}));

vi.mock('../hooks/useDeviceStatus', () => ({
  useDeviceStatus: () => ({ data: [] }),
}));

vi.mock('../hooks/useAlarms', () => ({
  useAlarms: () => ({ data: [] }),
}));

function wrap(ui: React.ReactNode, entry = '/kpi') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
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

  it('LOT별 작업공수 차트는 헤드라인과 같은 30일 창임을 표시한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('LOT별 작업공수 (최근 30일 · 최근 10건)')).toBeInTheDocument();
  });

  it('오늘 모드에는 설비별 가동 상태와 오늘 목표 달성률 영역이 유지된다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('설비별 가동 상태')).toBeInTheDocument();
    expect(screen.getByText('최근 알람')).toBeInTheDocument();
  });

  describe('기간 모드', () => {
    const period = '/kpi?from=2026-01-05&to=2026-01-06';

    it('일별 조회 실패 시 로딩 대신 오류 안내를 표시한다', () => {
      dailyState.isError = true;
      try {
        render(wrap(<KpiPage />, period));
        expect(screen.getByRole('alert')).toHaveTextContent('기간 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        expect(screen.queryByText(/로딩 중/)).not.toBeInTheDocument();
      } finally {
        dailyState.isError = false;
      }
    });

    it('설비 상태·오늘 목표 달성률은 숨기고 최근 알람은 유지한다', () => {
      render(wrap(<KpiPage />, period));
      expect(screen.queryByText('설비별 가동 상태')).not.toBeInTheDocument();
      expect(screen.queryByText('오늘 목표 달성률')).not.toBeInTheDocument();
      expect(screen.getByText('최근 알람')).toBeInTheDocument();
    });

    it('날짜별 KPI 표에 일별 행과 합계·평균이 표시된다', () => {
      render(wrap(<KpiPage />, period));
      const table = screen.getByText('날짜별 KPI').closest('section')!;
      expect(within(table).getByText('2026-01-05')).toBeInTheDocument();
      expect(within(table).getByText('2026-01-06')).toBeInTheDocument();
      const foot = table.querySelector('tfoot')!;
      expect(within(foot as HTMLElement).getByText('합계 58')).toBeInTheDocument();
      expect(within(foot as HTMLElement).getByText('평균 1,864')).toBeInTheDocument();
      // 01-06 행은 생산 0 이므로 시간당 생산량이 값 없음(—)
      const row = within(table).getByText('2026-01-06').closest('tr')!;
      expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
      expect(row.querySelectorAll('td')[3].textContent).toBe('—');
    });

    it('생산성 카드는 기간 총합 기준 값을 표시한다', () => {
      render(wrap(<KpiPage />, period));
      const card = screen.getByText('생산성 (시간당 생산량)').closest('div')!.parentElement!;
      expect(within(card).getByText('1,864')).toBeInTheDocument();
    });

    it('기간 모드 차트 제목을 표시한다', () => {
      render(wrap(<KpiPage />, period));
      expect(screen.getByText('일자별 생산량 (선택 기간)')).toBeInTheDocument();
      expect(screen.getByText('LOT별 작업공수 (선택 기간 · 최근 10건)')).toBeInTheDocument();
    });
  });
});
