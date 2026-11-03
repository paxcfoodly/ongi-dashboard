import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlarms } from './useAlarms';

const mock = vi.hoisted(() => ({
  hidden: [] as { id: string }[],
  orFilter: null as string | null,
  hiddenFilter: null as [string, unknown] | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'devices') {
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              mock.hiddenFilter = [col, val];
              return Promise.resolve({ data: mock.hidden, error: null });
            },
          }),
        };
      }
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        or: (f: string) => {
          mock.orFilter = f;
          return builder;
        },
        then: (cb: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve(cb({ data: [], error: null })),
      };
      return builder;
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

describe('useAlarms', () => {
  it('모니터링 제외 장비의 알람만 빼고, 장비와 무관한 알람은 유지한다', async () => {
    mock.hidden = [{ id: 'a' }, { id: 'b' }];
    mock.orFilter = null;
    const { result } = renderHook(() => useAlarms(4), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock.hiddenFilter).toEqual(['monitored', false]);
    expect(mock.orFilter).toBe('device_id.is.null,device_id.not.in.(a,b)');
  });

  it('제외 장비가 없으면 필터를 걸지 않는다', async () => {
    mock.hidden = [];
    mock.orFilter = null;
    const { result } = renderHook(() => useAlarms(4), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock.orFilter).toBeNull();
  });
});
