// invalid_key 원인 파악용 힌트 — 키 전체는 절대 남기지 않고 길이·앞 4자리·흔한 실수만 기록
const MIN_LEN_FOR_PREFIX = 16;

export function keyHint(provided: string, registeredPrefix: string | null): string {
  const parts: string[] = [];
  // 짧은 키는 앞 4자리가 키 대부분이 되므로 앞자리를 남기지 않음
  const prefix =
    provided.length >= MIN_LEN_FOR_PREFIX ? `앞 4자리 '${provided.slice(0, 4)}'` : '앞자리 생략(키가 너무 짧음)';
  parts.push(`받은 키 길이 ${provided.length}, ${prefix}`);
  parts.push(registeredPrefix ? `등록된 키 앞 4자리 '${registeredPrefix}'` : '등록된 키 앞자리 기록 없음(재발급하면 기록됨)');

  const notes: string[] = [];
  if (/^bearer\s/i.test(provided)) notes.push('Bearer 포함 — X-Api-Key에는 키만 넣어야 함');
  if (/["']/.test(provided)) notes.push('따옴표 포함');
  if (/\s/.test(provided)) notes.push('공백 포함');
  return parts.join(' / ') + (notes.length ? ` (${notes.join(', ')})` : '');
}
