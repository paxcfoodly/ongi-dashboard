import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// 신규 테이블은 생성 타입에 없으므로 비타입 클라이언트로 조회·쓰기한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface HrKpiRecord {
  id: string;
  measured_on: string;
  job_conversion_rate_pct: number | null;
  satisfaction_score: number | null;
  note: string | null;
}

export interface HrKpiInput {
  id?: string;
  measured_on: string;
  job_conversion_rate_pct: number | null;
  satisfaction_score: number | null;
  note?: string | null;
}

// numeric이 문자열로 올 수 있어 null은 유지하고 나머지는 Number 변환
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export function useHrKpiRecords() {
  return useQuery<HrKpiRecord[]>({
    queryKey: ['hr-kpi'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('hr_kpi_records')
        .select('id, measured_on, job_conversion_rate_pct, satisfaction_score, note')
        .order('measured_on', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as HrKpiRecord),
        job_conversion_rate_pct: num(r.job_conversion_rate_pct),
        satisfaction_score: num(r.satisfaction_score),
      }));
    },
  });
}

// 가장 최근 측정 기록 (없으면 null)
export function useLatestHrKpi() {
  return useQuery<HrKpiRecord | null>({
    queryKey: ['hr-kpi', 'latest'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('hr_kpi_records')
        .select('id, measured_on, job_conversion_rate_pct, satisfaction_score, note')
        .order('measured_on', { ascending: false })
        .limit(1);
      if (error) throw error;
      const r = ((data ?? []) as Record<string, unknown>[])[0];
      if (!r) return null;
      return {
        ...(r as unknown as HrKpiRecord),
        job_conversion_rate_pct: num(r.job_conversion_rate_pct),
        satisfaction_score: num(r.satisfaction_score),
      };
    },
  });
}

// id가 있으면 수정, 없으면 measured_on 기준 upsert
export function useUpsertHrKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HrKpiInput) => {
      const { id, ...fields } = input;
      if (id) {
        const { error } = await sb.from('hr_kpi_records').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from('hr_kpi_records')
          .upsert(fields, { onConflict: 'measured_on' });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-kpi'] }),
  });
}

export function useDeleteHrKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('hr_kpi_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-kpi'] }),
  });
}
