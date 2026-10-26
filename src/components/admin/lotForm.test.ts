import { describe, it, expect } from 'vitest';
import { deriveLotStatus, lotTimeError, lotEndError, EMPTY_LOT_FORM } from './lotForm';
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

  it('2020-01-01 이전 날짜(연도 오타)는 필드별로 거부, 2020-01-01 은 허용', () => {
    expect(lotTimeError(form({ started_at: '0026-10-20T09:00' }), now)).toBe(
      '시작 시각은 2020-01-01 이후로 입력해야 합니다.',
    );
    expect(
      lotTimeError(form({ started_at: '2019-12-31T23:59', ended_at: '2026-10-20T09:00' }), now),
    ).toBe('시작 시각은 2020-01-01 이후로 입력해야 합니다.');
    expect(lotTimeError(form({ ordered_at: '0026-10-20' }), now)).toBe(
      '수주일은 2020-01-01 이후로 입력해야 합니다.',
    );
    expect(lotTimeError(form({ shipped_at: '2019-12-31' }), now)).toBe(
      '출하일은 2020-01-01 이후로 입력해야 합니다.',
    );
    expect(
      lotTimeError(form({ started_at: '2020-01-01T00:00', ordered_at: '2020-01-01' }), now),
    ).toBeNull();
  });

  it('종료 시각이 2020-01-01 이전이면 거부', () => {
    // 시작보다 앞선 종료도 DB 제약에 걸리지만, 하한 문구가 먼저 나와야 오타를 바로 알 수 있다
    expect(
      lotTimeError(form({ started_at: '2026-10-20T09:00', ended_at: '0026-10-20T18:00' }), now),
    ).toBe('종료 시각은 2020-01-01 이후로 입력해야 합니다.');
  });

  it('작업 기간(종료−시작)은 31일까지 허용, 초과하면 거부', () => {
    expect(
      lotTimeError(form({ started_at: '2026-09-25T09:00', ended_at: '2026-10-26T09:00' }), now),
    ).toBeNull();
    expect(
      lotTimeError(form({ started_at: '2026-09-25T09:00', ended_at: '2026-10-26T09:01' }), now),
    ).toBe('작업 기간(시작~종료)은 31일을 넘을 수 없습니다.');
  });

  it('리드타임(출하일−수주일)은 366일까지 허용, 초과하면 거부', () => {
    expect(lotTimeError(form({ ordered_at: '2025-10-25', shipped_at: '2026-10-26' }), now)).toBeNull();
    expect(lotTimeError(form({ ordered_at: '2025-10-24', shipped_at: '2026-10-26' }), now)).toBe(
      '리드타임(수주일~출하일)은 366일을 넘을 수 없습니다.',
    );
  });
});

describe('lotEndError — [종료] 버튼 사전 검증', () => {
  // 기준 시각: 2026-10-26 12:00 KST
  const now = new Date('2026-10-26T03:00:00Z');

  it('시작 후 31일 이내면 종료 허용', () => {
    expect(lotEndError('2026-09-25T03:00:00Z', now)).toBeNull();
  });

  it('시작 후 31일을 넘기면 DB 제약 대신 안내 문구로 거부', () => {
    expect(lotEndError('2026-09-25T02:59:00Z', now)).toBe(
      '작업 기간이 31일을 넘어 종료할 수 없습니다. 편집에서 실제 시작·종료 시각을 입력하세요.',
    );
  });

  it('시작 시각이 없으면 검사하지 않음', () => {
    expect(lotEndError(null, now)).toBeNull();
  });
});
