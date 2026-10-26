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
