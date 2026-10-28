import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePeriodLotManhours } from './usePeriodKpi';

// 페이지(1000행) + 나머지(3행)를 range 호출에 따라 돌려주는 supabase 체인 목
const mocks = vi.hoisted(() => {
  const range = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'gte', 'lt', 'lte', 'order']) chain[m] = vi.fn(() => chain);
  chain.range = range;
  return { range, chain };
});
vi.mock('../lib/supabase', () => ({ supabase: mocks.chain }));

const mkRows = (n: number, start: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${start + i}`, lot_no: `L-${start + i}`, worker_count: '2', work_hours: '1.50', man_hour: '3.00',
  }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePeriodLotManhours 페이지 순회', () => {
  beforeEach(() => mocks.range.mockReset());

  it('1000행 + 3행을 두 페이지로 모두 가져오고 숫자로 변환한다', async () => {
    mocks.range
      .mockResolvedValueOnce({ data: mkRows(1000, 0), error: null })
      .mockResolvedValueOnce({ data: mkRows(3, 1000), error: null });
    const { result } = renderHook(
      () => usePeriodLotManhours({ from: '2026-01-01', to: '2026-01-31' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1003);
    expect(result.current.data![0]).toMatchObject({ worker_count: 2, work_hours: 1.5, man_hour: 3 });
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(mocks.range).toHaveBeenCalledTimes(2);
  });
});
