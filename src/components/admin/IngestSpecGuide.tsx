import { useState } from 'react';
import { Button } from '../common/Button';
import { toast } from '../../lib/toast';

// 1분 버킷 1건 기준 현실적인 예시값 (total = good + defect + unknown 성립)
const VISION_JSON = `{
  "bucket_at": "2026-04-24T10:00:00+09:00",
  "metrics": {
    "total_inspected": 30,
    "good_count": 29,
    "defect_count": 0,
    "unknown_count": 1,
    "inspection_time_seconds": 55.2
  }
}`;

const EQUIPMENT_JSON = `{
  "bucket_at": "2026-04-24T10:00:00+09:00",
  "metrics": { "runtime_seconds": 58, "output_count": 30 }
}`;

// text/csv 본문: 1행 = 헤더(열 이름으로 매칭), 2행 = 값. 첫 데이터 행 1건만 처리
const VISION_CSV = `bucket_at,total_inspected,good_count,defect_count,unknown_count,inspection_time_seconds
2026-04-24T10:00:00+09:00,30,29,0,1,55.2`;

const EQUIPMENT_CSV = `bucket_at,runtime_seconds,output_count
2026-04-24T10:00:00+09:00,58,30`;

const NOTES: string[] = [
  '값은 해당 1분 동안의 증가분입니다 (누적값 아님).',
  'bucket_at = 그 분의 시작 시각(KST), 반드시 +09:00 오프셋 포함 (예: 10:00:00+09:00).',
  '장비 1대당 1분에 1회 전송합니다.',
  'runtime_seconds 는 0–60 사이 정수입니다.',
  '비전검사기는 total_inspected = good_count + defect_count + unknown_count 이어야 합니다.',
  '같은 버킷을 다시 보내면 200 duplicate 로 응답하며 중복 저장되지 않습니다.',
  'Content-Type: text/csv 도 허용합니다 (아래 CSV 예시 — 헤더 1행 + 값 1행).',
];

const HEADERS: [string, string][] = [
  ['Authorization', 'Bearer <공개 키> (Supabase 라우팅용)'],
  ['X-Device-Code', '장비 식별자 (예: packaging_01)'],
  ['X-Api-Key', '장비별 API 키 (장비 인증)'],
  ['Content-Type', 'application/json 또는 text/csv'],
];

const RESPONSES: [string, string][] = [
  ['200', '{ "ok": true, "ingested_at": "..." } — 정상 수신'],
  ['200 duplicate', '{ "ok": true, "duplicate": true } — 같은 버킷 재전송(멱등)'],
  ['400', '스키마/파싱 오류'],
  ['401', 'API 키 불일치'],
  ['404', 'device_code 미등록 또는 비활성'],
  ['500', '내부 오류'],
];

// 클립보드 복사 (실패 시 토스트)
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('복사됨');
  } catch {
    toast.error('복사 실패: 브라우저 권한을 확인하세요.');
  }
}

function CodeBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-text-dim">{label}</span>
        <Button variant="secondary" onClick={() => copy(text)}>복사</Button>
      </div>
      <pre className="bg-surface2 border border-border rounded p-2 text-[11px] overflow-x-auto">{text}</pre>
    </div>
  );
}

export function IngestSpecGuide({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = useState(true);
  const endpoint = `POST ${baseUrl}/functions/v1/ingest`;
  return (
    <section className="border border-border rounded-lg bg-surface">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="ingest-spec-guide-body"
      >
        <h2 className="text-sm font-semibold text-text">전송 규격 안내</h2>
        <span className="text-xs text-text-dim">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && (
        <div id="ingest-spec-guide-body" className="px-4 pb-4 space-y-4">
          <CodeBlock label="엔드포인트" text={endpoint} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead className="bg-surface2">
                <tr>
                  <th scope="col" className="text-left px-2 py-1.5">헤더</th>
                  <th scope="col" className="text-left px-2 py-1.5">값</th>
                </tr>
              </thead>
              <tbody>
                {HEADERS.map(([k, v]) => (
                  <tr key={k} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{k}</td>
                    <td className="px-2 py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc pl-5 text-sm text-text-dim space-y-0.5">
            {NOTES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <CodeBlock label="비전검사기 본문 예시" text={VISION_JSON} />
          <CodeBlock label="일반 장비 본문 예시" text={EQUIPMENT_JSON} />
          <CodeBlock label="비전검사기 CSV 예시 (text/csv)" text={VISION_CSV} />
          <CodeBlock label="일반 장비 CSV 예시 (text/csv)" text={EQUIPMENT_CSV} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead className="bg-surface2">
                <tr>
                  <th scope="col" className="text-left px-2 py-1.5">응답 코드</th>
                  <th scope="col" className="text-left px-2 py-1.5">의미</th>
                </tr>
              </thead>
              <tbody>
                {RESPONSES.map(([k, v]) => (
                  <tr key={k} className="border-t border-border">
                    <td className="px-2 py-1.5 font-mono">{k}</td>
                    <td className="px-2 py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
