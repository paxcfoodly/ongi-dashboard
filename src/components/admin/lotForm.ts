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

// 폼 저장 시 최종 시작/종료 시각으로 LOT 상태 도출 — 바꿀 필요가 없으면 undefined
// 매 저장마다 대칭적으로 적용: 둘 다 있으면 completed, 시작만 있으면 running, 둘 다 없으면 planned
// paused 는 두 시각이 모두 있을 때(completed)만 바꾸고 그 외에는 그대로 둔다
// 종료만 있는 경우는 lotTimeError 에서 저장 전에 거부하므로 여기서는 손대지 않는다
export function deriveLotStatus(
  current: string,
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | undefined {
  let next: string;
  if (startedAt && endedAt) next = 'completed';
  else if (endedAt) return undefined;
  else if (current === 'paused') return undefined;
  else next = startedAt ? 'running' : 'planned';
  return next === current ? undefined : next;
}

// 시작/종료 시각 허용 오차 (기기 시계 차이 고려) — 이보다 미래면 거부
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

// 날짜 하한·최대 기간 (DB 제약 20261026000008 과 동일) — 연도 오타(0026 등)로 공수·리드타임 숫자가 넘치는 것 방지
const MIN_DATE = '2020-01-01';
const MAX_WORK_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_LEAD_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

// LOT 시각·출하일 검증 (KPI 30일 평균 왜곡 방지) — 문제가 없으면 null, 있으면 토스트 문구
// 시작·종료 시각은 절대 시각 기준 지금+10분까지, 출하일은 KST 오늘까지 (000007 창 상한과 동일)
export function lotTimeError(form: LotFormState, now: Date = new Date()): string | null {
  if (form.ended_at && !form.started_at) return '시작 시각 없이 종료 시각만 입력할 수 없습니다.';
  // datetime-local·date 값은 'YYYY-MM-DD…' 문자열이라 사전순 비교로 하한 판정 (로컬=KST 기준)
  const tooEarly: [keyof LotFormState, string][] = [
    ['started_at', '시작 시각'],
    ['ended_at', '종료 시각'],
    ['ordered_at', '수주일'],
    ['shipped_at', '출하일'],
  ];
  for (const [key, label] of tooEarly) {
    if (form[key] && form[key] < MIN_DATE) return `${label}은 ${MIN_DATE} 이후로 입력해야 합니다.`;
  }
  const limit = now.getTime() + FUTURE_TOLERANCE_MS;
  const isFuture = (v: string) => {
    const t = new Date(v).getTime();
    return !Number.isNaN(t) && t > limit;
  };
  if (form.started_at && isFuture(form.started_at)) return '시작 시각은 미래로 입력할 수 없습니다.';
  if (form.ended_at && isFuture(form.ended_at)) return '종료 시각은 미래로 입력할 수 없습니다.';
  // 출하일(YYYY-MM-DD)은 브라우저 시간대와 무관하게 KST 날짜로 비교
  const kstToday = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  if (form.shipped_at && form.shipped_at > kstToday) return '출하일은 미래로 입력할 수 없습니다.';
  if (form.started_at && form.ended_at) {
    const ms = new Date(form.ended_at).getTime() - new Date(form.started_at).getTime();
    if (ms > MAX_WORK_MS) return '작업 기간(시작~종료)은 31일을 넘을 수 없습니다.';
  }
  if (form.ordered_at && form.shipped_at) {
    // 'YYYY-MM-DD' 는 UTC 자정으로 해석되므로 날짜 차이가 정확히 일 단위로 나온다
    const days = (new Date(form.shipped_at).getTime() - new Date(form.ordered_at).getTime()) / DAY_MS;
    if (days > MAX_LEAD_DAYS) return '리드타임(수주일~출하일)은 366일을 넘을 수 없습니다.';
  }
  return null;
}

// [종료] 버튼은 종료 시각을 지금으로 기록하므로, 시작 후 31일이 지났으면 DB 제약(lots_work_duration_max)에
// 걸려 원시 오류가 뜬다 — 요청 전에 막고 안내 문구를 돌려준다 (문제없으면 null)
export function lotEndError(startedAt: string | null, now: Date = new Date()): string | null {
  if (!startedAt) return null;
  if (now.getTime() - new Date(startedAt).getTime() > MAX_WORK_MS) {
    return '작업 기간이 31일을 넘어 종료할 수 없습니다. 편집에서 실제 시작·종료 시각을 입력하세요.';
  }
  return null;
}
