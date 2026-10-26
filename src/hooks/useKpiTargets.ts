import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TargetRow } from './useAdminTargets';

// targets 테이블 조회용 비타입 클라이언트 (useAdminTargets와 동일 관례)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// useTargets와 같은 queryKey(['admin','targets'])를 공유해 관리자 수정 시 invalidate가 그대로 반영된다.
// select로 {key: value} 형태로만 변환한다.
export function useKpiTargets(): UseQueryResult<Record<string, number>> {
  return useQuery<TargetRow[], Error, Record<string, number>>({
    queryKey: ['admin', 'targets'],
    queryFn: async () => {
      const { data, error } = await sb.from('targets').select('*').order('key');
      if (error) throw error;
      return (data ?? []) as TargetRow[];
    },
    select: (rows) => Object.fromEntries(rows.map((t) => [t.key, Number(t.value)])),
  });
}
