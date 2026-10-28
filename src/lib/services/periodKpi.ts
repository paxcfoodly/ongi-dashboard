import type {
  LeadtimeKpi,
  LotLeadtimeRow,
  LotManhourRow,
  ManhourKpi,
} from '../../hooks/useManhourKpi';

// fn_kpi_daily의 KST 일별 한 행
export interface DailyRow {
  day: string;
  production: number;
  runtime_sec: number;
  inspected: number;
  defects: number;
  unknown: number;
  inspection_time_sec: number;
  claims: number;
}

export interface Ratios {
  hourly_production: number | null;
  work_time_per_ea: number | null;
  defect_rate_pct: number | null;
  throughput_ea_per_hr: number | null;
  recheck_rate_pct: number | null;
}

export type Totals = Omit<DailyRow, 'day'> & Ratios & { days: number };

// SQL round(x, n)과 같이 반올림 (양수 기준; 부동소수 경계값은 SQL numeric과 1ulp 차이 가능)
const round = (x: number, n: number): number => {
  const f = 10 ** n;
  return Math.round(x * f) / f;
};

// 분모가 0이면 null
const ratio = (num: number, den: number, scale: number, digits: number): number | null =>
  den > 0 ? round((num * scale) / den, digits) : null;

// 총합으로부터 비율 지표 계산 (일별 비율의 평균이 아니라 총합 ÷ 총합)
export function computeRatios(t: Omit<DailyRow, 'day'>): Ratios {
  return {
    hourly_production: ratio(t.production, t.runtime_sec, 3600, 0),
    work_time_per_ea: ratio(t.runtime_sec, t.production, 1, 2),
    defect_rate_pct: ratio(t.defects, t.inspected, 100, 2),
    throughput_ea_per_hr: ratio(t.inspected, t.inspection_time_sec, 3600, 0),
    recheck_rate_pct: ratio(t.unknown, t.inspected, 100, 2),
  };
}

// 건수형 지표는 합산, 비율형 지표는 합산값으로 재계산
export function summarizeDaily(rows: DailyRow[]): Totals {
  const sum: Omit<DailyRow, 'day'> = {
    production: 0,
    runtime_sec: 0,
    inspected: 0,
    defects: 0,
    unknown: 0,
    inspection_time_sec: 0,
    claims: 0,
  };
  for (const r of rows) {
    sum.production += r.production;
    sum.runtime_sec += r.runtime_sec;
    sum.inspected += r.inspected;
    sum.defects += r.defects;
    sum.unknown += r.unknown;
    sum.inspection_time_sec += r.inspection_time_sec;
    sum.claims += r.claims;
  }
  return { ...sum, ...computeRatios(sum), days: rows.length };
}

// 일 목표 대비 달성률(%, 1자리). 목표가 없거나 0이면 null
export function dailyAchievementPct(production: number, dailyTarget: number | undefined): number | null {
  if (!dailyTarget || dailyTarget <= 0) return null;
  return round((production / dailyTarget) * 100, 1);
}

// 최신순(내림차순) LOT 목록 -> 공수 요약. man_hour가 null인 LOT은 제외
export function summarizeManhour(rowsDesc: LotManhourRow[]): ManhourKpi & { total_man_hour: number | null } {
  const values = rowsDesc.map((r) => r.man_hour).filter((v): v is number => v != null);
  if (values.length === 0) {
    return { lot_count: 0, avg_man_hour: null, total_man_hour: null, latest_man_hour: null };
  }
  const total = values.reduce((a, b) => a + b, 0);
  return {
    lot_count: values.length,
    avg_man_hour: round(total / values.length, 2),
    total_man_hour: round(total, 2),
    latest_man_hour: values[0],
  };
}

// LOT 리드타임 요약. lead_days가 null인 LOT은 제외
export function summarizeLeadtime(rows: LotLeadtimeRow[]): LeadtimeKpi {
  const values = rows.map((r) => r.lead_days).filter((v): v is number => v != null);
  if (values.length === 0) return { lot_count: 0, avg_lead_days: null };
  return {
    lot_count: values.length,
    avg_lead_days: round(values.reduce((a, b) => a + b, 0) / values.length, 1),
  };
}
