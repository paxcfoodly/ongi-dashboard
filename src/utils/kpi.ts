export type KpiDirection = 'higher' | 'lower';
export type KpiStatus = 'achieved' | 'missed' | 'nodata';

// 최근 기간 집계 기준 일수
// 주의: SQL 뷰(v_kpi_manhour / v_kpi_leadtime)의 "오늘 포함 29일 전부터"(interval '29 days', - 29)와
// llm-analyze 프롬프트(prompts.ts)의 "최근 30일" 문구와 반드시 함께 맞춰야 한다.
export const KPI_PERIOD_DAYS = 30;

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && !Number.isNaN(v);

// 목표 달성 여부 판정 — 값 또는 목표가 없으면 nodata
export function evaluateKpi(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: KpiDirection,
): KpiStatus {
  if (!isNum(value) || !isNum(target)) return 'nodata';
  const achieved = direction === 'higher' ? value >= target : value <= target;
  return achieved ? 'achieved' : 'missed';
}

// 기준선 대비 개선율(%) — 0~100 클램프, 계산 불가 시 null
export function improvementPct(
  baseline: number,
  current: number | null,
  direction: KpiDirection,
): number | null {
  if (!isNum(baseline) || baseline === 0 || !isNum(current)) return null;
  const raw =
    direction === 'lower'
      ? ((baseline - current) / baseline) * 100
      : ((current - baseline) / baseline) * 100;
  return Math.min(100, Math.max(0, raw));
}
