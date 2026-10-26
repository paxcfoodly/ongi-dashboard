import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useManhourKpi, useRecentLotManhours, useRecentLotLeadtimes } from './useManhourKpi';
import { supabase } from '../lib/supabase';

// maybeSingle() 결과를 테스트마다 바꿀 수 있는 supabase 체인 목
const state = vi.hoisted(() => ({ result: { data: null, error: null } as { data: unknown; error: unknown } }));
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'order', 'limit']) chain[m] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => state.result);
  // 목록 조회(await chain) 시에는 빈 배열
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return { supabase: chain };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useManhourKpi 숫자 변환', () => {
  beforeEach(() => {
    state.result = { data: null, error: null };
  });

  it('numeric 문자열은 숫자로, null 은 그대로 둔다', async () => {
    state.result = { data: { lot_count: '3', avg_man_hour: '17.50', latest_man_hour: null }, error: null };
    const { result } = renderHook(() => useManhourKpi(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ lot_count: 3, avg_man_hour: 17.5, latest_man_hour: null });
  });

  it('뷰 행이 없으면 null', async () => {
    const { result } = renderHook(() => useManhourKpi(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

// D5-2: 표·차트 목록은 헤드라인과 같은 30일 창 뷰에서 조회해야 한다
describe('최근 LOT 목록은 30일 창 뷰를 조회한다', () => {
  const fromCalls = () => (supabase as unknown as { from: { mock: { calls: unknown[][] } } }).from.mock.calls.map((c) => c[0]);

  it('작업공수 목록: v_lot_manhour_window', async () => {
    const { result } = renderHook(() => useRecentLotManhours(10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fromCalls()).toContain('v_lot_manhour_window');
    expect(fromCalls()).not.toContain('v_lot_manhour');
  });

  it('리드타임 목록: v_lot_leadtime_window', async () => {
    const { result } = renderHook(() => useRecentLotLeadtimes(10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fromCalls()).toContain('v_lot_leadtime_window');
    expect(fromCalls()).not.toContain('v_lot_leadtime');
  });
});
