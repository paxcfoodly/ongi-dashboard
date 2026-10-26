import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface LotSummary {
  id: string;
  lot_no: string;
  client_id: string;
  client_name: string;
  product_name: string | null;
  status: 'planned' | 'running' | 'completed' | 'paused';
  started_at: string | null;
  ended_at: string | null;
  target_quantity: number | null;
  notes: string | null;
  inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  defect_rate_pct: number;
  judgment: '정상' | '주의' | '불합격' | '미검사';
  worker_count: number | null;
  ordered_at: string | null;
  shipped_at: string | null;
  work_hours: number | null;
  man_hour: number | null;
  lead_days: number | null;
}

export interface LotFilter {
  search?: string;
  clientName?: string;
  judgment?: string;
  date?: string; // YYYY-MM-DD
}

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useLots(filter: LotFilter = {}) {
  return useQuery<LotSummary[]>({
    queryKey: ['lots', filter],
    queryFn: async () => {
      let q = sb.from('v_lot_summary').select('*').order('started_at', { ascending: false, nullsFirst: false });
      if (filter.clientName) q = q.eq('client_name', filter.clientName);
      if (filter.judgment)   q = q.eq('judgment', filter.judgment);
      if (filter.search)     q = q.or(`lot_no.ilike.%${filter.search}%,client_name.ilike.%${filter.search}%`);
      if (filter.date) {
        const from = `${filter.date}T00:00:00+09:00`;
        const to   = `${filter.date}T23:59:59+09:00`;
        q = q.gte('started_at', from).lte('started_at', to);
      }
      const { data, error } = await q;
      if (error) throw error;
      // numeric 컬럼은 PostgREST가 문자열로 줄 수 있어 숫자로 변환 (null 유지)
      const num = (v: unknown) => (v == null ? null : Number(v));
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...r,
        worker_count: num(r.worker_count),
        work_hours: num(r.work_hours),
        man_hour: num(r.man_hour),
        lead_days: num(r.lead_days),
      })) as unknown as LotSummary[];
    },
  });
}
