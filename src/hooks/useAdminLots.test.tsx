import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpdateLot, useCreateLot, useDeleteLot } from './useAdminLots';

// supabase 체인: 어떤 메서드든 자기 자신을 반환하고, single()/await 시 성공 응답
vi.mock('../lib/supabase', () => {
  const ok = { data: { id: 'l1' }, error: null };
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'insert', 'update', 'delete', 'eq', 'select']) chain[m] = vi.fn(() => chain);
  chain.single = vi.fn(async () => ok);
  chain.then = (resolve: (v: unknown) => void) => resolve(ok);
  return { supabase: chain };
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const keys = () => spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
  return { wrapper, keys };
}

describe('useAdminLots', () => {
  const expected = expect.arrayContaining(['["lots"]', '["kpi"]']);

  it('update 성공 시 lots 와 kpi 쿼리를 함께 무효화한다', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useUpdateLot(), { wrapper });
    await result.current.mutateAsync({ id: 'l1', changes: { notes: 'x' } });
    await waitFor(() => expect(keys()).toEqual(expected));
  });

  it('create 성공 시 lots 와 kpi 쿼리를 함께 무효화한다', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useCreateLot(), { wrapper });
    await result.current.mutateAsync({ lot_no: 'L', client_id: 'c1' });
    await waitFor(() => expect(keys()).toEqual(expected));
  });

  it('delete 성공 시 lots 와 kpi 쿼리를 함께 무효화한다', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useDeleteLot(), { wrapper });
    await result.current.mutateAsync('l1');
    await waitFor(() => expect(keys()).toEqual(expected));
  });
});
