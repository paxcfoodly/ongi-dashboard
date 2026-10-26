const pad = (n: number) => String(n).padStart(2, '0');

// ISO 문자열 → datetime-local 입력용 로컬 시각 (YYYY-MM-DDTHH:mm)
export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// datetime-local 입력값 → ISO 문자열 (빈 값은 null)
export function fromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
