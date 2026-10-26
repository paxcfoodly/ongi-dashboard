import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  SYSTEM_PROMPTS,
  buildCostImprovementContext,
  buildClaimResponseContext,
} from './prompts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { 'Content-Type': 'application/json' },
  });
}

async function callClaude(system: string, userMessage: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return `(MOCK — ANTHROPIC_API_KEY 가 설정되지 않아 샘플 응답을 반환합니다)

### 현재 상황 진단
- 입력 컨텍스트 길이: ${userMessage.length}자
- 실제 연동 시 Claude 모델이 한국어 응답을 생성합니다.

### 개선 과제 (예시)
1. LOT당 작업공수(man-hour) 절감
2. 불량률 모니터링 대시보드 고도화
3. 수주→출하 리드타임 단축

### 실행 아이템
- 품질팀: 금일부터 LOT별 작업공수 일일 집계
- 생산팀: LOT별 투입인원 배치 최적화 검토
- 엔지니어링: 자동화 장비 가동률 일일 보고`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`anthropic_${res.status}: ${err.slice(0, 200)}`);
  }
  const body = await res.json();
  const text = (body.content?.[0]?.text ?? '') as string;
  return text;
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: user } = await userClient.auth.getUser();
  if (!user.user) return json({ error: 'unauthorized' }, 401);

  let payload: { type?: string; context?: unknown; claim_id?: string };
  try { payload = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (payload.type === 'cost_improvement') {
      const results = await Promise.all([
        admin.from('v_daily_kpi').select('*').maybeSingle(),
        admin.from('v_kpi_manhour').select('*').maybeSingle(),
        admin.from('v_lot_manhour_window').select('*').order('ended_at', { ascending: false }).limit(10),
        admin.from('v_kpi_leadtime').select('*').maybeSingle(),
        admin.from('targets').select('key, value'),
      ]);
      // 하나라도 조회에 실패하면 일부 데이터만으로 분석하지 않고 500 반환 (로그에는 에러 메시지만, 시크릿 없음)
      const failed = results.filter((r) => r.error).map((r) => r.error!.message);
      if (failed.length > 0) {
        console.error('[llm-analyze] cost_improvement 조회 실패:', failed.join(' | '));
        return json({ error: 'query_failed' }, 500);
      }
      const [{ data: kpi }, { data: manhour }, { data: lots }, { data: leadtime }, { data: targetRows }] = results;
      const targets: Record<string, number> = Object.fromEntries(
        ((targetRows ?? []) as Array<{ key: string; value: number | string }>).map((r) => [r.key, Number(r.value)]),
      );
      // 뷰 조회 결과는 Deno에서 타입이 없어(untyped) 컨텍스트 입력 타입으로 단언한다
      const ctx = buildCostImprovementContext({
        kpi: kpi as never,
        manhour: manhour as never,
        lots: (lots ?? []) as never,
        leadtime: leadtime as never,
        targets,
      });
      const text = await callClaude(SYSTEM_PROMPTS.cost_improvement, ctx);
      return json({ ok: true, text, model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-6' : 'mock' });
    }
    if (payload.type === 'claim_response') {
      if (!payload.claim_id) return json({ error: 'missing_claim_id' }, 400);
      const { data: claimRow } = await admin
        .from('claims')
        .select('*, clients(name), lot_id')
        .eq('id', payload.claim_id).maybeSingle();
      if (!claimRow) return json({ error: 'claim_not_found' }, 404);
      const { data: lotRow } = claimRow.lot_id
        ? await admin.from('v_lot_summary').select('lot_no, inspected, defect_count, defect_rate_pct')
            .eq('id', claimRow.lot_id).maybeSingle()
        : { data: null };
      const ctx = buildClaimResponseContext({
        client_name: (claimRow.clients as { name: string } | null)?.name ?? '납품처',
        received_at: claimRow.received_at,
        defect_type: claimRow.defect_type,
        quantity: claimRow.quantity,
        description: claimRow.description,
        // 뷰 조회 결과는 Deno에서 타입이 없어(untyped) 컨텍스트 입력 타입으로 단언한다
        lot: lotRow as never,
      });
      const text = await callClaude(SYSTEM_PROMPTS.claim_response, ctx);
      return json({ ok: true, text, model: ANTHROPIC_API_KEY ? 'claude-sonnet-4-6' : 'mock' });
    }
    return json({ error: 'unknown_type' }, 400);
  } catch (e) {
    return json({ error: 'llm_error', message: (e as Error).message }, 500);
  }
});
