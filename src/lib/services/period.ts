// 기간(KST 날짜 YYYY-MM-DD, 양 끝 포함) 계산·검증 서비스.
// SQL fn_kpi_daily 의 규칙과 동일하게 유지한다.

export interface Period {
  from: string
  to: string
}

const MAX_DAYS = 366
const MIN_FROM = '2020-01-01'
const DAY_MS = 86_400_000

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' → UTC 자정 Date */
function toUtc(day: string): Date {
  return new Date(day + 'T00:00:00Z')
}

/** 존재하는 날짜인지 정규식 + 왕복 변환으로 검사 */
function isValidDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false
  const d = toUtc(day)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day
}

/** KST 기준 오늘 (YYYY-MM-DD) */
export function kstToday(now: Date = new Date()): string {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

/** 날짜 문자열에 n일을 더한다 (음수 가능) */
export function addDays(day: string, n: number): string {
  return new Date(toUtc(day).getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** 양 끝 포함 일수 */
export function periodDays(p: Period): number {
  return Math.round((toUtc(p.to).getTime() - toUtc(p.from).getTime()) / DAY_MS) + 1
}

/** 유효하면 null, 아니면 오류 문구 */
export function validatePeriod(p: Period, now: Date = new Date()): string | null {
  if (!isValidDay(p.from) || !isValidDay(p.to)) return '날짜 형식이 올바르지 않습니다.'
  if (p.from > p.to) return '시작일이 종료일보다 늦습니다.'
  if (p.to > kstToday(now)) return '종료일은 오늘 이후일 수 없습니다.'
  if (periodDays(p) > MAX_DAYS) return '조회 기간은 최대 366일입니다.'
  if (p.from < MIN_FROM) return '시작일은 2020-01-01 이후여야 합니다.'
  return null
}

/** URL 쿼리에서 기간을 읽는다. 쿼리 없음 = 오늘 모드(period null, error null) */
export function parsePeriodParams(
  params: URLSearchParams,
  now: Date = new Date(),
): { period: Period | null; error: string | null } {
  const from = params.get('from')
  const to = params.get('to')
  if (from === null && to === null) return { period: null, error: null }
  const invalid = { period: null, error: '잘못된 조회 기간이라 오늘 기준으로 표시합니다.' }
  if (from === null || to === null) return invalid
  const period = { from, to }
  return validatePeriod(period, now) === null ? { period, error: null } : invalid
}

export type PresetKey = 'today' | '7d' | '30d' | '60d' | '90d' | 'thisMonth' | 'lastMonth'

export const PERIOD_PRESETS: ReadonlyArray<{ key: PresetKey; label: string }> = [
  { key: 'today', label: '오늘' },
  { key: '7d', label: '최근 7일' },
  { key: '30d', label: '최근 30일' },
  { key: '60d', label: '최근 60일' },
  { key: '90d', label: '최근 90일' },
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
]

/** 프리셋 → 기간 ('today'는 쿼리 없는 오늘 모드라 제외) */
export function presetPeriod(key: Exclude<PresetKey, 'today'>, now: Date = new Date()): Period {
  const today = kstToday(now)
  const monthStart = today.slice(0, 8) + '01'
  switch (key) {
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case '60d':
      return { from: addDays(today, -59), to: today }
    case '90d':
      return { from: addDays(today, -89), to: today }
    case 'thisMonth':
      return { from: monthStart, to: today }
    case 'lastMonth': {
      const to = addDays(monthStart, -1)
      return { from: to.slice(0, 8) + '01', to }
    }
  }
}

const PERIOD_PATHS = ['/kpi', '/ai', '/cost']

/** 탭 이동 시 유지할 쿼리. 기간 대상 경로만 from/to를 이어간다 */
export function navSearch(targetPath: string, currentSearch: string): string {
  if (!PERIOD_PATHS.includes(targetPath)) return ''
  const src = new URLSearchParams(currentSearch)
  const out = new URLSearchParams()
  const from = src.get('from')
  const to = src.get('to')
  if (from !== null) out.set('from', from)
  if (to !== null) out.set('to', to)
  const s = out.toString()
  return s ? '?' + s : ''
}
