import { describe, it, expect } from 'vitest';
import {
  computeLiveState,
  buildPacketFeed,
  minuteSeries,
  latestByBucket,
  toKstTime,
  agoLabel,
  type LiveEquipmentRow,
  type LiveVisionRow,
} from './liveStatus';

const NOW = Date.parse('2026-11-03T05:30:00Z');
const secAgo = (s: number) => new Date(NOW - s * 1000).toISOString();

const equip = (over: Partial<LiveEquipmentRow> = {}): LiveEquipmentRow => ({
  id: 1, device_id: 'p', bucket_at: '2026-11-03T05:28:00Z', created_at: '2026-11-03T05:29:02Z',
  runtime_seconds: 58, output_count: 30, ...over,
});
const vision = (over: Partial<LiveVisionRow> = {}): LiveVisionRow => ({
  id: 2, device_id: 'v', bucket_at: '2026-11-03T05:28:00Z', created_at: '2026-11-03T05:29:04Z',
  total_inspected: 30, good_count: 28, defect_count: 1, unknown_count: 1, ...over,
});

describe('computeLiveState — 통신과 가동을 분리해 판정', () => {
  it('패킷이 오고 생산이 있으면 가동중', () => {
    expect(computeLiveState(secAgo(30), true, NOW)).toMatchObject({ key: 'run', label: '가동중' });
  });
  it('패킷은 오는데 생산이 0이면 대기 (가동중으로 표시하지 않음)', () => {
    expect(computeLiveState(secAgo(30), false, NOW)).toMatchObject({ key: 'idle', label: '대기' });
  });
  it('2분 경계: 정확히 2분은 정상, 초과하면 수신 지연', () => {
    expect(computeLiveState(secAgo(120), true, NOW).key).toBe('run');
    expect(computeLiveState(secAgo(121), true, NOW)).toMatchObject({ key: 'delay', label: '수신 지연' });
  });
  it('5분 경계: 정확히 5분은 지연, 초과하면 통신 끊김', () => {
    expect(computeLiveState(secAgo(300), true, NOW).key).toBe('delay');
    expect(computeLiveState(secAgo(301), true, NOW)).toMatchObject({ key: 'off', label: '통신 끊김' });
  });
  it('생산 0이어도 패킷이 끊기면 통신 문제를 우선 표시', () => {
    expect(computeLiveState(secAgo(301), false, NOW).key).toBe('off');
  });
  it('수신 기록이 없거나 시각을 해석할 수 없으면 통신 끊김', () => {
    expect(computeLiveState(null, null, NOW).key).toBe('off');
    expect(computeLiveState('잘못된 값', true, NOW).key).toBe('off');
  });
});

describe('latestByBucket', () => {
  it('늦게 도착한 과거 데이터가 아니라 데이터 시각이 가장 최근인 행을 고른다', () => {
    const rows = [
      equip({ id: 1, bucket_at: '2026-11-03T05:10:00Z', created_at: '2026-11-03T05:29:50Z' }),
      equip({ id: 2, bucket_at: '2026-11-03T05:28:00Z', created_at: '2026-11-03T05:29:02Z' }),
    ];
    expect(latestByBucket(rows)?.id).toBe(2);
    expect(latestByBucket([])).toBeNull();
  });
});

describe('buildPacketFeed', () => {
  it('두 장비 패킷을 수신 시각 최신순으로 합치고 필요한 값만 남긴다', () => {
    const feed = buildPacketFeed([equip()], [vision()], 30);
    expect(feed.map((p) => p.kind)).toEqual(['vision', 'equipment']);
    expect(feed[0]).toMatchObject({ receivedAt: '2026-11-03T05:29:04Z', total: 30, good: 28, defect: 1, unknown: 1 });
    expect(feed[1]).toMatchObject({ receivedAt: '2026-11-03T05:29:02Z', output: 30, runtime: 58 });
  });
  it('개수를 제한하고, 두 테이블의 id가 같아도 key가 겹치지 않는다', () => {
    const feed = buildPacketFeed(
      [equip({ id: 7 }), equip({ id: 8, created_at: '2026-11-03T05:20:00Z' })],
      [vision({ id: 7 })],
      2,
    );
    expect(feed).toHaveLength(2);
    expect(new Set(feed.map((p) => p.key)).size).toBe(2);
  });
});

describe('minuteSeries', () => {
  it('최근 N분을 빠짐없이 만들고 없는 분은 null로 둔다', () => {
    const s = minuteSeries([equip({ bucket_at: '2026-11-03T05:28:00Z', output_count: 25 })], NOW, 3);
    // 현재 14:30 KST → 14:27, 14:28, 14:29
    expect(s.map((p) => p.label)).toEqual(['14:27', '14:28', '14:29']);
    expect(s.map((p) => p.output)).toEqual([null, 25, null]);
  });
  it('같은 분의 값은 합산하지 않고 수신값(유일 제약)을 그대로 쓰며 0은 0으로 유지한다', () => {
    const s = minuteSeries([equip({ bucket_at: '2026-11-03T05:29:00Z', output_count: 0 })], NOW, 1);
    expect(s).toEqual([{ label: '14:29', output: 0 }]);
  });
});

describe('표시 형식', () => {
  it('toKstTime은 한국시각 시:분:초', () => {
    expect(toKstTime('2026-11-02T15:00:05Z')).toBe('00:00:05');
  });
  it('agoLabel은 초·분 단위, 미래 시각은 0초로', () => {
    expect(agoLabel(secAgo(10), NOW)).toBe('10초 전');
    expect(agoLabel(secAgo(125), NOW)).toBe('2분 05초 전');
    expect(agoLabel(secAgo(-30), NOW)).toBe('0초 전');
    expect(agoLabel(null, NOW)).toBe('수신 기록 없음');
  });
});
