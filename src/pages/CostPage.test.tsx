import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({
  manhour: null as unknown,
  leadtime: null as unknown,
  lots: [] as unknown[],
  leads: [] as unknown[],
  targetsError: false,
  periodLots: [] as unknown[],
  periodLeads: [] as unknown[],
}));

vi.mock('../hooks/useKpiTargets', () => ({
  useKpiTargets: () => state.targetsError ? { data: undefined, isError: true } : ({
    isError: false,
    data: {
      manhour_baseline: 24, manhour_target: 16, lot_weight_kg: 300,
      leadtime_baseline: 15, leadtime_target: 12,
    },
  }),
}));

vi.mock('../hooks/useManhourKpi', () => ({
  useManhourKpi: () => ({ data: state.manhour }),
  useLeadtimeKpi: () => ({ data: state.leadtime }),
  useRecentLotManhours: () => ({ data: state.lots }),
  useRecentLotLeadtimes: () => ({ data: state.leads }),
}));

vi.mock('../hooks/usePeriodKpi', () => ({
  usePeriodLotManhours: () => ({ data: state.periodLots }),
  usePeriodLotLeadtimes: () => ({ data: state.periodLeads }),
}));

vi.mock('../hooks/useLlmAnalyze', () => ({
  useCostImprovement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { CostPage } from './CostPage';

function render(ui: React.ReactNode, entry = '/cost') {
  return rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>);
}

describe('CostPage', () => {
  beforeEach(() => {
    state.manhour = { lot_count: 2, avg_man_hour: 17.5, latest_man_hour: 16.8 };
    state.leadtime = { lot_count: 2, avg_lead_days: 13 };
    state.lots = [
      { id: 'a', lot_no: 'LOT-A1', started_at: '2026-10-20T00:00:00Z', ended_at: '2026-10-20T04:00:00Z', worker_count: 4, work_hours: 4, man_hour: 16 },
      { id: 'b', lot_no: 'LOT-B2', started_at: '2026-10-21T00:00:00Z', ended_at: '2026-10-21T04:00:00Z', worker_count: 5, work_hours: 4, man_hour: 20 },
    ];
    state.leads = [
      { id: 'a', lot_no: 'LOT-A1', ordered_at: '2026-10-01', shipped_at: '2026-10-14', lead_days: 13 },
    ];
    state.targetsError = false;
    state.periodLots = [];
    state.periodLeads = [];
  });

  it('작업공수 히어로, LOT 표, 납기 섹션을 표시하고 재공재고는 없다', () => {
    render(<CostPage />);
    expect(screen.getByText(/LOT당 작업공수/)).toBeInTheDocument();
    expect(screen.getByText('기존 24 → 목표 16 man-hour')).toBeInTheDocument();
    expect(screen.getByText(/33\.3%/)).toBeInTheDocument();
    expect(screen.getAllByText('LOT-A1').length).toBe(2);
    expect(screen.getByText('LOT-B2')).toBeInTheDocument();
    expect(screen.getByText('납기 (수주→출하)')).toBeInTheDocument();
    expect(screen.getByText('기존 15 → 목표 12일')).toBeInTheDocument();
    expect(screen.queryByText(/재공재고/)).toBeNull();
    expect(screen.getByText('원가(작업공수) 개선 방안 분석 요청')).toBeInTheDocument();
  });

  it('데이터가 없으면 사유 문구를 표시한다', () => {
    state.manhour = { lot_count: 0, avg_man_hour: null, latest_man_hour: null };
    state.leadtime = { lot_count: 0, avg_lead_days: null };
    state.lots = [];
    state.leads = [];
    render(<CostPage />);
    expect(screen.getAllByText('완료된 LOT 없음 (최근 30일)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('출하 완료된 LOT 없음 (최근 30일)').length).toBeGreaterThan(0);
    expect(screen.queryByText('NaN')).toBeNull();
  });

  // Value: protects=작업공수 개선률 계산값·0% 클램프와 LOT별 달성/미달 Pill 표시; fails_when=improvementPct 인자(반올림)·evaluateKpi 방향이 바뀌거나 Pill 분기가 뒤집힘; why_new=기존 테스트는 목표 33.3%만 확인; seam=none; no_claim=실제 DB 뷰 값(훅 목)
  // 작성: gstack /ship 커버리지 감사 (Claude)
  it('개선률은 소수 첫째 자리로 반올림한 평균 기준이며 LOT별 달성/미달 Pill을 표시한다', () => {
    render(<CostPage />);
    expect(screen.getByText('개선률 27.1% / 목표 33.3%')).toBeInTheDocument();
    expect(screen.getAllByText('목표 달성')).toHaveLength(1); // LOT-A1 (16 <= 16)
    expect(screen.getAllByText('미달')).toHaveLength(1); // LOT-B2 (20 > 16)
  });

  it('평균이 기준선보다 나쁘면 개선률은 0.0%로 클램프된다', () => {
    state.manhour = { lot_count: 2, avg_man_hour: 30, latest_man_hour: 30 };
    render(<CostPage />);
    expect(screen.getByText('개선률 0.0% / 목표 33.3%')).toBeInTheDocument();
  });

  it('목표값 조회 실패 시 KpiPage와 같은 경고를 띄우고 목표/기준/LOT 중량은 —로 표시한다', () => {
    state.targetsError = true;
    render(<CostPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('목표값을 불러오지 못했습니다 — 새로고침 해주세요');
    expect(screen.getByText('기존 — → 목표 — man-hour')).toBeInTheDocument();
    expect(screen.getByText('기존 — → 목표 —일')).toBeInTheDocument();
    expect(screen.getByText('1 LOT = —kg')).toBeInTheDocument();
    expect(screen.queryByText('1 LOT = kg')).toBeNull();
  });

  it('LOT별 표는 헤드라인과 같은 창임을 표시한다 (최근 30일 · 최근 10건)', () => {
    render(<CostPage />);
    expect(screen.getByText('LOT별 작업공수 (최근 30일 · 최근 10건)')).toBeInTheDocument();
    expect(screen.getByText('LOT별 리드타임 (최근 30일 · 최근 10건)')).toBeInTheDocument();
  });

  describe('기간 모드', () => {
    const entry = '/cost?from=2026-10-01&to=2026-10-28';
    const mkLot = (id: string, mh: number) => ({
      id, lot_no: `P-${id}`, started_at: '2026-10-10T00:00:00Z', ended_at: '2026-10-10T04:00:00Z',
      worker_count: 4, work_hours: 4, man_hour: mh,
    });

    it('기간 평균·총 man-hour·표 제목을 표시한다', () => {
      state.periodLots = [mkLot('1', 16), mkLot('2', 19)];
      render(<CostPage />, entry);
      expect(screen.getByText('LOT당 작업공수 (선택 기간 평균)')).toBeInTheDocument();
      expect(screen.getByText('17.5')).toBeInTheDocument();
      expect(screen.getByText('완료 LOT 2건 · 총 35.0 man-hour')).toBeInTheDocument();
      expect(screen.getByText('LOT별 작업공수 (선택 기간 · 2건)')).toBeInTheDocument();
      expect(screen.queryByText(/최근 500건만 표시/)).toBeNull();
    });

    it('기간 리드타임이 0건이면 선택 기간 없음 문구를 표시한다', () => {
      render(<CostPage />, entry);
      expect(screen.getAllByText('출하 완료된 LOT 없음 (선택 기간)').length).toBeGreaterThan(0);
      expect(screen.getAllByText('완료된 LOT 없음 (선택 기간)').length).toBeGreaterThan(0);
    });

    it('리드타임 보조 줄과 표 제목을 표시한다', () => {
      state.periodLeads = [
        { id: 'x', lot_no: 'L-X', ordered_at: '2026-10-01', shipped_at: '2026-10-11', lead_days: 10 },
      ];
      render(<CostPage />, entry);
      expect(screen.getByText('출하 LOT 1건')).toBeInTheDocument();
      expect(screen.getByText('LOT별 리드타임 (선택 기간 · 1건)')).toBeInTheDocument();
    });

    it('표는 500행까지만 그리고 안내 문구를 표시하되 건수는 전체 기준이다', () => {
      state.periodLots = Array.from({ length: 501 }, (_, i) => mkLot(String(i), 10));
      render(<CostPage />, entry);
      expect(screen.getByText('LOT별 작업공수 (선택 기간 · 501건)')).toBeInTheDocument();
      expect(screen.getByText('최근 500건만 표시 (평균·합계는 전체 기준)')).toBeInTheDocument();
      expect(screen.getAllByText(/^P-/)).toHaveLength(500);
    });
  });

  it('두 모드 모두 최근 30일 기준 문구를 표시한다', () => {
    render(<CostPage />);
    expect(screen.getByText('최근 30일 기준')).toBeInTheDocument();
  });
});
