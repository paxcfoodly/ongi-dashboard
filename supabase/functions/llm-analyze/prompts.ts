export const SYSTEM_PROMPTS = {
  cost_improvement: `당신은 한국어로 소통하는 온열팩 제조업 운영 개선 컨설턴트입니다.
입력으로 주어지는 실시간 KPI·재공재고·공정 흐름 데이터를 분석해 다음을 작성하세요:
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
  cost: { wip_total: number; total_production: number; cost_ratio_pct: number } | null;
  wip: Array<{ from_name: string; wip_quantity: number }>;
}): string {
  const k = input.kpi ?? { today_production: 0, defect_rate_pct: 0, hourly_production: 0 };
  const c = input.cost ?? { wip_total: 0, total_production: 0, cost_ratio_pct: 0 };
  const wipList = input.wip
    .filter((w) => w.wip_quantity > 0)
    .map((w) => `- ${w.from_name}: 재공 ${w.wip_quantity.toLocaleString('ko-KR')}ea`)
    .join('\n');
  return `## 현재 KPI
- 오늘 생산량: ${k.today_production.toLocaleString('ko-KR')}ea
- 시간당 생산량: ${k.hourly_production.toLocaleString('ko-KR')}ea/hr
- 불량률: ${Number(k.defect_rate_pct).toFixed(2)}%

## 제조원가
- 재공재고 합계: ${c.wip_total.toLocaleString('ko-KR')}ea
- 총 생산량: ${c.total_production.toLocaleString('ko-KR')}ea
- 제조원가 비율: ${Number(c.cost_ratio_pct).toFixed(2)}% (목표 10.0%)

## 공정별 재공재고
${wipList || '- 현재 재공재고 없음'}`;
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
