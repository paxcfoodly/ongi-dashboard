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

// 미래 종료 시각·출하일 차단 (KPI 30일 평균 왜곡 방지) — 시간대 차이를 고려해 1일 여유를 둔다
// 문제가 없으면 null, 있으면 토스트 문구
export function futureDateError(form: LotFormState, now: Date = new Date()): string | null {
  const limit = now.getTime() + 24 * 3600 * 1000;
  if (form.ended_at) {
    const t = new Date(form.ended_at).getTime();
    if (!Number.isNaN(t) && t > limit) return '종료 시각은 미래로 입력할 수 없습니다.';
  }
  // 출하일(YYYY-MM-DD)은 로컬 기준 '내일'까지 허용
  if (form.shipped_at && form.shipped_at > new Date(limit).toLocaleDateString('sv-SE')) {
    return '출하일은 미래로 입력할 수 없습니다.';
  }
  return null;
}
