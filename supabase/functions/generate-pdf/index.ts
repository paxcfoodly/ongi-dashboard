import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// pdfmake CDN bundle (browser-like global)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import pdfMake from 'https://esm.sh/pdfmake@0.2.10/build/pdfmake.js';
import { loadKoreanFonts } from './fonts.ts';
import { lotReportDoc } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'unauthorized' }, 401);

  let body: { type?: string; id?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body.type || !body.id) return json({ error: 'missing_params' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (body.type !== 'lot_report') {
    return json({ error: 'unknown_type' }, 400);
  }

  const { data: lot, error: lotErr } = await admin
    .from('v_lot_summary').select('*').eq('id', body.id).maybeSingle();
  if (lotErr || !lot) return json({ error: 'lot_not_found' }, 404);

  let vfs: Record<string, Uint8Array>;
  try {
    const fonts = await loadKoreanFonts(admin);
    vfs = {
      'NotoSansKR-Regular.ttf': fonts.NotoSansKR.normal,
      'NotoSansKR-Bold.ttf': fonts.NotoSansKR.bold,
    };
  } catch (e) {
    return json({ error: 'fonts_unavailable', message: (e as Error).message }, 500);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfmake = pdfMake as any;

  const doc = lotReportDoc(lot as never);
  const buf: Uint8Array = await new Promise((resolve, reject) => {
    try {
      pdfmake.createPdf(doc, undefined, {
        NotoSansKR: {
          normal: 'NotoSansKR-Regular.ttf',
          bold: 'NotoSansKR-Bold.ttf',
          italics: 'NotoSansKR-Regular.ttf',
          bolditalics: 'NotoSansKR-Bold.ttf',
        },
      }, vfs).getBuffer((b: Uint8Array) => resolve(b));
    } catch (e) { reject(e); }
  });

  const fileName = `lot/${lot.lot_no}-${Date.now()}.pdf`;
  const { error: upErr } = await admin.storage
    .from('reports').upload(fileName, buf, {
      contentType: 'application/pdf', upsert: true,
    });
  if (upErr) return json({ error: 'upload_failed', message: upErr.message }, 500);

  const { data: signed } = await admin.storage
    .from('reports').createSignedUrl(fileName, 60 * 15);
  return json({ ok: true, url: signed?.signedUrl, file: fileName });
});
