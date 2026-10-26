// LOT 모달 폼 상태 (입력값은 모두 문자열로 보관)
export interface LotFormState {
  lot_no: string;
  client_id: string;
  product_name: string;
  target_quantity: string;
  notes: string;
  worker_count: string;
  ordered_at: string;
  shipped_at: string;
  started_at: string; // datetime-local 형식
  ended_at: string; // datetime-local 형식
}

export const EMPTY_LOT_FORM: LotFormState = {
  lot_no: '',
  client_id: '',
  product_name: '',
  target_quantity: '',
  notes: '',
  worker_count: '',
  ordered_at: '',
  shipped_at: '',
  started_at: '',
  ended_at: '',
};

// 폼 저장 시 시작/종료 시각으로 LOT 상태 도출 — 바꿀 필요가 없으면 undefined
// 둘 다 있으면 completed, 시작만 있고 현재 planned면 running, 그 외는 그대로 둔다
export function deriveLotStatus(
  current: string,
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | undefined {
  if (startedAt && endedAt) return current === 'completed' ? undefined : 'completed';
  if (startedAt && current === 'planned') return 'running';
  return undefined;
}
