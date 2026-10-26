import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIngestLogsForExport } from './useIngestLogs';

// order 호출 순서·lte 인자·select 컬럼을 기록하는 supabase 체인 목
const rec = vi.hoisted(() => ({
  orders: [] as string[],
  lte: [] as [string, string][],
  selects: [] as string[],
  pages: [] as number[], // range 호출마다 돌려줄 행 수
}));
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'eq', 'not', 'gte', 'lt']) chain[m] = vi.fn(() => chain);
  chain.select = vi.fn((cols: string) => {
    rec.selects.push(cols);
    return chain;
  });
  chain.lte = vi.fn((col: string, v: string) => {
    rec.lte.push([col, v]);
    return chain;
  });
  chain.order = vi.fn((col: string) => {
    rec.orders.push(col);
    return chain;
  });
  chain.range = vi.fn(async () => {
    const n = rec.pages.shift() ?? 0;
    return { data: Array.from({ length: n }, (_, i) => ({ id: i })), error: null };
  });
  return { supabase: chain };
});

describe('fetchIngestLogsForExport', () => {
  beforeEach(() => {
    rec.orders.length = 0;
    rec.lte.length = 0;
    rec.selects.length = 0;
    rec.pages.length = 0;
  });

  it('received_at 다음에 id 로 보조 정렬해 페이지 경계가 안정적이다', async () => {
    await fetchIngestLogsForExport({});
    expect(rec.orders).toEqual(['received_at', 'id']);
  });

  it('내보내기 시작 시각을 한 번만 잡아 모든 페이지에 received_at 상한으로 건다', async () => {
    rec.pages.push(1000, 1000, 5);
    const { rows } = await fetchIngestLogsForExport({});
    expect(rows).toHaveLength(2005);
    expect(rec.lte).toHaveLength(3);
    expect(rec.lte.every(([col]) => col === 'received_at')).toBe(true);
    expect(new Set(rec.lte.map(([, v]) => v)).size).toBe(1);
    expect(() => new Date(rec.lte[0][1]).toISOString()).not.toThrow();
  });

  it('raw_payload 는 조회하지 않는다', async () => {
    await fetchIngestLogsForExport({});
    expect(rec.selects[0]).not.toContain('raw_payload');
    expect(rec.selects[0]).toContain('raw_body');
  });
});
