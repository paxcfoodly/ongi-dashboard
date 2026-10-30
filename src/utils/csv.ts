// RFC 4180 CSV 직렬화 (엑셀 한글 깨짐 방지용 UTF-8 BOM 포함)
function escapeCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((r) => columns.map((c) => escapeCell(r[c.key])).join(','));
  return '﻿' + [head, ...lines].join('\r\n');
}

// 브라우저에서 CSV 파일로 저장
export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
