import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KpiPage } from './KpiPage';

const PACK = { id: 'p', code: 'packaging_01', name: '삼면포장기', type: 'equipment', role: 'primary_output', last_seen_at: null };
const VIS = { id: 'v', code: 'vision_01', name: 'AI 비전검사기', type: 'vision_inspector', role: 'inspection', last_seen_at: null };
const secAgo = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const packRow = (over = {}) => ({ id: 1, device_id: 'p', bucket_at: secAgo(70), created_at: secAgo(10), runtime_seconds: 58, output_count: 30, devices: { name: '삼면포장기' }, ...over });
const visRow = (over = {}) => ({ id: 1, device_id: 'v', bucket_at: secAgo(70), created_at: secAgo(8), total_inspected: 12, good_count: 10, defect_count: 1, unknown_count: 1, devices: { name: 'AI 비전검사기' }, ...over });

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
  useDeviceStatus: () => ({ data: liveState.devices }),
}));

const liveState = vi.hoisted(() => ({
  devices: [] as unknown[],
  equipment: [] as unknown[],
  vision: [] as unknown[],
  isError: false,
  alarms: [] as unknown[],
  alarmsError: false,
  totalsMissing: false,
}));

vi.mock('../hooks/useAlarms', () => ({
  useAlarms: () => (liveState.alarmsError ? { data: undefined, isError: true } : { data: liveState.alarms, isError: false }),
}));

vi.mock('../hooks/useLiveMetrics', () => ({
  LIVE_REFRESH_MS: 10_000,
  useLiveEquipment: () => ({ data: liveState.equipment, isError: liveState.isError }),
  useLiveVision: () => ({ data: liveState.vision, isError: false }),
  useTodayTotals: () => ({ data: liveState.totalsMissing ? undefined : { production: 696, inspected: 231, defects: 3, unknown: 117 } }),
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
  it('성과지표 8개 카드를 한 묶음으로 렌더링한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByRole('heading', { name: '성과지표' })).toBeInTheDocument();
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

  it('성과지표가 오늘 목표 달성률보다 위에 있다', () => {
    render(wrap(<KpiPage />));
    const kpis = screen.getByRole('region', { name: '성과지표' });
    const goal = screen.getByRole('region', { name: '오늘 목표 달성률' });
    expect(kpis.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('최근 분당 생산량 차트를 표시한다', () => {
    render(wrap(<KpiPage />));
    expect(screen.getByText('최근 30분 분당 생산량')).toBeInTheDocument();
  });

  describe('실시간 상태와 패킷', () => {
    afterEach(() => {
      Object.assign(liveState, { devices: [], equipment: [], vision: [], isError: false, alarms: [], alarmsError: false, totalsMissing: false });
    });

    const panel = (name: string) => screen.getByRole('article', { name: `${name} 가동 상태` });

    it('최근 패킷에 실적이 있으면 가동중과 오늘 수치를 표시한다', () => {
      Object.assign(liveState, { devices: [PACK, VIS], equipment: [packRow()], vision: [visRow()] });
      render(wrap(<KpiPage />));
      expect(within(panel('삼면포장기')).getByText('가동중')).toBeInTheDocument();
      expect(within(panel('삼면포장기')).getByText('696')).toBeInTheDocument();
      expect(within(panel('삼면포장기')).getByText('30 ea')).toBeInTheDocument();
      expect(within(panel('AI 비전검사기')).getByText('가동중')).toBeInTheDocument();
      expect(within(panel('AI 비전검사기')).getByText('117건')).toBeInTheDocument();
    });

    it('패킷은 오는데 생산이 0이면 가동중이 아니라 대기로 표시한다', () => {
      Object.assign(liveState, { devices: [PACK], equipment: [packRow({ output_count: 0, runtime_seconds: 0 })] });
      render(wrap(<KpiPage />));
      expect(within(panel('삼면포장기')).getByText('대기')).toBeInTheDocument();
      expect(within(panel('삼면포장기')).queryByText('가동중')).not.toBeInTheDocument();
    });

    it('가동시간이 있어도 생산이 0이면 대기로 표시한다', () => {
      Object.assign(liveState, { devices: [PACK], equipment: [packRow({ output_count: 0, runtime_seconds: 42 })] });
      render(wrap(<KpiPage />));
      expect(within(panel('삼면포장기')).getByText('대기')).toBeInTheDocument();
    });

    it('오늘 합계를 못 불러오면 0 대신 값 없음을 표시한다', () => {
      Object.assign(liveState, { devices: [PACK, VIS], totalsMissing: true });
      render(wrap(<KpiPage />));
      expect(within(panel('삼면포장기')).getByText('—', { selector: 'div.text-\\[30px\\], div.text-\\[30px\\] *' })).toBeInTheDocument();
      expect(within(panel('AI 비전검사기')).queryByText('0건')).not.toBeInTheDocument();
    });

    it('알람 조회가 실패하면 알람 없음으로 보이지 않고 오류를 안내한다', () => {
      liveState.alarmsError = true;
      render(wrap(<KpiPage />));
      expect(screen.getByRole('alert')).toHaveTextContent('최근 알람을 불러오지 못했습니다');
      expect(screen.queryByText('최근 알람이 없습니다.')).not.toBeInTheDocument();
    });

    it('수신이 끊긴 장비는 통신 끊김과 경과 시간을 표시한다', () => {
      Object.assign(liveState, { devices: [PACK, VIS], equipment: [packRow()], vision: [visRow({ created_at: secAgo(400) })] });
      render(wrap(<KpiPage />));
      expect(within(panel('AI 비전검사기')).getByText('통신 끊김')).toBeInTheDocument();
      expect(within(panel('AI 비전검사기')).getByText(/6분 \d+초 전/)).toBeInTheDocument();
      expect(within(panel('삼면포장기')).getByText('가동중')).toBeInTheDocument();
    });

    it('서버가 준 모니터링 장비만 표시한다', () => {
      Object.assign(liveState, { devices: [PACK, VIS] });
      render(wrap(<KpiPage />));
      expect(screen.getAllByRole('article')).toHaveLength(2);
    });

    it('패킷 목록은 생산량·시간 등 필요한 값만 수신 최신순으로 보여준다', () => {
      Object.assign(liveState, { devices: [PACK, VIS], equipment: [packRow()], vision: [visRow()] });
      render(wrap(<KpiPage />));
      const feed = screen.getByRole('complementary', { name: '실시간 수신 패킷' });
      const rows = within(feed).getAllByTestId('live-packet');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('검사 12 · 양품 10 · 불량 1 · 재검 1');
      expect(rows[1]).toHaveTextContent('생산 30 ea · 가동 58초');
      expect(within(feed).getByText('실시간 수신')).toBeInTheDocument();
    });

    it('패킷이 없으면 수신 중단과 안내를, 조회 실패면 오류를 표시한다', () => {
      Object.assign(liveState, { devices: [PACK] });
      const { unmount } = render(wrap(<KpiPage />));
      const feed = screen.getByRole('complementary', { name: '실시간 수신 패킷' });
      expect(within(feed).getByText('수신 중단')).toBeInTheDocument();
      expect(within(feed).getByText('아직 수신된 패킷이 없습니다')).toBeInTheDocument();
      unmount();
      liveState.isError = true;
      render(wrap(<KpiPage />));
      expect(screen.getByRole('alert')).toHaveTextContent('패킷을 불러오지 못했습니다');
    });

    it('기간 모드에는 패킷 목록이 없다', () => {
      render(wrap(<KpiPage />, '/kpi?from=2026-01-05&to=2026-01-06'));
      expect(screen.queryByRole('complementary', { name: '실시간 수신 패킷' })).not.toBeInTheDocument();
    });
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
