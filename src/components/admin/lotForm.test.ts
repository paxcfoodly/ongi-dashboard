import { describe, it, expect } from 'vitest';
import { deriveLotStatus, lotTimeError, EMPTY_LOT_FORM } from './lotForm';
import type { LotFormState } from './lotForm';

// TZ는 vitest.config.ts 에서 Asia/Seoul 로 고정되어 있다 (datetime-local 은 로컬=KST 로 해석)
describe('deriveLotStatus — 시각으로 상태를 대칭적으로 도출', () => {
  it('completed 에서 종료 시각을 지우면 running', () => {
    expect(deriveLotStatus('completed', '2026-10-20T09:00:00Z', null)).toBe('running');
  });

  it('running 에서 시작 시각을 지우면(종료도 없음) planned', () => {
    expect(deriveLotStatus('running', null, null)).toBe('planned');
  });

  it('completed 에서 두 시각을 모두 지우면 planned', () => {
    expect(deriveLotStatus('completed', '', '')).toBe('planned');
  });

  it('planned 인데 두 시각이 모두 있으면(레거시 행) completed', () => {
    expect(deriveLotStatus('planned', '2026-10-20T09:00:00Z', '2026-10-20T18:00:00Z')).toBe(
      'completed',
    );
  });

  it('planned 에 시작만 있으면 running', () => {
    expect(deriveLotStatus('planned', '2026-10-20T09:00:00Z', null)).toBe('running');
  });

  it('이미 맞는 상태면 undefined (변경 없음)', () => {
    expect(deriveLotStatus('completed', 'a', 'b')).toBeUndefined();
    expect(deriveLotStatus('running', 'a', null)).toBeUndefined();
    expect(deriveLotStatus('planned', null, null)).toBeUndefined();
  });

  it('paused 는 두 시각이 모두 있을 때만 completed 로 바꾸고 그 외에는 그대로 둔다', () => {
    expect(deriveLotStatus('paused', 'a', null)).toBeUndefined();
    expect(deriveLotStatus('paused', null, null)).toBeUndefined();
    expect(deriveLotStatus('paused', 'a', 'b')).toBe('completed');
  });
});

describe('lotTimeError — 시각·출하일 검증', () => {
  // 기준 시각: 2026-10-26 12:00 KST
  const now = new Date('2026-10-26T03:00:00Z');
  const form = (patch: Partial<LotFormState>): LotFormState => ({ ...EMPTY_LOT_FORM, ...patch });

  it('시작 없이 종료만 입력하면 거부', () => {
    expect(lotTimeError(form({ ended_at: '2026-10-26T10:00' }), now)).toBe(
      '시작 시각 없이 종료 시각만 입력할 수 없습니다.',
    );
  });

  it('시작 시각이 지금+11분이면 거부, +5분이면 허용', () => {
    expect(lotTimeError(form({ started_at: '2026-10-26T12:11' }), now)).toBe(
      '시작 시각은 미래로 입력할 수 없습니다.',
    );
    expect(lotTimeError(form({ started_at: '2026-10-26T12:05' }), now)).toBeNull();
  });

  it('종료 시각이 지금+11분이면 거부, +5분이면 허용', () => {
    expect(
      lotTimeError(form({ started_at: '2026-10-26T08:00', ended_at: '2026-10-26T12:11' }), now),
    ).toBe('종료 시각은 미래로 입력할 수 없습니다.');
    expect(
      lotTimeError(form({ started_at: '2026-10-26T08:00', ended_at: '2026-10-26T12:05' }), now),
    ).toBeNull();
  });

  it('출하일은 KST 오늘까지 허용, 내일은 거부', () => {
    expect(lotTimeError(form({ shipped_at: '2026-10-26' }), now)).toBeNull();
    expect(lotTimeError(form({ shipped_at: '2026-10-27' }), now)).toBe(
      '출하일은 미래로 입력할 수 없습니다.',
    );
  });

  it('출하일 기준은 KST 날짜 — UTC로는 아직 전날인 KST 새벽에도 KST 오늘을 허용', () => {
    // 2026-10-27 01:00 KST = 2026-10-26 16:00 UTC
    const kstEarly = new Date('2026-10-26T16:00:00Z');
    expect(lotTimeError(form({ shipped_at: '2026-10-27' }), kstEarly)).toBeNull();
    expect(lotTimeError(form({ shipped_at: '2026-10-28' }), kstEarly)).toBe(
      '출하일은 미래로 입력할 수 없습니다.',
    );
  });
});
