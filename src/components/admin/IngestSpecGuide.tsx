import { useState } from 'react';
import { Button } from '../common/Button';
import { toast } from '../../lib/toast';

const VISION_JSON = `{
  "bucket_at": "2026-04-24T10:00:00+09:00",
  "metrics": {
    "total_inspected": 100,
    "good_count": 95,
    "defect_count": 3,
    "unknown_count": 2,
    "inspection_time_seconds": 58.4
  }
}`;

const EQUIPMENT_JSON = `{
  "bucket_at": "2026-04-24T10:00:00+09:00",
  "metrics": { "runtime_seconds": 58, "output_count": 1850 }
}`;

const HEADERS: [string, string][] = [
  ['Authorization', 'Bearer <공개 키> (Supabase 라우팅용)'],
  ['X-Device-Code', '장비 식별자 (예: packaging_01)'],
  ['X-Api-Key', '장비별 API 키 (장비 인증)'],
  ['Content-Type', 'application/json'],
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
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2 className="text-sm font-semibold text-text">전송 규격 안내</h2>
        <span className="text-xs text-text-dim">{open ? '접기' : '펼치기'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          <CodeBlock label="엔드포인트" text={endpoint} />
          <table className="w-full text-xs border border-border">
            <thead className="bg-surface2">
              <tr>
                <th className="text-left px-2 py-1.5">헤더</th>
                <th className="text-left px-2 py-1.5">값</th>
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
          <CodeBlock label="비전검사기 본문 예시" text={VISION_JSON} />
          <CodeBlock label="일반 장비 본문 예시" text={EQUIPMENT_JSON} />
          <table className="w-full text-xs border border-border">
            <thead className="bg-surface2">
              <tr>
                <th className="text-left px-2 py-1.5">응답 코드</th>
                <th className="text-left px-2 py-1.5">의미</th>
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
      )}
    </section>
  );
}
