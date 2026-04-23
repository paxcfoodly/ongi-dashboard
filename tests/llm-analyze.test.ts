import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL = 'http://127.0.0.1:54321';
const LLM_URL = `${URL}/functions/v1/llm-analyze`;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(URL, SERVICE);

async function createAndSignIn(): Promise<string> {
  const email = `llm-test-${Date.now()}@example.com`;
  await admin.auth.admin.createUser({ email, password: 'pw-llm-test', email_confirm: true });
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'pw-llm-test' }),
  });
  const b = await res.json();
  return b.access_token;
}

describe('llm-analyze', () => {
  let jwt: string;
  beforeAll(async () => { jwt = await createAndSignIn(); });

  it('rejects missing auth', async () => {
    const r = await fetch(LLM_URL, { method: 'POST', body: '{}' });
    expect(r.status).toBe(401);
  });

  it('returns text for cost_improvement (mock or real)', async () => {
    const r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cost_improvement' }),
    });
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.ok).toBe(true);
    expect(typeof b.text).toBe('string');
    expect(b.text.length).toBeGreaterThan(10);
  });

  it('handles unknown type with 400', async () => {
    const r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'nope' }),
    });
    expect(r.status).toBe(400);
  });
});
