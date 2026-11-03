import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DeviceStatus {
  id: string;
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string | null;
  last_seen_at: string | null;
}

// 가동상태를 표시할 장비 (devices.monitored). 상태 판정은 lib/services/liveStatus에서 한다
export function useDeviceStatus(refetchInterval?: number) {
  return useQuery<DeviceStatus[]>({
    queryKey: ['devices', 'status'],
    refetchInterval,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, code, name, type, role, last_seen_at')
        .eq('active', true)
        .eq('monitored', true)
        .order('process_order');
      if (error) throw error;
      return (data ?? []) as unknown as DeviceStatus[];
    },
  });
}
