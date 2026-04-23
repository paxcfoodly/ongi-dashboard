import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const INVITE_URL = 'http://127.0.0.1:54321/functions/v1/invite-user';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE);

async function createTestAdmin(): Promise<string> {
  const email = `admin-test-${Date.now()}@example.com`;
  const { data } = await admin.auth.admin.createUser({
    email, password: 'pw-adm1n-test', email_confirm: true,
  });
  await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user!.id);
  return email;
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`signin failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

describe('invite-user edge function', () => {
  let adminJwt: string;
  const inviteeEmails: string[] = [];

  beforeAll(async () => {
    const adminEmail = await createTestAdmin();
    adminJwt = await signIn(adminEmail, 'pw-adm1n-test');
  });

  afterAll(async () => {
    for (const email of inviteeEmails) {
      const { data } = await admin.auth.admin.listUsers();
      const u = data.users.find((x) => x.email === email);
      if (u) await admin.auth.admin.deleteUser(u.id);
    }
  });

  it('rejects missing auth with 401', async () => {
    const res = await fetch(INVITE_URL, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('rejects viewer with 403', async () => {
    const viewerEmail = `viewer-${Date.now()}@example.com`;
    const { data } = await admin.auth.admin.createUser({
      email: viewerEmail, password: 'pw-view3r-test', email_confirm: true,
    });
    const viewerJwt = await signIn(viewerEmail, 'pw-view3r-test');

    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${viewerJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'x@y.com', full_name: '테스트', role: 'viewer' }),
    });
    expect(res.status).toBe(403);
    await admin.auth.admin.deleteUser(data.user!.id);
  });

  it('invites a viewer successfully', async () => {
    const email = `invitee-${Date.now()}@example.com`;
    inviteeEmails.push(email);
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email, full_name: '홍길동', role: 'viewer', password: 'tempPass123',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.email).toBe(email);
    expect(body.role).toBe('viewer');
  });

  it('invites an admin and promotes role', async () => {
    const email = `admin-invitee-${Date.now()}@example.com`;
    inviteeEmails.push(email);
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email, full_name: '관리자2', role: 'admin', password: 'tempPass123',
      }),
    });
    expect(res.status).toBe(200);

    const { data } = await admin.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    expect(user).toBeDefined();
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user!.id).maybeSingle();
    expect(profile?.role).toBe('admin');
  });

  it('rejects invalid email with 400', async () => {
    const res = await fetch(INVITE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminJwt}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'not-an-email', full_name: 'X' }),
    });
    expect(res.status).toBe(400);
  });
});
