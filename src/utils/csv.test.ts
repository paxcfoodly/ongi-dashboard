import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

const cols = [
  { key: 'a', header: '가' },
  { key: 'b', header: '나' },
];

describe('toCsv', () => {
  it('BOM으로 시작하고 \\r\\n으로 행을 구분한다', () => {
    const out = toCsv([{ a: '1', b: '2' }, { a: '3', b: '4' }], cols);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.slice(1)).toBe('가,나\r\n1,2\r\n3,4');
  });

  it('쉼표·따옴표·개행 셀은 따옴표로 감싸고 따옴표는 두 번 쓴다', () => {
    const out = toCsv([{ a: 'x,y', b: 'say "hi"\nbye' }], cols);
    expect(out.slice(1)).toBe('가,나\r\n"x,y","say ""hi""\nbye"');
  });

  it('null/undefined는 빈 셀, 숫자는 문자열로 변환한다', () => {
    const out = toCsv([{ a: null, b: 5 }], cols);
    expect(out.slice(1)).toBe('가,나\r\n,5');
  });
});
