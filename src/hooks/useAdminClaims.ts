import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about insert/update shapes; use an
// untyped view of the client for mutation payloads (similar to existing admin hooks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ClaimRow {
  id: string;
  lot_id: string | null;
  client_id: string;
  client_name?: string;
  received_at: string;
  defect_type: string | null;
  quantity: number | null;
  description: string | null;
  status: 'open' | 'investigating' | 'resolved';
  created_at: string;
}

export interface ClaimInput {
  client_id: string;
  lot_id?: string | null;
  received_at: string;
  defect_type?: string | null;
  quantity?: number | null;
  description?: string | null;
}

export function useClaims() {
  return useQuery<ClaimRow[]>({
    queryKey: ['claims'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('claims')
        .select('*, clients(name)')
        .order('received_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
        ...(c as unknown as ClaimRow),
        client_name: (c.clients as { name: string } | null)?.name,
      }));
    },
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClaimInput) => {
      const { data, error } = await sb.from('claims').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

export function useUpdateClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ClaimRow['status'] }) => {
      const { error } = await sb.from('claims').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

export function useDeleteClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('claims').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}
