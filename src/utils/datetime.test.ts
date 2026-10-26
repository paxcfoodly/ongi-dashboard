import { describe, it, expect } from 'vitest';
import { toDatetimeLocal, fromDatetimeLocal, formatKst } from './datetime';

describe('datetime', () => {
  it('빈 값은 null로 변환', () => {
    expect(fromDatetimeLocal('')).toBeNull();
  });
  it('null은 빈 문자열로 변환', () => {
    expect(toDatetimeLocal(null)).toBe('');
  });
  it('왕복 변환이 분 단위까지 동일', () => {
    const iso = '2026-10-26T01:23:00.000Z';
    const local = toDatetimeLocal(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocal(local)).toBe(iso);
  });
  it('로컬(KST) 시각 의미를 유지', () => {
    expect(fromDatetimeLocal('2026-10-26T10:00')).toBe('2026-10-26T01:00:00.000Z');
    expect(toDatetimeLocal('2026-10-26T01:00:00.000Z')).toBe('2026-10-26T10:00');
  });
  it('formatKst는 UTC 시각을 KST(YYYY-MM-DD HH:mm:ss)로 표시', () => {
    expect(formatKst('2026-10-26T01:00:00.000Z')).toBe('2026-10-26 10:00:00');
    // 자정 넘김(날짜 변경)도 KST 기준
    expect(formatKst('2026-10-25T15:30:05.000Z')).toBe('2026-10-26 00:30:05');
  });
});
