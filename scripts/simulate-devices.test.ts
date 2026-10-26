import { describe, it, expect } from 'vitest';
import {
  DEVICES,
  buildMinute,
  classifyResponse,
  parseArgs,
  toKstIso,
} from './simulate-devices.ts';

describe('simulate-devices', () => {
  it.each([0, 0.5, 0.999])('buildMinute: rand=%s 일 때 6건, 코드 집합 = DEVICES', (r) => {
    const out = buildMinute(new Date('2026-11-02T01:30:00Z'), () => r);
    expect(out).toHaveLength(6);
    expect(out.map((o) => o.code).sort()).toEqual(DEVICES.map((d) => d.code).sort());
  });

  it.each([0, 0.5, 0.999])('비전 total = good + defect + unknown (rand=%s)', (r) => {
    const out = buildMinute(new Date('2026-11-02T01:30:00Z'), () => r);
    const m = (out.find((o) => o.code === 'vision_01')!.body as { metrics: Record<string, number> }).metrics;
    expect(m.total_inspected).toBe(m.good_count + m.defect_count + m.unknown_count);
    expect(m.good_count).toBeGreaterThanOrEqual(0);
    expect(m.defect_count).toBeGreaterThanOrEqual(0);
  });

  it.each([0, 0.5, 0.999])('포장 runtime 55~60 정수, output_count >= 0 (rand=%s)', (r) => {
    const out = buildMinute(new Date('2026-11-02T01:30:00Z'), () => r);
    const pk = (out.find((o) => o.code === 'packaging_01')!.body as { metrics: Record<string, number> }).metrics;
    expect(Number.isInteger(pk.runtime_seconds)).toBe(true);
    expect(pk.runtime_seconds).toBeGreaterThanOrEqual(55);
    expect(pk.runtime_seconds).toBeLessThanOrEqual(60);
    for (const o of out) {
      const mm = (o.body as { metrics: Record<string, number> }).metrics;
      if ('output_count' in mm) expect(mm.output_count).toBeGreaterThanOrEqual(0);
    }
  });

  it('비전 total은 포장 출력과 같다', () => {
    const out = buildMinute(new Date('2026-11-02T01:30:00Z'), () => 0.5);
    const pk = (out.find((o) => o.code === 'packaging_01')!.body as { metrics: Record<string, number> }).metrics;
    const vi = (out.find((o) => o.code === 'vision_01')!.body as { metrics: Record<string, number> }).metrics;
    expect(vi.total_inspected).toBe(pk.output_count);
  });

  it('toKstIso: 분 단위로 내린 KST ISO', () => {
    expect(toKstIso(new Date('2026-11-02T01:30:45Z'))).toBe('2026-11-02T10:30:00+09:00');
  });

  it('classifyResponse', () => {
    expect(classifyResponse(200, { ok: true, duplicate: true })).toBe('duplicate');
    expect(classifyResponse(200, { ok: true })).toBe('ok');
    expect(classifyResponse(401, { error: 'invalid_api_key' })).toBe('error');
  });

  it('parseArgs', () => {
    expect(parseArgs(['--backfill', '6', '--offline', 'taper_01'])).toEqual({
      mode: 'backfill',
      hours: 6,
      offline: ['taper_01'],
    });
    expect(parseArgs([]).mode).toBe('live');
  });
});
