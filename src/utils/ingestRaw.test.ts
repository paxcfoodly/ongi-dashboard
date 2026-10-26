import { describe, it, expect } from 'vitest';
import { bucketAt } from './ingestRaw';

describe('bucketAt (수신 로그 원본에서 bucket_at 추출)', () => {
  it('JSON 본문에서 bucket_at을 꺼낸다', () => {
    expect(bucketAt('{"bucket_at":"2026-10-26T09:00:00+09:00","metrics":{}}', 'application/json')).toBe(
      '2026-10-26T09:00:00+09:00',
    );
  });

  it('text/csv 본문이면 헤더 인덱스로 첫 데이터 행의 bucket_at을 꺼낸다', () => {
    const csv = 'runtime_seconds,bucket_at,output_count\r\n3600,2026-10-26T10:00:00+09:00,1200\n';
    expect(bucketAt(csv, 'text/csv; charset=utf-8')).toBe('2026-10-26T10:00:00+09:00');
  });

  it('content_type이 없어도 헤더에 bucket_at이 있는 CSV면 추출한다', () => {
    const csv = 'bucket_at,total_inspected\n2026-10-26T11:00:00+09:00,100';
    expect(bucketAt(csv, null)).toBe('2026-10-26T11:00:00+09:00');
  });

  it('본문이 없거나 해석할 수 없으면 빈 값', () => {
    expect(bucketAt(null, null)).toBe('');
    expect(bucketAt('not json', 'application/json')).toBe('');
    expect(bucketAt('bucket_at\n', 'text/csv')).toBe('');
  });
});
