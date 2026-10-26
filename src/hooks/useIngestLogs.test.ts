import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIngestLogsForExport } from './useIngestLogs';

// order 호출 순서·lte 인자·select 컬럼을 기록하는 supabase 체인 목
const rec = vi.hoisted(() => ({
  orders: [] as string[],
  lte: [] as [string, string][],
  selects: [] as string[],
  pages: [] as number[], // range 호출마다 돌려줄 행 수
  calls: [] as [string, ...unknown[]][], // eq/not/gte/lt 호출 기록
}));
vi.mock('../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  for (const m of ['eq', 'not', 'gte', 'lt']) {
    chain[m] = vi.fn((...a: unknown[]) => {
      rec.calls.push([m, ...a]);
      return chain;
    });
  }
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
    rec.calls.length = 0;
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

  // Value: protects=내보내기 필터(기기·오류 상태·KST 하루 범위) 쿼리 인자; fails_when=상태 'error' 분기 제거, KST 오프셋 누락, 월말 다음날 계산 오류; why_new=기존은 필터 없는 호출만 검증; seam=none; no_claim=PostgREST 실제 해석(체인 목)
  // 작성: gstack /ship 커버리지 감사 (Claude)
  it('필터를 쿼리 인자로 변환한다 (기기·오류 상태·KST 하루, 월말 경계 포함)', async () => {
    await fetchIngestLogsForExport({ deviceCode: 'vision_01', status: 'error', date: '2026-10-31' });
    expect(rec.calls).toEqual([
      ['eq', 'device_code', 'vision_01'],
      ['not', 'status', 'in', '(success,duplicate)'],
      ['gte', 'received_at', '2026-10-31T00:00:00+09:00'],
      ['lt', 'received_at', '2026-11-01T00:00:00+09:00'],
    ]);
  });

  it('특정 상태는 정확히 일치로 거른다', async () => {
    await fetchIngestLogsForExport({ status: 'duplicate' });
    expect(rec.calls).toEqual([['eq', 'status', 'duplicate']]);
  });

  // Value: protects=내보내기 10,000건 상한과 truncated 플래그; fails_when=상한 도달 시 truncated 미설정 또는 상한 초과 수집; why_new=기존은 3페이지 미만 종료만 검증; seam=none; no_claim=실제 DB 페이징(체인 목)
  // 작성: gstack /ship 커버리지 감사 (Claude)
  it('10페이지가 모두 가득 차면 10,000건에서 멈추고 truncated=true', async () => {
    rec.pages.push(...Array(10).fill(1000), 1000);
    const { rows, truncated } = await fetchIngestLogsForExport({});
    expect(rows).toHaveLength(10000);
    expect(truncated).toBe(true);
    expect(rec.lte).toHaveLength(10);
  });

  it('마지막 페이지가 부분이면 truncated=false', async () => {
    rec.pages.push(1000, 999);
    const { rows, truncated } = await fetchIngestLogsForExport({});
    expect(rows).toHaveLength(1999);
    expect(truncated).toBe(false);
  });
});
