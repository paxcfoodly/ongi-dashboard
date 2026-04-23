import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CostRatio {
  wip_total: number;
  total_production: number;
  cost_ratio_pct: number;
}

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useCostRatio() {
  return useQuery<CostRatio | null>({
    queryKey: ['cost', 'ratio'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_cost_ratio').select('*').maybeSingle();
      if (error) throw error;
      return (data ?? null) as CostRatio | null;
    },
  });
}
