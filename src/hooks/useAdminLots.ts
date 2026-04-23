import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about insert/update shapes; use an
// untyped view of the client for mutation payloads (similar to view selects).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface LotInput {
  lot_no: string;
  client_id: string;
  product_name?: string | null;
  target_quantity?: number | null;
  notes?: string | null;
}

export function useCreateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LotInput) => {
      const { data, error } = await sb
        .from('lots')
        .insert({ ...input, status: 'planned' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export function useUpdateLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<LotInput> & { status?: string; started_at?: string; ended_at?: string };
    }) => {
      const { data, error } = await sb
        .from('lots')
        .update(changes)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export function useStartLot() {
  const update = useUpdateLot();
  return (id: string) =>
    update.mutateAsync({
      id,
      changes: { status: 'running', started_at: new Date().toISOString() },
    });
}

export function useEndLot() {
  const update = useUpdateLot();
  return (id: string) =>
    update.mutateAsync({
      id,
      changes: { status: 'completed', ended_at: new Date().toISOString() },
    });
}

export function useDeleteLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('lots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lots'] }),
  });
}

export interface ClientRow {
  id: string;
  name: string;
}

export async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await sb.from('clients').select('id, name').order('name');
  if (error) throw error;
  return (data ?? []) as ClientRow[];
}
