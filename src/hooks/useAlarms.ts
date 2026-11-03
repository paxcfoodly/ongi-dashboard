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
      // 모니터링 제외 장비에서 이미 쌓인 알람은 표시하지 않는다 (장비와 무관한 알람은 유지)
      const { data: hidden, error: hiddenError } = await supabase
        .from('devices')
        .select('id')
        .eq('monitored', false);
      if (hiddenError) throw hiddenError;
      const hiddenIds = (hidden ?? []).map((d: { id: string }) => d.id);

      let query = supabase
        .from('alarms')
        .select('id, severity, source, message, acknowledged, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (hiddenIds.length > 0) {
        query = query.or(`device_id.is.null,device_id.not.in.(${hiddenIds.join(',')})`);
      }
      const { data, error } = await query;
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
