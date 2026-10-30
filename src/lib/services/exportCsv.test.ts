import { describe, it, expect } from 'vitest';
import {
  toNumericCell,
  toKstMinute,
  dailyTableCsv,
  rawEquipmentCsv,
  rawVisionCsv,
  lotManhourCsv,
  lotLeadtimeCsv,
  RAW_EXPORT_MAX_DAYS,
} from './exportCsv';

const BOM = '﻿';
const lines = (csv: string) => csv.replace(BOM, '').split('\r\n');

describe('toNumericCell — 화면 표시값을 엑셀 숫자로', () => {
  it.each([
    ['1,864', '1864'],
    ['1.93 s', '1.93'],
    ['12.5%', '12.5'],
    ['1,738 ea/hr', '1738'],
    ['-3.2', '-3.2'],
    ['—', ''],
    ['-', ''],
    ['', ''],
    ['달성', '달성'],
  ])('%s → %s', (input, out) => {
    expect(toNumericCell(input)).toBe(out);
  });
});

describe('toKstMinute', () => {
  it('UTC 시각을 한국시각 분 단위 문자열로', () => {
    expect(toKstMinute('2026-10-29T03:05:00+00:00')).toBe('2026-10-29 12:05');
    // 자정 경계: UTC 15:00 = 다음날 00:00 KST
    expect(toKstMinute('2026-10-28T15:00:00Z')).toBe('2026-10-29 00:00');
  });
});

describe('dailyTableCsv', () => {
  const rows = [{ day: '2026-10-01' }, { day: '2026-10-02' }];
  const columns = [
    { header: '생산수량', agg: 'sum' as const, cell: (r: { day: string }) => (r.day.endsWith('1') ? '1,000' : '2,000'), total: '3,000' },
    { header: '시간당 생산량', agg: 'avg' as const, cell: () => '1,864', total: '1,800' },
    { header: '일 목표 달성률', agg: 'none' as const, cell: () => '95.0%', total: '—' },
  ];

  it('BOM + 날짜 열 + 날짜별 행 + 합계·평균 행', () => {
    const csv = dailyTableCsv(rows, columns);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(lines(csv)).toEqual([
      '날짜,생산수량,시간당 생산량,일 목표 달성률',
      '2026-10-01,1000,1864,95.0',
      '2026-10-02,2000,1864,95.0',
      '기간 합계·평균,3000,1800,',
    ]);
  });
});

describe('원데이터 CSV', () => {
  it('설비 분 단위: 한국시각·장비·가동·생산', () => {
    const csv = rawEquipmentCsv([
      { bucket_at: '2026-10-29T03:05:00+00:00', runtime_seconds: 58, output_count: 28, devices: { code: 'packaging_01', name: '삼면포장기' } },
    ]);
    expect(lines(csv)).toEqual([
      '시각(KST),장비코드,장비명,가동시간(초),생산수량(ea)',
      '2026-10-29 12:05,packaging_01,삼면포장기,58,28',
    ]);
  });

  it('AI 비전 분 단위: 검사 결과 숫자 칸', () => {
    const csv = rawVisionCsv([
      {
        bucket_at: '2026-10-29T03:05:00+00:00', total_inspected: 30, good_count: 28, defect_count: 1,
        unknown_count: 1, inspection_time_seconds: '55.50', devices: { code: 'vision_01', name: 'AI 비전검사기' },
      },
    ]);
    expect(lines(csv)[1]).toBe('2026-10-29 12:05,vision_01,AI 비전검사기,30,28,1,1,55.5');
  });

  it('원데이터는 31일까지', () => {
    expect(RAW_EXPORT_MAX_DAYS).toBe(31);
  });
});

describe('LOT CSV', () => {
  it('작업공수: 시작·종료는 한국시각, 숫자 칸 유지', () => {
    const csv = lotManhourCsv([
      {
        lot_no: 'L-1', started_at: '2026-10-01T00:00:00Z', ended_at: '2026-10-01T08:00:00Z',
        work_hours: 8, worker_count: 2, man_hour: 16,
      },
    ]);
    expect(lines(csv)).toEqual([
      'LOT번호,시작(KST),종료(KST),작업시간(h),투입인원,man-hour',
      'L-1,2026-10-01 09:00,2026-10-01 17:00,8,2,16',
    ]);
  });

  it('리드타임: 날짜와 일수', () => {
    const csv = lotLeadtimeCsv([{ lot_no: 'L-1', ordered_at: '2026-10-01', shipped_at: '2026-10-13', lead_days: 12 }]);
    expect(lines(csv)).toEqual(['LOT번호,수주일,출하일,리드타임(일)', 'L-1,2026-10-01,2026-10-13,12']);
  });
});
