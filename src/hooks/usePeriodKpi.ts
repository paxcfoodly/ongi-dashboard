import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addDays, type Period } from '../lib/services/period';
import type { DailyRow } from '../lib/services/periodKpi';
import { pickLatestHrKpi, type HrKpiRecord, type LatestHrKpi } from './useHrKpi';
import type { LotLeadtimeRow, LotManhourRow } from './useManhourKpi';

// 비타입 클라이언트 사용 이유: RPC·뷰의 numeric 컬럼이 문자열로 내려와(생성 타입은 number로 표기)
// 응답을 직접 Number 변환(num)해야 하고, 뷰 컬럼이 생성 타입상 모두 nullable이라 행 타입과 맞지 않기 때문.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// numeric이 문자열로 올 수 있어 null은 유지하고 나머지는 Number 변환
const num = (v: unknown): number | null => (v == null ? null : Number(v));

// 기간 모드에서만 조회 (period null = 오늘 모드)
export function usePeriodDaily(period: Period | null) {
  return useQuery<DailyRow[]>({
    queryKey: ['period', 'daily', period?.from, period?.to],
    enabled: period != null,
    queryFn: async () => {
      const { data, error } = await sb.rpc('fn_kpi_daily', {
        p_from: period!.from,
        p_to: period!.to,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        day: String(r.day),
        production: Number(r.production ?? 0),
        runtime_sec: Number(r.runtime_sec ?? 0),
        inspected: Number(r.inspected ?? 0),
        defects: Number(r.defects ?? 0),
        unknown: Number(r.unknown ?? 0),
        inspection_time_sec: Number(r.inspection_time_sec ?? 0),
        claims: Number(r.claims ?? 0),
      }));
    },
  });
}

// 종료 시각이 기간(KST) 안인 LOT 공수 — 끝 날짜는 다음날 00:00 미만으로 포함
export function usePeriodLotManhours(period: Period | null) {
  return useQuery<LotManhourRow[]>({
    queryKey: ['period', 'lot-manhours', period?.from, period?.to],
    enabled: period != null,
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_lot_manhour')
        .select('*')
        .gte('ended_at', `${period!.from}T00:00:00+09:00`)
        .lt('ended_at', `${addDays(period!.to, 1)}T00:00:00+09:00`)
        .order('ended_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as LotManhourRow),
        worker_count: num(r.worker_count),
        work_hours: num(r.work_hours),
        man_hour: num(r.man_hour),
      }));
    },
  });
}

// 출하일이 기간 안인 LOT 리드타임
export function usePeriodLotLeadtimes(period: Period | null) {
  return useQuery<LotLeadtimeRow[]>({
    queryKey: ['period', 'lot-leadtimes', period?.from, period?.to],
    enabled: period != null,
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_lot_leadtime')
        .select('*')
        .gte('shipped_at', period!.from)
        .lte('shipped_at', period!.to)
        .order('shipped_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as LotLeadtimeRow),
        lead_days: num(r.lead_days),
      }));
    },
  });
}

// 기간 안 인사 KPI 중 지표별 최신값
export function usePeriodHrKpi(period: Period | null) {
  return useQuery<HrKpiRecord[], Error, LatestHrKpi>({
    queryKey: ['period', 'hr-kpi', period?.from, period?.to],
    enabled: period != null,
    queryFn: async () => {
      const { data, error } = await sb
        .from('hr_kpi_records')
        .select('id, measured_on, job_conversion_rate_pct, satisfaction_score, note')
        .gte('measured_on', period!.from)
        .lte('measured_on', period!.to)
        .order('measured_on', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as HrKpiRecord),
        job_conversion_rate_pct: num(r.job_conversion_rate_pct),
        satisfaction_score: num(r.satisfaction_score),
      }));
    },
    select: pickLatestHrKpi,
  });
}
