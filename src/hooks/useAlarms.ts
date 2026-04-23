import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

export function useAlarmRealtime(onNew: (a: AlarmRow) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('alarms-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alarms' },
        (payload) => {
          const row = payload.new as AlarmRow;
          onNew(row);
          qc.invalidateQueries({ queryKey: ['alarms'] });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onNew, qc]);
}
