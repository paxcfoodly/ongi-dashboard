import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { kstToday } from '../lib/services/period';
import type { LiveEquipmentRow, LiveVisionRow } from '../lib/services/liveStatus';

// 실시간 화면 갱신 주기. 장비 패킷은 1분 단위로 들어온다
export const LIVE_REFRESH_MS = 10_000;
// 패킷 목록·최근 30분 차트에 충분한 행 수 (모니터링 장비당 분당 1행)
const LIVE_ROW_LIMIT = 60;

// 조인 필터 문법이 생성 타입에 없어 뷰 조회와 같은 방식으로 호출한다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useLiveEquipment() {
  return useQuery<LiveEquipmentRow[]>({
    queryKey: ['live', 'equipment'],
    refetchInterval: LIVE_REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await sb
        .from('equipment_metrics')
        .select('id, device_id, bucket_at, created_at, runtime_seconds, output_count, devices!inner(name, monitored)')
        .eq('devices.monitored', true)
        .order('bucket_at', { ascending: false })
        .limit(LIVE_ROW_LIMIT);
      if (error) throw error;
      return (data ?? []) as LiveEquipmentRow[];
    },
  });
}

export function useLiveVision() {
  return useQuery<LiveVisionRow[]>({
    queryKey: ['live', 'vision'],
    refetchInterval: LIVE_REFRESH_MS,
    queryFn: async () => {
      const { data, error } = await sb
        .from('vision_inspector_metrics')
        .select('id, device_id, bucket_at, created_at, total_inspected, good_count, defect_count, unknown_count, devices!inner(name, monitored)')
        .eq('devices.monitored', true)
        .order('bucket_at', { ascending: false })
        .limit(LIVE_ROW_LIMIT);
      if (error) throw error;
      return (data ?? []) as LiveVisionRow[];
    },
  });
}

export interface TodayTotals {
  production: number;
  inspected: number;
  defects: number;
  unknown: number;
}

// 오늘 합계 (재검 수는 v_daily_kpi에 없어 날짜별 집계 함수를 쓴다)
export function useTodayTotals() {
  return useQuery<TodayTotals | null>({
    queryKey: ['live', 'today-totals'],
    refetchInterval: LIVE_REFRESH_MS,
    queryFn: async () => {
      const today = kstToday();
      const { data, error } = await sb.rpc('fn_kpi_daily', { p_from: today, p_to: today });
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as TodayTotals | null;
    },
  });
}
