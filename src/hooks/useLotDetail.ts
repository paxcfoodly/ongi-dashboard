import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { LotSummary } from './useLots';

// Supabase generated types don't include views; use untyped client for view access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useLotDetail(lotId: string | null) {
  return useQuery<LotSummary | null>({
    queryKey: ['lot', lotId],
    enabled: !!lotId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('v_lot_summary')
        .select('*')
        .eq('id', lotId!)
        .maybeSingle();
      if (error) throw error;
      return ((data ?? null) as unknown) as LotSummary | null;
    },
  });
}
