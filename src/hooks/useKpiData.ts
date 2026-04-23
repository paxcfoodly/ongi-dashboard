import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DailyKpi {
  today_production: number;
  runtime_sec_today: number;
  hourly_production: number;
  work_time_per_ea: number;
  inspected: number;
  defects: number;
  defect_rate_pct: number;
  claims_count: number;
}

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useKpiData() {
  return useQuery<DailyKpi | null>({
    queryKey: ['kpi', 'daily'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_daily_kpi')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DailyKpi | null;
    },
  });
}
