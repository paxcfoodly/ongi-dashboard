import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CommonKpiSection } from './CommonKpiSection';

vi.mock('../../hooks/useManhourKpi', () => ({
  useManhourKpi: () => ({ data: null }),
  useLeadtimeKpi: () => ({ data: null }),
}));

describe('CommonKpiSection', () => {
  it('생산 실적이 0이어도 NaN/Infinity를 노출하지 않는다', () => {
    const kpi = {
      today_production: 0, runtime_sec_today: 0, hourly_production: NaN,
      work_time_per_ea: Infinity, inspected: 0, defects: 0, defect_rate_pct: NaN, claims_count: 0,
    };
    const { container } = render(<CommonKpiSection kpi={kpi} targets={{}} />);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });
  it('품질 카드는 표시 자릿수(2자리)로 판정하고 산출식과 같은 값을 보여준다', () => {
    const kpi = {
      today_production: 1000, runtime_sec_today: 3600, hourly_production: 1000,
      work_time_per_ea: 3.6, inspected: 2500, defects: 26, defect_rate_pct: 1.04, claims_count: 0,
    };
    render(<CommonKpiSection kpi={kpi} targets={{ defect_rate_max: 1.0 }} />);
    const card = screen.getByText('품질 (불량률)').closest('div')!.parentElement!;
    expect(within(card).getByText('1.04')).toBeInTheDocument();
    expect(within(card).getByText('미달')).toBeInTheDocument();
    expect(card.textContent).toContain('= 1.04%');
  });
});
