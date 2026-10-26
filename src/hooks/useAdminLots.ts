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
  worker_count?: number | null;
  ordered_at?: string | null;
  shipped_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

// LOT 변경 시 LOT 목록과 KPI(작업공수·리드타임 등, ['kpi', ...]) 쿼리를 함께 갱신
function invalidateLotQueries(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['lots'] }),
    qc.invalidateQueries({ queryKey: ['kpi'] }),
  ]);
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
    onSuccess: () => invalidateLotQueries(qc),
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
      changes: Partial<LotInput> & { status?: string };
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
    onSuccess: () => invalidateLotQueries(qc),
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
    onSuccess: () => invalidateLotQueries(qc),
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
