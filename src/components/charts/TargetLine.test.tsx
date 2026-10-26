import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// Bar에 전달된 data를 캡처해 데이터셋 구성을 검증한다 (canvas 렌더링 회피)
const captured = vi.hoisted(() => ({ data: null as null | { datasets: { label: string; data: unknown[] }[] } }));
vi.mock('react-chartjs-2', () => ({
  Bar: (props: { data: typeof captured.data }) => {
    captured.data = props.data;
    return null;
  },
}));

import { LotManhourChart } from './LotManhourChart';
import { HourlyProductionChart } from './HourlyProductionChart';

const rows = [
  { id: 'a', lot_no: 'LOT-A', started_at: null, ended_at: null, worker_count: 4, work_hours: 4, man_hour: 16 },
];
const buckets = [{ hour: '08', output: 1200 }];

describe('차트 목표선', () => {
  beforeEach(() => {
    captured.data = null;
  });

  it('LotManhourChart: 목표가 없으면 목표 데이터셋을 그리지 않는다 (0선 금지)', () => {
    render(<LotManhourChart rows={rows} target={undefined} />);
    expect(captured.data?.datasets.map((d) => d.label)).toEqual(['작업공수']);
  });

  it('LotManhourChart: 목표가 있으면 목표선을 그린다', () => {
    render(<LotManhourChart rows={rows} target={16} />);
    expect(captured.data?.datasets.map((d) => d.label)).toEqual(['작업공수', '목표']);
    expect(captured.data?.datasets[1].data).toEqual([16]);
  });

  it('HourlyProductionChart: 목표가 없으면 목표 데이터셋을 그리지 않는다', () => {
    render(<HourlyProductionChart buckets={buckets} target={undefined} />);
    expect(captured.data?.datasets.map((d) => d.label)).toEqual(['실적']);
  });

  it('HourlyProductionChart: 목표가 있으면 목표선을 그린다', () => {
    render(<HourlyProductionChart buckets={buckets} target={1800} />);
    expect(captured.data?.datasets.map((d) => d.label)).toEqual(['실적', '목표']);
  });
});
