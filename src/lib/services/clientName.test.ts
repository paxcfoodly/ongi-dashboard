import { describe, it, expect } from 'vitest';
import { findClientByName, normalizeClientName } from './clientName';

const clients = [
  { id: 'c1', name: '삼성웰스토리' },
  { id: 'c2', name: 'CJ프레시웨이' },
];

describe('normalizeClientName', () => {
  it('앞뒤 공백을 지우고 연속 공백을 하나로 줄인다', () => {
    expect(normalizeClientName('  온기   식품 ')).toBe('온기 식품');
  });
});

describe('findClientByName', () => {
  it('이름이 같으면 기존 납품처를 찾는다', () => {
    expect(findClientByName(clients, '삼성웰스토리')?.id).toBe('c1');
  });

  it('띄어쓰기와 영문 대소문자가 달라도 같은 납품처로 본다', () => {
    expect(findClientByName(clients, '삼성 웰스토리')?.id).toBe('c1');
    expect(findClientByName(clients, 'cj프레시웨이')?.id).toBe('c2');
  });

  it('없는 이름이면 undefined를 돌려준다', () => {
    expect(findClientByName(clients, '새 납품처')).toBeUndefined();
  });
});
