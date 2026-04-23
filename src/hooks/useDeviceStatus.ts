import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type DeviceHealth = 'running' | 'warn' | 'offline';

export interface DeviceStatus {
  id: string;
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  last_seen_at: string | null;
  health: DeviceHealth;
}

function computeHealth(lastSeenAt: string | null): DeviceHealth {
  if (!lastSeenAt) return 'offline';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (diffMs > 5 * 60_000) return 'offline'; // 5분
  if (diffMs > 2 * 60_000) return 'warn';    // 2분
  return 'running';
}

export function useDeviceStatus() {
  return useQuery<DeviceStatus[]>({
    queryKey: ['devices', 'status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, code, name, type, role, last_seen_at, active')
        .eq('active', true)
        .order('process_order');
      if (error) throw error;
      return (data ?? []).map((d) => ({
        ...d,
        health: computeHealth(d.last_seen_at),
      })) as unknown as DeviceStatus[];
    },
  });
}
