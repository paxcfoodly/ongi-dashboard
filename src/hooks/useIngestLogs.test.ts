import { describe, it, expect, vi } from 'vitest';
import { fetchIngestLogsForExport } from './useIngestLogs';

// order 호출 순서를 기록하는 supabase 체인 목
const orders = vi.hoisted(() => [] as string[]);
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'not', 'gte', 'lt']) chain[m] = vi.fn(() => chain);
  chain.order = vi.fn((col: string) => {
    orders.push(col);
    return chain;
  });
  chain.range = vi.fn(async () => ({ data: [], error: null }));
  return { supabase: chain };
});

describe('fetchIngestLogsForExport', () => {
  it('received_at 다음에 id 로 보조 정렬해 페이지 경계가 안정적이다', async () => {
    await fetchIngestLogsForExport({});
    expect(orders).toEqual(['received_at', 'id']);
  });
});
