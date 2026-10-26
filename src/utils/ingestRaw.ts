// 수신 로그 원본(raw_body)에서 bucket_at 추출 (실패 시 빈 값)
// JSON이 아니면 CSV로 보고 supabase/functions/ingest/csv.ts(parseCsvRow)와 같은 방식으로
// 헤더 1행 + 첫 데이터 행을 콤마 분리해 헤더 인덱스로 값을 찾는다.
export function bucketAt(body: string | null, contentType?: string | null): string {
  if (!body) return '';
  try {
    const v = JSON.parse(body)?.bucket_at;
    return typeof v === 'string' ? v : '';
  } catch {
    return csvBucketAt(body, contentType);
  }
}

function csvBucketAt(body: string, contentType?: string | null): string {
  const lines = body.trim().split(/\r?\n/);
  const header = (lines[0] ?? '').split(',').map((h) => h.trim());
  const idx = header.indexOf('bucket_at');
  // content_type이 text/csv이거나, 헤더에 bucket_at이 있으면 CSV로 취급
  const isCsv = (contentType ?? '').toLowerCase().includes('text/csv') || idx >= 0;
  if (!isCsv || idx < 0 || lines.length < 2) return '';
  return lines[1].split(',').map((v) => v.trim())[idx] ?? '';
}
