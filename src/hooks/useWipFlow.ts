import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface WipFlowStep {
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  input: number;
  output: number;
  wip_quantity: number;
}

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useWipFlow() {
  return useQuery<WipFlowStep[]>({
    queryKey: ['wip', 'flow'],
    queryFn: async () => {
      const { data, error } = await sb.from('v_wip_flow').select('*');
      if (error) throw error;
      return ((data ?? []) as unknown) as WipFlowStep[];
    },
  });
}
