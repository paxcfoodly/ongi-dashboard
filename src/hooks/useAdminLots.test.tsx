import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpdateLot, useCreateLot, useDeleteLot, useStartLot, useEndLot } from './useAdminLots';
import { supabase } from '../lib/supabase';

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

  // D5-1: 시작/종료 버튼이 이미 기록된 시각을 덮어쓰지 않아야 한다
  describe('시작/종료 시각 보존', () => {
    const updateCalls = () => (supabase as unknown as { update: { mock: { calls: unknown[][] } } }).update.mock.calls;
    const lastUpdate = () => updateCalls()[updateCalls().length - 1][0] as Record<string, unknown>;

    it('started_at이 이미 있으면 시작 시 started_at을 보내지 않고 상태만 running으로 바꾼다', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useStartLot(), { wrapper });
      await result.current({ id: 'l1', started_at: '2026-10-20T00:00:00Z' });
      expect(lastUpdate()).toEqual({ status: 'running' });
    });

    it('started_at이 없으면 시작 시 현재 시각을 기록한다', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useStartLot(), { wrapper });
      await result.current({ id: 'l1', started_at: null });
      expect(lastUpdate()).toMatchObject({ status: 'running', started_at: expect.any(String) });
    });

    it('ended_at이 이미 있으면 종료 시 ended_at을 보내지 않고 상태만 completed로 바꾼다', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useEndLot(), { wrapper });
      await result.current({ id: 'l1', ended_at: '2026-10-20T04:00:00Z' });
      expect(lastUpdate()).toEqual({ status: 'completed' });
    });

    it('ended_at이 없으면 종료 시 현재 시각을 기록한다', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useEndLot(), { wrapper });
      await result.current({ id: 'l1', ended_at: null });
      expect(lastUpdate()).toMatchObject({ status: 'completed', ended_at: expect.any(String) });
    });
  });
});
