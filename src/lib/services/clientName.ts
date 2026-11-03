// 납품처 이름 비교 규칙: 수기 입력의 띄어쓰기·대소문자 차이로 같은 납품처가 중복 등록되지 않게 한다
export function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const compareKey = (name: string) => name.replace(/\s+/g, '').toLowerCase();

export function findClientByName<T extends { name: string }>(clients: T[], name: string): T | undefined {
  const key = compareKey(name);
  return clients.find((c) => compareKey(c.name) === key);
}
