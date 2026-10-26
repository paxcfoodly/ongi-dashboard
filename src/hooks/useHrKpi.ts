import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// 비타입 클라이언트 사용 이유: numeric 컬럼이 문자열로 내려와 직접 Number 변환하고(num),
// insert/update 페이로드의 생성 타입이 엄격해 폼 값(부분 필드) 전달 시 타입이 맞지 않기 때문.
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

// 측정일 내림차순 전체 기록 조회 (목록·최신값 훅 공용)
async function fetchHrKpiRecords(): Promise<HrKpiRecord[]> {
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
}

export function useHrKpiRecords() {
  return useQuery<HrKpiRecord[]>({
    queryKey: ['hr-kpi'],
    queryFn: fetchHrKpiRecords,
  });
}

export interface LatestHrValue {
  value: number;
  measured_on: string;
}

export interface LatestHrKpi {
  job: LatestHrValue | null;
  satisfaction: LatestHrValue | null;
}

// 지표별로 값이 있는(null 아님) 가장 최근 기록을 고른다 — 입력은 측정일 내림차순
export function pickLatestHrKpi(records: HrKpiRecord[]): LatestHrKpi {
  const job = records.find((r) => r.job_conversion_rate_pct != null);
  const sat = records.find((r) => r.satisfaction_score != null);
  return {
    job: job ? { value: job.job_conversion_rate_pct as number, measured_on: job.measured_on } : null,
    satisfaction: sat ? { value: sat.satisfaction_score as number, measured_on: sat.measured_on } : null,
  };
}

// 지표별 최신값 — 목록과 같은 ['hr-kpi'] 캐시를 select 로 재사용 (추가 조회 없음)
export function useLatestHrKpi() {
  return useQuery<HrKpiRecord[], Error, LatestHrKpi>({
    queryKey: ['hr-kpi'],
    queryFn: fetchHrKpiRecords,
    select: pickLatestHrKpi,
  });
}

// id가 있으면 수정, 없으면 신규 insert (같은 측정일이 있으면 unique 위반으로 실패 → 덮어쓰지 않음)
export function useUpsertHrKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HrKpiInput) => {
      const { id, ...fields } = input;
      if (id) {
        const { error } = await sb.from('hr_kpi_records').update(fields).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('hr_kpi_records').insert(fields);
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
