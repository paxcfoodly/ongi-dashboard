import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePeriodDaily, usePeriodLotManhours } from './usePeriodKpi';

// rpc 체인은 thenable로 mocks.rows를, from 체인은 range 호출마다 페이지를 돌려주는 supabase 목
const mocks = vi.hoisted(() => {
  const state = { rows: [] as unknown[] };
  const range = vi.fn();
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'order', 'gte', 'lte', 'lt', 'rpc']) chain[m] = vi.fn(() => chain);
  chain.range = range;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: state.rows, error: null });
  return { state, range, chain };
});
vi.mock('../lib/supabase', () => ({ supabase: mocks.chain }));
const sb = mocks.chain as unknown as Record<string, ReturnType<typeof vi.fn>>;

const mkRows = (n: number, start: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${start + i}`, lot_no: `L-${start + i}`, worker_count: '2', work_hours: '1.50', man_hour: '3.00',
  }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.range.mockReset();
  // 기본: 한 페이지에 mocks.state.rows 전부
  mocks.range.mockImplementation(() => Promise.resolve({ data: mocks.state.rows, error: null }));
});

describe('기간 데이터 훅', () => {
  it('usePeriodDaily: RPC를 호출하고 숫자 문자열을 Number로 변환한다', async () => {
    mocks.state.rows = [
      { day: '2026-01-05', production: '63', runtime_sec: '100', inspected: '10', defects: '1',
        unknown: '0', inspection_time_sec: '55.50', claims: '0' },
    ];
    const { result } = renderHook(
      () => usePeriodDaily({ from: '2026-01-05', to: '2026-01-07' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sb.rpc).toHaveBeenCalledWith('fn_kpi_daily', { p_from: '2026-01-05', p_to: '2026-01-07' });
    expect(result.current.data![0].inspection_time_sec).toBe(55.5);
    expect(result.current.data![0].production).toBe(63);
    expect(result.current.data![0].day).toBe('2026-01-05');
  });

  it('usePeriodDaily(null)은 호출하지 않는다', () => {
    renderHook(() => usePeriodDaily(null), { wrapper });
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('usePeriodLotManhours: 종료 경계는 다음날 00:00 KST, man_hour는 숫자', async () => {
    mocks.state.rows = [{ id: 'a', lot_no: 'L-A', worker_count: '2', work_hours: '8.00', man_hour: '16.00' }];
    const { result } = renderHook(
      () => usePeriodLotManhours({ from: '2026-10-01', to: '2026-10-07' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sb.gte).toHaveBeenCalledWith('ended_at', '2026-10-01T00:00:00+09:00');
    expect(sb.lt).toHaveBeenCalledWith('ended_at', '2026-10-08T00:00:00+09:00');
    expect(result.current.data![0].man_hour).toBe(16);
  });

  it('usePeriodLotManhours: 1000행 + 3행을 두 페이지로 모두 가져오고 숫자로 변환한다', async () => {
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
