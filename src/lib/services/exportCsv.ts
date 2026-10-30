// 엑셀(CSV) 내보내기용 변환 — 화면 표시 문자열·DB 행을 엑셀에서 계산 가능한 칸으로 바꿈
import { toCsv } from '../../utils/csv';
import type { DailyColumn } from '../../components/period/DailyTable';
import type { LotManhourRow, LotLeadtimeRow } from '../../hooks/useManhourKpi';

// 분 단위 원데이터는 장비 5대 × 1,440분 × 31일 ≈ 22만 행이 상한 (브라우저에서 무리 없는 크기)
export const RAW_EXPORT_MAX_DAYS = 31;

// '1,864' · '1.93 s' · '12.5%' · '1,738 ea/hr' → 숫자만, '—'·'-'·'' → 빈 칸, 그 밖의 글자는 그대로
export function toNumericCell(text: string): string {
  const t = text.trim();
  if (t === '' || t === '—' || t === '-') return '';
  const m = t.replace(/,/g, '').match(/^(-?\d+(?:\.\d+)?)\s*(?:%|s|h|ea|ea\/hr|sec\/ea|일|man-hour)?$/);
  return m ? m[1] : t;
}

// 한국시각 'YYYY-MM-DD HH:mm'
export function toKstMinute(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16);
}

const num = (v: number | string | null | undefined): string => (v == null ? '' : String(Number(v)));

export function dailyTableCsv<T extends { day: string }>(rows: T[], columns: DailyColumn<T>[]): string {
  const cols = [{ key: 'day', header: '날짜' }, ...columns.map((c, i) => ({ key: `c${i}`, header: c.header }))];
  const toRow = (day: string, values: string[]) =>
    Object.fromEntries([['day', day], ...values.map((v, i) => [`c${i}`, toNumericCell(v)])]);
  const body = rows.map((r) => toRow(r.day, columns.map((c) => c.cell(r))));
  const footer = toRow('기간 합계·평균', columns.map((c) => (c.agg === 'none' ? '' : c.total)));
  return toCsv([...body, footer], cols);
}

interface DeviceRef { code: string; name: string }

export interface RawEquipmentRow {
  bucket_at: string;
  runtime_seconds: number;
  output_count: number;
  devices: DeviceRef | null;
}

export interface RawVisionRow {
  bucket_at: string;
  total_inspected: number;
  good_count: number;
  defect_count: number;
  unknown_count: number;
  inspection_time_seconds: number | string;
  devices: DeviceRef | null;
}

export function rawEquipmentCsv(rows: RawEquipmentRow[]): string {
  return toCsv(
    rows.map((r) => ({
      t: toKstMinute(r.bucket_at), code: r.devices?.code ?? '', name: r.devices?.name ?? '',
      run: num(r.runtime_seconds), out: num(r.output_count),
    })),
    [
      { key: 't', header: '시각(KST)' }, { key: 'code', header: '장비코드' }, { key: 'name', header: '장비명' },
      { key: 'run', header: '가동시간(초)' }, { key: 'out', header: '생산수량(ea)' },
    ],
  );
}

export function rawVisionCsv(rows: RawVisionRow[]): string {
  return toCsv(
    rows.map((r) => ({
      t: toKstMinute(r.bucket_at), code: r.devices?.code ?? '', name: r.devices?.name ?? '',
      total: num(r.total_inspected), good: num(r.good_count), defect: num(r.defect_count),
      unknown: num(r.unknown_count), sec: num(r.inspection_time_seconds),
    })),
    [
      { key: 't', header: '시각(KST)' }, { key: 'code', header: '장비코드' }, { key: 'name', header: '장비명' },
      { key: 'total', header: '검사수' }, { key: 'good', header: '양품' }, { key: 'defect', header: '불량' },
      { key: 'unknown', header: '재검' }, { key: 'sec', header: '검사시간(초)' },
    ],
  );
}

export function lotManhourCsv(lots: Pick<LotManhourRow, 'lot_no' | 'started_at' | 'ended_at' | 'work_hours' | 'worker_count' | 'man_hour'>[]): string {
  return toCsv(
    lots.map((l) => ({
      lot: l.lot_no, s: toKstMinute(l.started_at), e: toKstMinute(l.ended_at),
      h: num(l.work_hours), w: num(l.worker_count), mh: num(l.man_hour),
    })),
    [
      { key: 'lot', header: 'LOT번호' }, { key: 's', header: '시작(KST)' }, { key: 'e', header: '종료(KST)' },
      { key: 'h', header: '작업시간(h)' }, { key: 'w', header: '투입인원' }, { key: 'mh', header: 'man-hour' },
    ],
  );
}

export function lotLeadtimeCsv(lots: Pick<LotLeadtimeRow, 'lot_no' | 'ordered_at' | 'shipped_at' | 'lead_days'>[]): string {
  return toCsv(
    lots.map((l) => ({ lot: l.lot_no, o: l.ordered_at ?? '', s: l.shipped_at ?? '', d: num(l.lead_days) })),
    [
      { key: 'lot', header: 'LOT번호' }, { key: 'o', header: '수주일' },
      { key: 's', header: '출하일' }, { key: 'd', header: '리드타임(일)' },
    ],
  );
}
