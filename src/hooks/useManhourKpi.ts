import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// 비타입 클라이언트 사용 이유: 뷰의 numeric 컬럼이 문자열로 내려와(생성 타입은 number로 표기)
// 응답을 직접 Number 변환(num)해야 하고, 뷰 컬럼이 생성 타입상 모두 nullable이라 행 타입과 맞지 않기 때문.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ManhourKpi {
  lot_count: number;
  avg_man_hour: number | null;
  latest_man_hour: number | null;
}

export interface LeadtimeKpi {
  lot_count: number;
  avg_lead_days: number | null;
}

export interface LotManhourRow {
  id: string;
  lot_no: string;
  started_at: string | null;
  ended_at: string | null;
  worker_count: number | null;
  work_hours: number | null;
  man_hour: number | null;
}

export interface LotLeadtimeRow {
  id: string;
  lot_no: string;
  ordered_at: string | null;
  shipped_at: string | null;
  lead_days: number | null;
}

// numeric이 문자열로 올 수 있어 null은 유지하고 나머지는 Number 변환
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function useManhourKpi() {
  return useQuery<ManhourKpi | null>({
    queryKey: ['kpi', 'manhour'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_kpi_manhour').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        lot_count: Number(data.lot_count ?? 0),
        avg_man_hour: num(data.avg_man_hour),
        latest_man_hour: num(data.latest_man_hour),
      };
    },
  });
}

export function useLeadtimeKpi() {
  return useQuery<LeadtimeKpi | null>({
    queryKey: ['kpi', 'leadtime'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_kpi_leadtime').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        lot_count: Number(data.lot_count ?? 0),
        avg_lead_days: num(data.avg_lead_days),
      };
    },
  });
}

export function useRecentLotManhours(limit = 10) {
  return useQuery<LotManhourRow[]>({
    queryKey: ['kpi', 'lot-manhours', limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_lot_manhour')
        .select('*')
        .order('ended_at', { ascending: false })
        .limit(limit);
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

export function useRecentLotLeadtimes(limit = 10) {
  return useQuery<LotLeadtimeRow[]>({
    queryKey: ['kpi', 'lot-leadtimes', limit],
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_lot_leadtime')
        .select('*')
        .order('shipped_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as LotLeadtimeRow),
        lead_days: num(r.lead_days),
      }));
    },
  });
}
