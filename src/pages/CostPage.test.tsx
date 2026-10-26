import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({
  manhour: null as unknown,
  leadtime: null as unknown,
  lots: [] as unknown[],
  leads: [] as unknown[],
}));

vi.mock('../hooks/useKpiTargets', () => ({
  useKpiTargets: () => ({
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

vi.mock('../hooks/useLlmAnalyze', () => ({
  useCostImprovement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { CostPage } from './CostPage';

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
});
