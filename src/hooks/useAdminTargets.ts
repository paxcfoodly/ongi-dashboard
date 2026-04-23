import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about update payload shapes; use an
// untyped view of the client for mutations (matches pattern used by other admin hooks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface TargetRow {
  key: string;
  value: number;
  unit: string | null;
  description: string | null;
}

export function useTargets() {
  return useQuery<TargetRow[]>({
    queryKey: ['admin', 'targets'],
    queryFn: async () => {
      const { data, error } = await sb.from('targets').select('*').order('key');
      if (error) throw error;
      return (data ?? []) as TargetRow[];
    },
  });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: number }) => {
      const { error } = await sb.from('targets').update({ value }).eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'targets'] }),
  });
}
