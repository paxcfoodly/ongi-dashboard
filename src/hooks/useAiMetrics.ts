import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AiMetrics {
  total_inspected: number;
  defect_count: number;
  unknown_count: number;
  total_inspection_time_sec: number;
  defect_detection_pct: number;
  throughput_ea_per_hr: number;
  recheck_rate_pct: number;
}

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useAiMetrics() {
  return useQuery<AiMetrics | null>({
    queryKey: ['ai', 'metrics'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_ai_metrics').select('*').maybeSingle();
      if (error) throw error;
      return (data ?? null) as AiMetrics | null;
    },
  });
}
