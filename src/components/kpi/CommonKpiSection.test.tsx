import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
});
