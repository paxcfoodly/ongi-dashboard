import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUpsertHrKpi, useHrKpiRecords, useLatestHrKpi, pickLatestHrKpi } from './useHrKpi';

// 호출된 메서드를 기록하고, await 시 state.result 를 돌려주는 supabase 체인 목
const state = vi.hoisted(() => ({
  calls: [] as string[],
  result: { data: null, error: null } as { data: unknown; error: unknown },
}));
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'insert', 'upsert', 'update', 'delete', 'eq', 'order', 'limit']) {
    chain[m] = vi.fn(() => {
      state.calls.push(m);
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(state.result);
  return { supabase: chain };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useUpsertHrKpi', () => {
  beforeEach(() => {
    state.calls.length = 0;
    state.result = { data: null, error: null };
  });

  it('신규(id 없음)는 upsert 가 아닌 insert 로 저장한다', async () => {
    const { result } = renderHook(() => useUpsertHrKpi(), { wrapper });
    await result.current.mutateAsync({
      measured_on: '2026-10-20', job_conversion_rate_pct: 50, satisfaction_score: null,
    });
    expect(state.calls).toContain('insert');
    expect(state.calls).not.toContain('upsert');
  });

  it('같은 측정일이 이미 있으면(23505) mutate 가 거부된다 — 기존 기록을 덮어쓰지 않음', async () => {
    const dup = { code: '23505', message: 'duplicate key value violates unique constraint' };
    state.result = { data: null, error: dup };
    const { result } = renderHook(() => useUpsertHrKpi(), { wrapper });
    await expect(
      result.current.mutateAsync({ measured_on: '2026-10-20', job_conversion_rate_pct: 10, satisfaction_score: null }),
    ).rejects.toMatchObject({ code: '23505' });
    expect(state.calls).not.toContain('upsert');
    expect(state.calls).not.toContain('update');
  });

  it('편집(id 있음)은 update + eq(id) 로 저장한다', async () => {
    const { result } = renderHook(() => useUpsertHrKpi(), { wrapper });
    await result.current.mutateAsync({
      id: 'h1', measured_on: '2026-10-20', job_conversion_rate_pct: 50, satisfaction_score: null,
    });
    expect(state.calls).toEqual(expect.arrayContaining(['update', 'eq']));
    expect(state.calls).not.toContain('insert');
  });
});

describe('pickLatestHrKpi', () => {
  it('지표별로 값이 있는 가장 최근 기록과 그 측정일을 고른다', () => {
    const latest = pickLatestHrKpi([
      { id: 'a', measured_on: '2026-10-20', job_conversion_rate_pct: 52, satisfaction_score: null, note: null },
      { id: 'b', measured_on: '2026-09-20', job_conversion_rate_pct: 40, satisfaction_score: 4.1, note: null },
    ]);
    expect(latest).toEqual({
      job: { value: 52, measured_on: '2026-10-20' },
      satisfaction: { value: 4.1, measured_on: '2026-09-20' },
    });
  });

  it('기록이 없거나 값이 모두 null 이면 null', () => {
    expect(pickLatestHrKpi([])).toEqual({ job: null, satisfaction: null });
    expect(
      pickLatestHrKpi([
        { id: 'a', measured_on: '2026-10-20', job_conversion_rate_pct: null, satisfaction_score: null, note: null },
      ]),
    ).toEqual({ job: null, satisfaction: null });
  });
});

describe('HR 조회 훅 숫자 변환', () => {
  beforeEach(() => {
    state.calls.length = 0;
  });

  it('numeric 문자열은 숫자로, null 은 그대로 둔다', async () => {
    state.result = {
      data: [
        { id: 'a', measured_on: '2026-10-20', job_conversion_rate_pct: '52.50', satisfaction_score: null, note: null },
        { id: 'b', measured_on: '2026-09-20', job_conversion_rate_pct: null, satisfaction_score: '4.10', note: null },
      ],
      error: null,
    };
    const { result } = renderHook(() => useHrKpiRecords(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data![0].job_conversion_rate_pct).toBe(52.5);
    expect(result.current.data![0].satisfaction_score).toBeNull();
    expect(result.current.data![1].job_conversion_rate_pct).toBeNull();
    expect(result.current.data![1].satisfaction_score).toBe(4.1);
  });

  it('useLatestHrKpi 는 같은 목록에서 지표별 최신값을 숫자로 돌려준다', async () => {
    state.result = {
      data: [
        { id: 'a', measured_on: '2026-10-20', job_conversion_rate_pct: '52.50', satisfaction_score: null, note: null },
        { id: 'b', measured_on: '2026-09-20', job_conversion_rate_pct: null, satisfaction_score: '4.10', note: null },
      ],
      error: null,
    };
    const { result } = renderHook(() => useLatestHrKpi(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      job: { value: 52.5, measured_on: '2026-10-20' },
      satisfaction: { value: 4.1, measured_on: '2026-09-20' },
    });
  });
});
