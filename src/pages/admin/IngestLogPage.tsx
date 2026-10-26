import { useState } from 'react';
import { useIngestLogs, fetchIngestLogsForExport, PAGE_SIZE } from '../../hooks/useIngestLogs';
import type { IngestLogRow } from '../../hooks/useIngestLogs';
import { useDevices } from '../../hooks/useAdminDevices';
import { IngestSpecGuide } from '../../components/admin/IngestSpecGuide';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { Select } from '../../components/common/Select';
import { TextInput } from '../../components/common/FormField';
import { toast } from '../../lib/toast';
import { toCsv } from '../../utils/csv';
import { formatKst } from '../../utils/datetime';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'success', label: 'success' },
  { value: 'duplicate', label: 'duplicate' },
  { value: 'error', label: '오류만' },
];

const NO_RAW = '(원본 미저장 — 2026-10-26 이전 수신)';

// raw_body JSON에서 bucket_at 추출 (실패 시 빈 값)
function bucketAt(body: string | null): string {
  if (!body) return '';
  try {
    const v = JSON.parse(body)?.bucket_at;
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

function prettyJson(body: string): string | null {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return null;
  }
}

function statusVariant(s: string): 'ok' | 'info' | 'danger' {
  return s === 'success' ? 'ok' : s === 'duplicate' ? 'info' : 'danger';
}

const ymd = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');

export function IngestLogPage() {
  const [deviceCode, setDeviceCode] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selected, setSelected] = useState<IngestLogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const filter = {
    deviceCode: deviceCode || undefined,
    status: status || undefined,
    date: date || undefined,
    page,
  };
  const { data, isLoading } = useIngestLogs(filter, { autoRefresh });
  const { data: devices = [] } = useDevices();
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  // 필터를 바꾸면 첫 페이지로
  const onFilter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(0);
  };

  async function onExport() {
    setExporting(true);
    try {
      const { rows: all, truncated } = await fetchIngestLogsForExport({
        deviceCode: filter.deviceCode,
        status: filter.status,
        date: filter.date,
      });
      const csv = toCsv(
        all.map((r) => ({
          kst: formatKst(r.received_at),
          device: r.device_code ?? '',
          status: r.status,
          bucket: bucketAt(r.raw_body),
          raw: r.raw_body ?? '',
          error: r.error_message ?? '',
        })),
        [
          { key: 'kst', header: '수신시각(KST)' },
          { key: 'device', header: '장비' },
          { key: 'status', header: '상태' },
          { key: 'bucket', header: 'bucket_at' },
          { key: 'raw', header: '원본' },
          { key: 'error', header: '오류' },
        ],
      );
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ingest-logs-${ymd()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (truncated) toast.error('10,000건 상한으로 일부만 내보냈습니다. 필터를 좁혀 주세요.');
    } catch (e: unknown) {
      toast.error(`CSV 내보내기 실패: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  async function copyRaw(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('복사됨');
    } catch {
      toast.error('복사 실패: 브라우저 권한을 확인하세요.');
    }
  }

  const columns: Column<IngestLogRow>[] = [
    { key: 'at', header: '수신 시각', render: (r) => formatKst(r.received_at) },
    { key: 'dev', header: '장비', render: (r) => r.device_code ?? '—' },
    { key: 'st', header: '상태', render: (r) => <Pill variant={statusVariant(r.status)}>{r.status}</Pill> },
    {
      key: 'raw',
      header: '원본',
      render: (r) => (
        <span className="font-mono block w-[120ch] max-w-[60vw] md:max-w-[40vw] truncate" title={r.raw_body ?? undefined}>
          {r.raw_body ?? '—'}
        </span>
      ),
    },
    { key: 'err', header: '오류', render: (r) => r.error_message ?? '' },
  ];

  const pretty = selected?.raw_body ? prettyJson(selected.raw_body) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-text">수신 원본 데이터</h1>
      <IngestSpecGuide baseUrl={import.meta.env.VITE_SUPABASE_URL ?? ''} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-text-dim w-40">
          장비
          <Select
            aria-label="장비"
            value={deviceCode}
            onChange={(e) => onFilter(setDeviceCode)(e.target.value)}
            options={[{ value: '', label: '전체' }, ...devices.map((d) => ({ value: d.code, label: `${d.name} (${d.code})` }))]}
          />
        </label>
        <label className="text-[11px] text-text-dim w-36">
          상태
          <Select
            aria-label="상태"
            value={status}
            onChange={(e) => onFilter(setStatus)(e.target.value)}
            options={STATUS_OPTIONS}
          />
        </label>
        <label className="text-[11px] text-text-dim w-40">
          날짜(KST)
          <TextInput type="date" aria-label="날짜" value={date} onChange={(e) => onFilter(setDate)(e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          자동 새로고침(5초)
        </label>
        <Button variant="secondary" onClick={onExport} disabled={exporting}>
          {exporting ? '내보내는 중...' : 'CSV 다운로드'}
        </Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} onRowClick={setSelected} empty="수신 기록이 없습니다." />

      <div className="flex items-center justify-end gap-3 text-xs text-text-dim">
        <span>총 {total}건</span>
        <Button variant="secondary" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>이전</Button>
        <span>{page + 1} / {lastPage + 1}</span>
        <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>다음</Button>
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="수신 원문"
        footer={
          selected?.raw_body ? (
            <Button variant="secondary" onClick={() => copyRaw(selected.raw_body as string)}>원문 복사</Button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-2 text-xs">
            <div>Content-Type: {selected.content_type ?? '—'}</div>
            {selected.raw_body === null ? (
              <div className="text-text-muted">{NO_RAW}</div>
            ) : (
              <>
                <div className="font-medium">원문</div>
                <pre className="bg-surface2 border border-border rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">{selected.raw_body}</pre>
                {pretty !== null && (
                  <>
                    <div className="font-medium">정렬된 JSON</div>
                    <pre className="bg-surface2 border border-border rounded p-2 overflow-auto max-h-60">{pretty}</pre>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
