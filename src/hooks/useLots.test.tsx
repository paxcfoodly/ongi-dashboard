import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLots } from './useLots';

// PostgREST가 numeric 컬럼을 문자열로 주는 상황을 재현하는 supabase 체인 목
const ROWS = vi.hoisted(() => [
  { id: 'a', lot_no: 'L-A', worker_count: '3', work_hours: '8.00', man_hour: '24.00', lead_days: '10' },
  { id: 'b', lot_no: 'L-B', worker_count: null, work_hours: null, man_hour: null, lead_days: null },
]);
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'order', 'eq', 'or', 'gte', 'lte']) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: ROWS, error: null });
  return { supabase: chain };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useLots 숫자 변환', () => {
  it('numeric 문자열은 숫자로 바꾸고 null은 그대로 둔다', async () => {
    const { result } = renderHook(() => useLots(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [a, b] = result.current.data!;
    expect(a).toMatchObject({ worker_count: 3, work_hours: 8, man_hour: 24, lead_days: 10 });
    expect(b).toMatchObject({ worker_count: null, work_hours: null, man_hour: null, lead_days: null });
  });
});
