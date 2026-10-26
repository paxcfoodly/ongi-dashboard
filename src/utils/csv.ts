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
