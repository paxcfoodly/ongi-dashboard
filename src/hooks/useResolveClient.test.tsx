import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useResolveClient } from './useAdminLots';

// 납품처 조회 결과와 등록 결과를 테스트마다 지정한다
const db = vi.hoisted(() => ({
  lists: [] as { id: string; name: string }[][],
  insertResult: { data: { id: 'new' } as { id: string } | null, error: null as { code: string; message: string } | null },
  inserted: [] as unknown[],
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: async () => ({ data: db.lists.shift() ?? [], error: null }) }),
      insert: (row: unknown) => {
        db.inserted.push(row);
        return { select: () => ({ single: async () => db.insertResult }) };
      },
    }),
  },
}));

function setup() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useResolveClient(), { wrapper });
  return { resolve: result.current, spy };
}

describe('useResolveClient', () => {
  beforeEach(() => {
    db.lists = [];
    db.inserted = [];
    db.insertResult = { data: { id: 'new' }, error: null };
  });

  it('이미 있는 납품처면 새로 등록하지 않고 그 id를 쓴다', async () => {
    db.lists = [[{ id: 'c1', name: '삼성웰스토리' }]];
    const { resolve } = setup();
    await expect(resolve('삼성 웰스토리')).resolves.toBe('c1');
    expect(db.inserted).toHaveLength(0);
  });

  it('없는 납품처면 정리한 이름으로 등록하고 납품처 목록을 갱신한다', async () => {
    db.lists = [[]];
    const { resolve, spy } = setup();
    await expect(resolve('  새   납품처 ')).resolves.toBe('new');
    expect(db.inserted).toEqual([{ name: '새 납품처' }]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['clients'] });
  });

  it('동시에 같은 이름이 등록되어 중복 오류가 나면 이미 등록된 id를 쓴다', async () => {
    db.lists = [[], [{ id: 'c9', name: '새 납품처' }]];
    db.insertResult = { data: null, error: { code: '23505', message: 'duplicate' } };
    const { resolve } = setup();
    await expect(resolve('새 납품처')).resolves.toBe('c9');
  });

  it('그 밖의 등록 오류는 그대로 알린다', async () => {
    db.lists = [[]];
    db.insertResult = { data: null, error: { code: '42501', message: 'denied' } };
    const { resolve } = setup();
    await expect(resolve('새 납품처')).rejects.toMatchObject({ code: '42501' });
  });
});
