export type KpiDirection = 'higher' | 'lower';
export type KpiStatus = 'achieved' | 'missed' | 'nodata';

// 최근 기간 집계 기준 일수
// 주의: SQL 뷰(v_kpi_manhour / v_kpi_leadtime / v_lot_*_window, 000007)의 "오늘 포함 29일 전부터"(interval '29 days', - 29)와
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

// 인력 지표 측정일 허용 범위 — 2020-01-01 ~ KST 오늘 (문제없으면 null, 있으면 토스트 문구)
// 연도 오타(2062 등)가 들어가면 측정일 최신순으로 고르는 최신값 카드를 영구히 가리므로 저장 전에 막는다
export function hrMeasuredOnError(measuredOn: string, now: Date = new Date()): string | null {
  if (measuredOn < '2020-01-01') return '측정일은 2020-01-01 이후로 입력해야 합니다.';
  const kstToday = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  if (measuredOn > kstToday) return '측정일은 미래로 입력할 수 없습니다.';
  return null;
}
