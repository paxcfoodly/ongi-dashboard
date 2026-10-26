import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ingest_logs 신규 컬럼(raw_body 등)이 생성 타입에 없을 수 있어 비타입 클라이언트로 조회한다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface IngestLogRow {
  id: number;
  device_code: string | null;
  received_at: string;
  status: string;
  error_message: string | null;
  raw_body: string | null;
  content_type: string | null;
  raw_payload: unknown;
}

export interface IngestLogFilter {
  deviceCode?: string;
  status?: string; // 'success' | 'duplicate' | 'error'(오류만) | 그 외 정확히 일치
  date?: string; // YYYY-MM-DD (KST)
  page: number;
}

export const PAGE_SIZE = 100;
export const EXPORT_PAGE = 1000; // PostgREST max_rows
export const EXPORT_MAX = 10000;

const SELECT_COLS =
  'id, device_code, received_at, status, error_message, raw_body, content_type, raw_payload';

// 날짜 문자열에 하루를 더한다 (UTC 연산이라 TZ 영향 없음)
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// 공통 필터 적용 (조회·내보내기 공용)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilter(q: any, f: IngestLogFilter) {
  if (f.deviceCode) q = q.eq('device_code', f.deviceCode);
  if (f.status === 'error') q = q.not('status', 'in', '(success,duplicate)');
  else if (f.status) q = q.eq('status', f.status);
  if (f.date) {
    q = q
      .gte('received_at', `${f.date}T00:00:00+09:00`)
      .lt('received_at', `${nextDay(f.date)}T00:00:00+09:00`);
  }
  return q;
}

export function useIngestLogs(filter: IngestLogFilter, opts: { autoRefresh: boolean }) {
  return useQuery<{ rows: IngestLogRow[]; total: number }>({
    queryKey: ['admin', 'ingest-logs', filter],
    refetchInterval: opts.autoRefresh ? 5000 : false,
    queryFn: async () => {
      const q = applyFilter(
        sb.from('ingest_logs').select(SELECT_COLS, { count: 'exact' }),
        filter,
      )
        .order('received_at', { ascending: false })
        // 같은 수신 시각이 많을 때 페이지 경계가 흔들리지 않도록 id 로 보조 정렬
        .order('id', { ascending: false })
        .range(filter.page * PAGE_SIZE, filter.page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as IngestLogRow[], total: count ?? 0 };
    },
  });
}

// CSV용: 1000건씩 페이징해 최대 10,000건까지 가져온다. truncated=상한으로 잘렸는지.
export async function fetchIngestLogsForExport(
  filter: Omit<IngestLogFilter, 'page'>,
): Promise<{ rows: IngestLogRow[]; truncated: boolean }> {
  const rows: IngestLogRow[] = [];
  let truncated = false;
  for (let from = 0; from < EXPORT_MAX; from += EXPORT_PAGE) {
    const { data, error } = await applyFilter(
      sb.from('ingest_logs').select(SELECT_COLS),
      { ...filter, page: 0 },
    )
      .order('received_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as IngestLogRow[];
    rows.push(...chunk);
    if (chunk.length < EXPORT_PAGE) return { rows, truncated };
    if (from + EXPORT_PAGE >= EXPORT_MAX) truncated = true; // 마지막 페이지가 가득 참 → 더 있을 수 있음
  }
  return { rows, truncated };
}
