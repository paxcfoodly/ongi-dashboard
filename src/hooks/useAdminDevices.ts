import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about insert/update shapes; use an
// untyped view of the client for mutation payloads (similar to existing admin hooks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface DeviceRow {
  id: string;
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  process_order: number;
  active: boolean;
  last_seen_at: string | null;
  api_key_hash: string;
}

export interface DeviceInput {
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  process_order: number;
}

export function useDevices() {
  return useQuery<DeviceRow[]>({
    queryKey: ['admin', 'devices'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('devices')
        .select('*')
        .order('process_order');
      if (error) throw error;
      return (data ?? []) as DeviceRow[];
    },
  });
}

function generateApiKey(): string {
  // Phase 4: 평문 키를 클라이언트에서 1회만 노출하고, 서버측은 bcrypt 해시만 저장.
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeviceInput) => {
      const apiKey = generateApiKey();
      const { data: device, error } = await sb
        .from('devices')
        .insert({ ...input, api_key_hash: 'pending', active: true })
        .select()
        .single();
      if (error) throw error;
      const { error: setErr } = await sb.rpc('fn_set_device_api_key', {
        p_device_id: device.id,
        p_plain_key: apiKey,
      });
      if (setErr) throw setErr;
      return { device: device as DeviceRow, apiKey };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}

export function useRegenerateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const apiKey = generateApiKey();
      const { error } = await sb.rpc('fn_set_device_api_key', {
        p_device_id: id,
        p_plain_key: apiKey,
      });
      if (error) throw error;
      return apiKey;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<DeviceInput> & { active?: boolean };
    }) => {
      const { error } = await sb.from('devices').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'devices'] }),
  });
}
