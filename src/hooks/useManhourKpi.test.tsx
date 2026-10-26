import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useManhourKpi } from './useManhourKpi';

// maybeSingle() 결과를 테스트마다 바꿀 수 있는 supabase 체인 목
const state = vi.hoisted(() => ({ result: { data: null, error: null } as { data: unknown; error: unknown } }));
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select']) chain[m] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => state.result);
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
