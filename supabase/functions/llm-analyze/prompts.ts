export const SYSTEM_PROMPTS = {
  cost_improvement: `당신은 한국어로 소통하는 온열팩 제조업 운영 개선 컨설턴트입니다.
입력으로 주어지는 실시간 KPI·LOT별 작업공수·납기(리드타임) 데이터를 분석해, 1 LOT 작업공수(man-hour) 절감 관점에서 다음을 작성하세요:
1) 현재 상황 진단 (3~5 bullet)
2) 우선순위 높은 개선 과제 3가지 (과제명 / 근거 / 예상 효과)
3) 1주일 내 실행 가능한 액션 아이템 3가지 (담당 부서 추정 포함)
결과는 간결한 마크다운으로 작성하고 데이터에 없는 가정은 피하세요.`,

  claim_response: `당신은 B2B 식품 납품사 고객 응대 담당자입니다.
아래 클레임 정보와 관련 LOT 품질 데이터를 기반으로 **고객사에 보낼 공식 대응문**을 한국어 존댓말로 작성하세요.
- 사과 + 원인 추정 + 후속 조치 + 재발 방지 약속 4단 구조
- 수치는 반드시 제공된 값만 사용
- 1~2 문단, 과장 없이 책임감 있는 톤
- 끝에 품질관리팀 서명을 남기세요.`,
};

export function buildCostImprovementContext(input: {
  kpi: { today_production: number; defect_rate_pct: number; hourly_production: number } | null;
  manhour: { lot_count: number; avg_man_hour: number | null; latest_man_hour: number | null } | null;
  lots: Array<{ lot_no: string; worker_count: number | null; work_hours: number | null; man_hour: number | null }>;
  leadtime: { lot_count: number; avg_lead_days: number | null } | null;
  targets: Record<string, number>;
}): string {
  const k = input.kpi ?? { today_production: 0, defect_rate_pct: 0, hourly_production: 0 };
  const t = input.targets;
  // 값이 없으면 0 대신 사유 문구를 쓴다
  const n = (v: number | null | undefined, d = 1, unit = '') =>
    v == null || Number.isNaN(Number(v)) ? '데이터 없음' : `${Number(v).toFixed(d)}${unit}`;
  const lotList = input.lots
    .map(
      (l) =>
        `- ${l.lot_no}: 투입인원 ${n(l.worker_count, 0)}명 × 작업시간 ${n(l.work_hours, 1)}h = ${n(l.man_hour, 1)} man-hour`,
    )
    .join('\n');
  const m = input.manhour;
  const lt = input.leadtime;
  return `## 현재 KPI
- 오늘 생산량: ${k.today_production.toLocaleString('ko-KR')}ea
- 시간당 생산량: ${k.hourly_production.toLocaleString('ko-KR')}ea/hr
- 불량률: ${Number(k.defect_rate_pct).toFixed(2)}%

## 원가(작업공수) — 1 LOT = ${n(t.lot_weight_kg, 0)}kg
- LOT당 작업공수 평균(최근 30일): ${n(m?.avg_man_hour, 1, ' man-hour')} (완료 LOT ${m?.lot_count ?? 0}건)
- 최근 LOT 작업공수: ${n(m?.latest_man_hour, 1, ' man-hour')}
- 기존 ${n(t.manhour_baseline, 0)} → 목표 ${n(t.manhour_target, 0)} man-hour

## LOT별 작업공수 (최근 30일 · 최근 10건)
${lotList || '- 완료된 LOT 없음'}

## 납기 (수주→출하)
- 평균 리드타임(최근 30일): ${n(lt?.avg_lead_days, 1, '일')} (출하 LOT ${lt?.lot_count ?? 0}건)
- 기존 ${n(t.leadtime_baseline, 0)} → 목표 ${n(t.leadtime_target, 0)}일`;
}

export function buildClaimResponseContext(claim: {
  client_name: string;
  received_at: string;
  defect_type: string | null;
  quantity: number | null;
  description: string | null;
  lot?: { lot_no: string; inspected: number; defect_count: number; defect_rate_pct: number } | null;
}): string {
  const lotBlock = claim.lot
    ? `## 관련 LOT
- LOT 번호: ${claim.lot.lot_no}
- 검사 수량: ${claim.lot.inspected.toLocaleString('ko-KR')}ea
- 불량 수량: ${claim.lot.defect_count.toLocaleString('ko-KR')}ea
- 불량률: ${Number(claim.lot.defect_rate_pct).toFixed(2)}%`
    : '## 관련 LOT\n- 연결된 LOT 없음';
  return `## 클레임 정보
- 납품처: ${claim.client_name}
- 접수일시: ${new Date(claim.received_at).toLocaleString('ko-KR')}
- 불량 유형: ${claim.defect_type ?? '미지정'}
- 수량: ${claim.quantity ?? '미지정'}
- 설명: ${claim.description ?? '(없음)'}

${lotBlock}`;
}
