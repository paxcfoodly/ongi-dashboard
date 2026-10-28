import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DailyTable, type DailyColumn } from './DailyTable';

interface Row { day: string; a: number | null }
const rows: Row[] = [
  { day: '2026-10-01', a: 1 },
  { day: '2026-10-02', a: null },
];
const columns: DailyColumn<Row>[] = [
  { header: '합', cell: (r) => (r.a === null ? '—' : String(r.a)), total: '1', agg: 'sum' },
  { header: '평', cell: () => '5%', total: '5%', agg: 'avg' },
  { header: '없음', cell: () => 'x', total: '999', agg: 'none' },
];

describe('DailyTable', () => {
  it('행과 합계·평균 푸터를 표시한다', () => {
    render(<DailyTable title="일별" rows={rows} columns={columns} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['날짜', '합', '평', '없음']);
    const bodyRows = table.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[1].textContent).toContain('—');
    const foot = table.querySelector('tfoot tr')!;
    expect(foot.textContent).toBe('기간 합계·평균합계 1평균 5%—');
  });
});
