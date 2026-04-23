import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Supabase generated types can be strict about insert/update shapes; use an
// untyped view of the client for mutation payloads (similar to existing admin hooks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface AlarmRule {
  id: string;
  name: string;
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '=';
  threshold: number;
  severity: 'info' | 'warning' | 'danger';
  message_template: string;
  enabled: boolean;
}

export interface AlarmRuleInput {
  name: string;
  metric: string;
  operator: AlarmRule['operator'];
  threshold: number;
  severity: AlarmRule['severity'];
  message_template: string;
}

export function useAlarmRules() {
  return useQuery<AlarmRule[]>({
    queryKey: ['admin', 'alarm_rules'],
    queryFn: async () => {
      const { data, error } = await sb.from('alarm_rules').select('*').order('metric');
      if (error) throw error;
      return (data ?? []) as AlarmRule[];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AlarmRuleInput) => {
      const { error } = await sb.from('alarm_rules').insert({ ...input, enabled: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<AlarmRuleInput> & { enabled?: boolean };
    }) => {
      const { error } = await sb.from('alarm_rules').update(changes).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('alarm_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'alarm_rules'] }),
  });
}
