import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function loadKoreanFonts(admin: SupabaseClient) {
  const { data: reg, error: e1 } = await admin.storage
    .from('system-assets').download('fonts/NotoSansKR-Regular.ttf');
  if (e1 || !reg) throw new Error('failed to load NotoSansKR-Regular: ' + (e1?.message ?? 'no data'));
  const regularBuf = new Uint8Array(await reg.arrayBuffer());

  let boldBuf = regularBuf;
  const { data: bold } = await admin.storage
    .from('system-assets').download('fonts/NotoSansKR-Bold.ttf');
  if (bold) boldBuf = new Uint8Array(await bold.arrayBuffer());

  return {
    NotoSansKR: {
      normal: regularBuf,
      bold: boldBuf,
      italics: regularBuf,
      bolditalics: boldBuf,
    },
  };
}
