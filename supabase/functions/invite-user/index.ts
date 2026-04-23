import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZodError } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { InviteUserSchema } from './schemas.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerJwt = authHeader.replace(/^Bearer\s+/, '');
  if (!callerJwt) return json({ error: 'missing_auth' }, 401);

  // 호출자 admin 권한 확인 (is_admin() RPC)
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin');
  if (adminErr || !isAdmin) {
    return json({ error: 'forbidden' }, 403);
  }

  // 바디 파싱 + 검증
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  let parsed;
  try {
    parsed = InviteUserSchema.parse(payload);
  } catch (e) {
    if (e instanceof ZodError) {
      return json({ error: 'schema_invalid', details: e.flatten() }, 400);
    }
    return json({ error: 'internal' }, 500);
  }

  // GoTrue Admin API로 사용자 생성
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name },
  });

  if (createErr || !created.user) {
    const code = createErr?.status === 422 ? 409 : 500;
    return json({
      error: createErr?.code ?? 'create_failed',
      message: createErr?.message ?? 'unknown error',
    }, code);
  }

  // 프로필 role 설정 (handle_new_user 트리거가 'viewer'로 생성 → 필요 시 admin 승격)
  if (parsed.role === 'admin') {
    const { error: roleErr } = await admin
      .from('profiles')
      .update({ role: 'admin', full_name: parsed.full_name })
      .eq('id', created.user.id);
    if (roleErr) {
      return json({ error: 'profile_update_failed', message: roleErr.message }, 500);
    }
  }

  return json({
    ok: true,
    user_id: created.user.id,
    email: created.user.email,
    role: parsed.role,
  });
});
