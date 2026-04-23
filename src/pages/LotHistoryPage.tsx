import { useState } from 'react';
import { useLots } from '../hooks/useLots';
import type { LotSummary } from '../hooks/useLots';
import { useGeneratePdf } from '../hooks/usePdfReport';
import { toast } from '../lib/toast';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { Pill } from '../components/common/Pill';
import { fmt } from '../utils/formatting';

const columns: Column<LotSummary>[] = [
  { key: 'lot_no',     header: 'LOT번호',  render: (r) => <span className="font-mono text-xs">{r.lot_no}</span> },
  { key: 'started_at', header: '생산일시', render: (r) => r.started_at ? new Date(r.started_at).toLocaleString('ko-KR') : '-' },
  { key: 'client',     header: '납품처',   render: (r) => r.client_name },
  { key: 'target',     header: '목표수량', align: 'right', render: (r) => r.target_quantity != null ? fmt.int(r.target_quantity) : '-' },
  { key: 'inspected',  header: '검사수량', align: 'right', render: (r) => fmt.int(r.inspected) },
  { key: 'defect',     header: '불량수',   align: 'right', render: (r) => fmt.int(r.defect_count) },
  { key: 'rate',       header: '불량률',   align: 'right', render: (r) => fmt.pct(r.defect_rate_pct, 2) },
  {
    key: 'judgment', header: '판정', align: 'center',
    render: (r) =>
      r.judgment === '정상' ? <Pill variant="ok">정상</Pill> :
      r.judgment === '주의' ? <Pill variant="warn">주의</Pill> :
      r.judgment === '불합격' ? <Pill variant="danger">불합격</Pill> :
      <span className="text-text-muted text-xs">{r.judgment}</span>
  },
];

export function LotHistoryPage() {
  const [search, setSearch]       = useState('');
  const [clientName, setClient]   = useState('');
  const [judgment, setJudgment]   = useState('');
  const [date, setDate]           = useState('');
  const [selected, setSelected]   = useState<LotSummary | null>(null);

  const { data: rows = [], isLoading } = useLots({ search, clientName, judgment, date });

  const pdfMut = useGeneratePdf();

  async function generatePdfFor(lotId: string) {
    toast.info('PDF 생성 중…');
    try {
      const res = await pdfMut.mutateAsync({ type: 'lot_report', id: lotId });
      if (res.ok && res.url) {
        window.open(res.url, '_blank');
        toast.success('PDF 생성됨');
      } else {
        toast.error(`PDF 생성 실패: ${res.error ?? '알 수 없는 오류'}`);
      }
    } catch (e) {
      toast.error(`PDF 생성 실패: ${(e as Error).message}`);
    }
  }

  function reset() {
    setSearch(''); setClient(''); setJudgment(''); setDate('');
  }

  return (
    <div className="space-y-4">
      <section className="bg-surface border border-border rounded-lg p-3 flex flex-wrap items-center gap-2">
        <input
          placeholder="LOT번호 / 납품처 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border border-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary"
        />
        <select
          value={clientName}
          onChange={(e) => setClient(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs bg-surface"
        >
          <option value="">전체 납품처</option>
          <option value="삼성웰스토리">삼성웰스토리</option>
          <option value="CJ프레시웨이">CJ프레시웨이</option>
          <option value="PSI">PSI</option>
        </select>
        <select
          value={judgment}
          onChange={(e) => setJudgment(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs bg-surface"
        >
          <option value="">전체 판정</option>
          <option value="정상">정상</option>
          <option value="주의">주의</option>
          <option value="불합격">불합격</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-border rounded px-2.5 py-1.5 text-xs"
        />
        <button
          onClick={() => alert('PDF 출력은 Phase 4에서 구현됩니다.')}
          className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark"
        >
          PDF 출력
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 border border-border rounded text-xs text-text-dim hover:border-primary"
        >
          초기화
        </button>
      </section>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        onRowClick={(r) => setSelected(r)}
        empty="조건에 맞는 LOT이 없습니다."
      />
      <div className="text-[11px] text-text-muted">총 {rows.length}건</div>

      {selected && (
        <section className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-text">LOT 상세 — {selected.lot_no}</div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-text-dim hover:text-danger"
            >
              닫기
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <DetailField label="납품처" value={selected.client_name} />
            <DetailField label="제품명" value={selected.product_name ?? '-'} />
            <DetailField label="목표수량" value={selected.target_quantity != null ? fmt.ea(selected.target_quantity) : '-'} />
            <DetailField label="상태" value={selected.status} />
            <DetailField label="검사수량" value={fmt.ea(selected.inspected)} />
            <DetailField label="양품" value={fmt.ea(selected.good_count)} />
            <DetailField label="불량" value={fmt.ea(selected.defect_count)} />
            <DetailField label="불량률" value={fmt.pct(selected.defect_rate_pct, 2)} />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => alert('클레임 대응 보고서 작성은 Phase 4에서 구현됩니다.')}
              className="px-3 py-1.5 border border-border rounded text-xs text-text-dim hover:border-primary"
            >
              클레임 대응 보고서 작성
            </button>
            <button
              onClick={() => generatePdfFor(selected.id)}
              disabled={pdfMut.isPending}
              className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary-dark disabled:opacity-50"
            >
              {pdfMut.isPending ? 'PDF 생성 중…' : 'PDF 출력'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-text-muted mb-0.5">{label}</div>
      <div className="text-xs font-medium text-text">{value}</div>
    </div>
  );
}
