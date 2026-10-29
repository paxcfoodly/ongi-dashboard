import { describe, it, expect } from 'vitest';
import { describeKeyCheck, type DeviceKeyCheckResult } from './deviceKeyCheck';

const base: DeviceKeyCheckResult = {
  key_registered: true,
  match: false,
  match_after_cleanup: false,
  length: 48,
  clean_length: 48,
  has_whitespace: false,
  has_bearer: false,
  has_quotes: false,
  prefix: 'ab12',
  registered_prefix: 'ab12',
};

describe('describeKeyCheck', () => {
  it('미발급 장비', () => {
    const d = describeKeyCheck({ ...base, key_registered: false });
    expect(d.verdict).toBe('unregistered');
    expect(d.title).toContain('발급되지 않았');
  });

  it('정확히 일치', () => {
    const d = describeKeyCheck({ ...base, match: true, match_after_cleanup: true });
    expect(d.verdict).toBe('match');
    expect(d.title).toContain('일치');
    // 키가 맞는데도 실패하면 장비 코드를 의심하도록 안내
    expect(d.details.join(' ')).toContain('X-Device-Code');
  });

  it('정리하면 일치: 섞인 문자를 모두 짚어 준다', () => {
    const d = describeKeyCheck({
      ...base, match_after_cleanup: true, has_whitespace: true, has_bearer: true, has_quotes: true, length: 57,
    });
    expect(d.verdict).toBe('match_after_cleanup');
    const text = d.details.join(' ');
    expect(text).toContain('공백');
    expect(text).toContain('Bearer');
    expect(text).toContain('따옴표');
  });

  it('불일치 + 앞자리 다름 → 다른(이전) 키', () => {
    const d = describeKeyCheck({ ...base, prefix: 'ff00' });
    expect(d.verdict).toBe('mismatch');
    const text = d.details.join(' ');
    expect(text).toContain("'ff00'");
    expect(text).toContain("'ab12'");
    expect(text).toContain('다른 키');
  });

  it('불일치 + 앞자리 같음 → 중간·끝 복사 오류', () => {
    const d = describeKeyCheck({ ...base });
    expect(d.details.join(' ')).toContain('중간이나 끝');
  });

  it('불일치 + 길이 다름 → 일부만 복사', () => {
    const d = describeKeyCheck({ ...base, prefix: 'ab12', length: 40, clean_length: 40 });
    expect(d.details.join(' ')).toContain('48자리');
    expect(d.details.join(' ')).toContain('40자리');
  });

  it('등록된 키 앞자리 기록이 없으면 그렇게 알려 준다', () => {
    const d = describeKeyCheck({ ...base, prefix: 'ff00', registered_prefix: null });
    expect(d.details.join(' ')).toContain('기록 없음');
  });
});
