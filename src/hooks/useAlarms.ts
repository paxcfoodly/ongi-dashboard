import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AlarmRow {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  source: 'auto' | 'manual' | 'system';
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export function useAlarms(limit = 10) {
  return useQuery<AlarmRow[]>({
    queryKey: ['alarms', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alarms')
        .select('id, severity, source, message, acknowledged, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AlarmRow[];
    },
  });
}
