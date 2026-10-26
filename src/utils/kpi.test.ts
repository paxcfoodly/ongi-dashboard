import { describe, expect, it } from 'vitest';
import { evaluateKpi, improvementPct, KPI_PERIOD_DAYS, hrMeasuredOnError } from './kpi';

describe('evaluateKpi', () => {
  it('higher: 값이 목표 이상이면 achieved', () => {
    expect(evaluateKpi(1832, 1800, 'higher')).toBe('achieved');
  });
  it('lower: 값이 목표 초과면 missed', () => {
    expect(evaluateKpi(17.5, 16, 'lower')).toBe('missed');
  });
  it('lower: 값이 목표와 같으면 achieved', () => {
    expect(evaluateKpi(16, 16, 'lower')).toBe('achieved');
  });
  it('higher: 값이 목표와 같으면 achieved', () => {
    expect(evaluateKpi(1800, 1800, 'higher')).toBe('achieved');
  });
  it('null/undefined/NaN은 nodata', () => {
    expect(evaluateKpi(null, 16, 'lower')).toBe('nodata');
    expect(evaluateKpi(undefined, 16, 'lower')).toBe('nodata');
    expect(evaluateKpi(16, null, 'lower')).toBe('nodata');
    expect(evaluateKpi(NaN, 16, 'lower')).toBe('nodata');
    expect(evaluateKpi(16, NaN, 'higher')).toBe('nodata');
  });
});

describe('improvementPct', () => {
  it('lower: 기준 대비 감소율', () => {
    expect(improvementPct(24, 16, 'lower')).toBeCloseTo(33.33, 2);
  });
  it('higher: 기준 대비 증가율', () => {
    expect(improvementPct(1500, 1800, 'higher')).toBe(20);
  });
  it('0~100으로 클램프', () => {
    expect(improvementPct(24, 30, 'lower')).toBe(0);
    expect(improvementPct(100, 300, 'higher')).toBe(100);
  });
  it('higher: 기준보다 나빠진 음수 개선율은 0으로 클램프', () => {
    expect(improvementPct(1500, 1200, 'higher')).toBe(0);
  });
  it('current가 null이거나 baseline이 0이면 null', () => {
    expect(improvementPct(24, null, 'lower')).toBeNull();
    expect(improvementPct(0, 5, 'higher')).toBeNull();
  });
});

describe('KPI_PERIOD_DAYS', () => {
  it('30일', () => {
    expect(KPI_PERIOD_DAYS).toBe(30);
  });
});

describe('hrMeasuredOnError — 인력 지표 측정일 범위', () => {
  // 기준 시각: 2026-10-26 08:30 KST (UTC 전날 23:30 — KST 날짜 기준 판정 확인)
  const now = new Date('2026-10-25T23:30:00Z');

  it('2020-01-01 ~ KST 오늘은 허용', () => {
    expect(hrMeasuredOnError('2020-01-01', now)).toBeNull();
    expect(hrMeasuredOnError('2026-10-26', now)).toBeNull();
  });

  it('KST 오늘 이후(연도 오타 2062 등)는 거부 — 최신값 카드를 영구히 가리는 것 방지', () => {
    expect(hrMeasuredOnError('2026-10-27', now)).toBe('측정일은 미래로 입력할 수 없습니다.');
    expect(hrMeasuredOnError('2062-03-31', now)).toBe('측정일은 미래로 입력할 수 없습니다.');
  });

  it('2020-01-01 이전(연도 오타 0026 등)은 거부', () => {
    expect(hrMeasuredOnError('0026-03-31', now)).toBe('측정일은 2020-01-01 이후로 입력해야 합니다.');
  });
});
