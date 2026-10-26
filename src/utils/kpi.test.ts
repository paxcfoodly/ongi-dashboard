import { describe, expect, it } from 'vitest';
import { evaluateKpi, improvementPct, KPI_PERIOD_DAYS } from './kpi';

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
