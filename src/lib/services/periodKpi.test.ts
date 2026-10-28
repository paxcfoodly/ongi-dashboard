import { describe, expect, it } from 'vitest';
import type { LotLeadtimeRow, LotManhourRow } from '../../hooks/useManhourKpi';
import {
  computeRatios,
  dailyAchievementPct,
  summarizeDaily,
  summarizeLeadtime,
  summarizeManhour,
  type DailyRow,
} from './periodKpi';

// 테스트용 일별 행 팩토리 (지정하지 않은 필드는 0)
const day = (o: Partial<DailyRow> = {}): DailyRow => ({
  day: '2026-10-01',
  production: 0,
  runtime_sec: 0,
  inspected: 0,
  defects: 0,
  unknown: 0,
  inspection_time_sec: 0,
  claims: 0,
  ...o,
});

const mh = (man_hour: number | null, id = 'x'): LotManhourRow => ({
  id,
  lot_no: id,
  started_at: null,
  ended_at: null,
  worker_count: null,
  work_hours: null,
  man_hour,
});

const lt = (lead_days: number | null, id = 'x'): LotLeadtimeRow => ({
  id,
  lot_no: id,
  ordered_at: null,
  shipped_at: null,
  lead_days,
});

describe('computeRatios', () => {
  it('시간당 생산량은 정수, 개당 작업시간은 소수 2자리로 반올림한다', () => {
    const r = computeRatios(day({ production: 58, runtime_sec: 112 }));
    expect(r.hourly_production).toBe(1864);
    expect(r.work_time_per_ea).toBe(1.93);
  });

  it('검사 비율을 계산한다', () => {
    const r = computeRatios(
      day({ inspected: 200, defects: 3, unknown: 1, inspection_time_sec: 3600 }),
    );
    expect(r.defect_rate_pct).toBe(1.5);
    expect(r.recheck_rate_pct).toBe(0.5);
    expect(r.throughput_ea_per_hr).toBe(200);
  });
});

describe('summarizeDaily', () => {
  it('비율은 일별 비율의 평균이 아니라 총합 ÷ 총합(가중 평균)이다', () => {
    const t = summarizeDaily([
      day({ production: 100, runtime_sec: 3600, inspected: 100, defects: 10 }),
      day({ day: '2026-10-02', production: 900, runtime_sec: 3600, inspected: 900, defects: 0 }),
    ]);
    expect(t.defect_rate_pct).toBe(1);
    expect(t.hourly_production).toBe(500);
    expect(t.production).toBe(1000);
    expect(t.days).toBe(2);
  });

  it('전부 0인 행은 비율이 null이고 합계는 0이다', () => {
    const t = summarizeDaily([day()]);
    expect(t.production).toBe(0);
    expect(t.days).toBe(1);
    expect(t.hourly_production).toBeNull();
    expect(t.work_time_per_ea).toBeNull();
    expect(t.defect_rate_pct).toBeNull();
    expect(t.throughput_ea_per_hr).toBeNull();
    expect(t.recheck_rate_pct).toBeNull();
  });

  it('빈 배열은 days 0, 비율 null', () => {
    const t = summarizeDaily([]);
    expect(t.days).toBe(0);
    expect(t.claims).toBe(0);
    expect(t.hourly_production).toBeNull();
  });
});

describe('dailyAchievementPct', () => {
  it('달성률을 1자리로 계산하고 목표가 없거나 0이면 null', () => {
    expect(dailyAchievementPct(7500, 15000)).toBe(50);
    expect(dailyAchievementPct(100, undefined)).toBeNull();
    expect(dailyAchievementPct(100, 0)).toBeNull();
  });
});

describe('summarizeManhour', () => {
  it('null을 제외하고 평균·합계를 구하며 latest는 최신(첫) 값이다', () => {
    expect(summarizeManhour([mh(16), mh(19), mh(null)])).toEqual({
      lot_count: 2,
      avg_man_hour: 17.5,
      total_man_hour: 35,
      latest_man_hour: 16,
    });
  });

  it('빈 배열', () => {
    expect(summarizeManhour([])).toEqual({
      lot_count: 0,
      avg_man_hour: null,
      total_man_hour: null,
      latest_man_hour: null,
    });
  });
});

describe('summarizeLeadtime', () => {
  it('평균 리드타임을 1자리로 계산한다', () => {
    expect(summarizeLeadtime([lt(10), lt(13)])).toEqual({ lot_count: 2, avg_lead_days: 11.5 });
    expect(summarizeLeadtime([])).toEqual({ lot_count: 0, avg_lead_days: null });
  });
});
