import { describe, it, expect } from 'vitest'
import {
  kstToday,
  addDays,
  periodDays,
  validatePeriod,
  parsePeriodParams,
  presetPeriod,
  navSearch,
  PERIOD_PRESETS,
} from './period'

// KST 2026-10-28 00:30
const NOW = new Date('2026-10-27T15:30:00Z')

describe('kstToday / addDays / periodDays', () => {
  it('KST 기준 오늘을 반환한다', () => {
    expect(kstToday(NOW)).toBe('2026-10-28')
  })
  it('addDays는 월·연 경계를 넘는다', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('periodDays는 양 끝 포함 일수다', () => {
    expect(periodDays({ from: '2026-10-01', to: '2026-10-28' })).toBe(28)
  })
})

describe('presetPeriod', () => {
  it('7d / 90d', () => {
    expect(presetPeriod('7d', NOW)).toEqual({ from: '2026-10-22', to: '2026-10-28' })
    expect(presetPeriod('90d', NOW).from).toBe('2026-07-31')
  })
  it('thisMonth는 KST 월 경계를 따른다', () => {
    expect(presetPeriod('thisMonth', new Date('2026-10-31T16:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-01',
    })
  })
  it('lastMonth는 연 경계를 넘는다', () => {
    expect(presetPeriod('lastMonth', new Date('2026-01-15T03:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })
  it('프리셋 라벨', () => {
    expect(PERIOD_PRESETS.map((p) => p.label)).toEqual([
      '오늘', '최근 7일', '최근 30일', '최근 60일', '최근 90일', '이번 달', '지난 달',
    ])
  })
})

describe('validatePeriod', () => {
  it('형식 오류', () => {
    expect(validatePeriod({ from: '2026-13-40', to: '2026-10-01' }, NOW)).toBe('날짜 형식이 올바르지 않습니다.')
  })
  it('from > to', () => {
    expect(validatePeriod({ from: '2026-10-10', to: '2026-10-01' }, NOW)).toBe('시작일이 종료일보다 늦습니다.')
  })
  it('미래 to', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-29' }, NOW)).toBe('종료일은 오늘 이후일 수 없습니다.')
  })
  it('366일은 허용, 367일은 오류', () => {
    expect(validatePeriod({ from: '2025-10-28', to: '2026-10-28' }, NOW)).toBeNull()
    expect(validatePeriod({ from: '2025-10-27', to: '2026-10-28' }, NOW)).toBe('조회 기간은 최대 366일입니다.')
  })
  it('2020-01-01 이전', () => {
    expect(validatePeriod({ from: '2019-12-31', to: '2019-12-31' }, NOW)).toBe('시작일은 2020-01-01 이후여야 합니다.')
  })
  it('정상', () => {
    expect(validatePeriod({ from: '2026-10-01', to: '2026-10-28' }, NOW)).toBeNull()
  })
})

describe('parsePeriodParams', () => {
  const ERR = '잘못된 조회 기간이라 오늘 기준으로 표시합니다.'
  it('빈 쿼리', () => {
    expect(parsePeriodParams(new URLSearchParams(''), NOW)).toEqual({ period: null, error: null })
  })
  it('하나만 있으면 오류', () => {
    expect(parsePeriodParams(new URLSearchParams('from=2026-10-01'), NOW)).toEqual({ period: null, error: ERR })
  })
  it('유효하지 않으면 오류', () => {
    expect(parsePeriodParams(new URLSearchParams('from=2026-13-40&to=2026-10-01'), NOW)).toEqual({ period: null, error: ERR })
  })
  it('정상', () => {
    expect(parsePeriodParams(new URLSearchParams('from=2026-10-01&to=2026-10-28'), NOW)).toEqual({
      period: { from: '2026-10-01', to: '2026-10-28' },
      error: null,
    })
  })
})

describe('navSearch', () => {
  it('기간 대상 경로는 from/to만 유지', () => {
    expect(navSearch('/ai', '?from=2026-10-01&to=2026-10-28&x=1')).toBe('?from=2026-10-01&to=2026-10-28')
  })
  it('그 외 경로·빈 쿼리는 빈 문자열', () => {
    expect(navSearch('/lot', '?from=2026-10-01&to=2026-10-28')).toBe('')
    expect(navSearch('/ai', '')).toBe('')
  })
})
