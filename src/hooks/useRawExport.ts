import { supabase } from '../lib/supabase';
import { addDays, type Period } from '../lib/services/period';
import { fetchAllPages } from './usePeriodKpi';
import type { RawEquipmentRow, RawVisionRow } from '../lib/services/exportCsv';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 조인 select 결과 타입을 서비스 타입으로 직접 지정
const sb = supabase as any;

// 기간(KST) 안의 분 단위 원데이터 — 장비 코드·이름을 함께 가져옴
function kstBounds(period: Period) {
  return { from: `${period.from}T00:00:00+09:00`, to: `${addDays(period.to, 1)}T00:00:00+09:00` };
}

export async function fetchRawEquipment(period: Period, onPage?: (n: number) => void): Promise<RawEquipmentRow[]> {
  const b = kstBounds(period);
  const rows = await fetchAllPages(
    () =>
      sb.from('equipment_metrics')
        .select('bucket_at, runtime_seconds, output_count, devices(code, name)')
        .gte('bucket_at', b.from)
        .lt('bucket_at', b.to)
        .order('bucket_at', { ascending: true })
        .order('id', { ascending: true }),
    onPage,
  );
  return rows as unknown as RawEquipmentRow[];
}

export async function fetchRawVision(period: Period, onPage?: (n: number) => void): Promise<RawVisionRow[]> {
  const b = kstBounds(period);
  const rows = await fetchAllPages(
    () =>
      sb.from('vision_inspector_metrics')
        .select('bucket_at, total_inspected, good_count, defect_count, unknown_count, inspection_time_seconds, devices(code, name)')
        .gte('bucket_at', b.from)
        .lt('bucket_at', b.to)
        .order('bucket_at', { ascending: true })
        .order('id', { ascending: true }),
    onPage,
  );
  return rows as unknown as RawVisionRow[];
}
