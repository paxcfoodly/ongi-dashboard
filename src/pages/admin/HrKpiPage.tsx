import { useState } from 'react';
import { useHrKpiRecords, useUpsertHrKpi, useDeleteHrKpi } from '../../hooks/useHrKpi';
import type { HrKpiRecord } from '../../hooks/useHrKpi';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';
import { hrMeasuredOnError } from '../../utils/kpi';

interface FormState {
  id?: string;
  measured_on: string;
  rate: string;
  score: string;
  note: string;
}

const EMPTY: FormState = { measured_on: '', rate: '', score: '', note: '' };

// 빈 문자열은 null, 그 외는 숫자로 변환 (NaN이면 NaN 반환)
const toNum = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export function HrKpiPage() {
  const { data: rows = [], isLoading } = useHrKpiRecords();
  const upsertMut = useUpsertHrKpi();
  const deleteMut = useDeleteHrKpi();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<HrKpiRecord | null>(null);

  function openCreate() {
    setForm(EMPTY);
    setModalOpen(true);
  }

  function openEdit(r: HrKpiRecord) {
    setForm({
      id: r.id,
      measured_on: r.measured_on,
      rate: r.job_conversion_rate_pct == null ? '' : String(r.job_conversion_rate_pct),
      score: r.satisfaction_score == null ? '' : String(r.satisfaction_score),
      note: r.note ?? '',
    });
    setModalOpen(true);
  }

  async function onSubmit() {
    if (!form.measured_on) {
      toast.error('측정일은 필수입니다.');
      return;
    }
    const dateErr = hrMeasuredOnError(form.measured_on);
    if (dateErr) {
      toast.error(dateErr);
      return;
    }
    const rate = toNum(form.rate);
    const score = toNum(form.score);
    if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      toast.error('직무 전환율은 0~100 사이여야 합니다.');
      return;
    }
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 5)) {
      toast.error('만족도는 0~5 사이여야 합니다.');
      return;
    }
    try {
      await upsertMut.mutateAsync({
        ...(form.id ? { id: form.id } : {}),
        measured_on: form.measured_on,
        job_conversion_rate_pct: rate,
        satisfaction_score: score,
        note: form.note.trim() || null,
      });
      toast.success('저장됨');
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      // measured_on 중복(unique 위반, 23505)은 이해하기 쉬운 문구로 안내
      const err = e as { code?: string; message?: string };
      const msg =
        err.code === '23505' ? '이미 해당 측정일 기록이 있습니다. 목록에서 편집해 주세요.' : err.message;
      toast.error(`저장 실패: ${msg}`);
    }
  }

  const columns: Column<HrKpiRecord>[] = [
    { key: 'measured_on', header: '측정일', render: (r) => r.measured_on },
    {
      key: 'rate',
      header: '직무 전환율 (%)',
      align: 'right',
      render: (r) => (r.job_conversion_rate_pct != null ? r.job_conversion_rate_pct : '-'),
    },
    {
      key: 'score',
      header: '만족도 (점)',
      align: 'right',
      render: (r) => (r.satisfaction_score != null ? r.satisfaction_score : '-'),
    },
    { key: 'note', header: '메모', render: (r) => r.note ?? '-' },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (r) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" onClick={() => openEdit(r)}>
            편집
          </Button>
          <Button variant="danger" onClick={() => setConfirmDel(r)}>
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">인력 지표</h1>
        <Button onClick={openCreate}>+ 신규 기록</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        empty="등록된 인력 지표 기록이 없습니다."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? '인력 지표 편집' : '신규 인력 지표'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={onSubmit} disabled={upsertMut.isPending}>
              저장
            </Button>
          </>
        }
      >
        <FormField label="측정일 *">
          <TextInput
            type="date"
            value={form.measured_on}
            onChange={(e) => setForm({ ...form, measured_on: e.target.value })}
          />
        </FormField>
        <FormField label="직무 전환율 (%)">
          <TextInput
            type="number"
            min={0}
            max={100}
            step="any"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
          />
        </FormField>
        <FormField label="만족도 (5점 척도)">
          <TextInput
            type="number"
            min={0}
            max={5}
            step="any"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
          />
        </FormField>
        <FormField label="메모">
          <TextArea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="인력 지표 삭제"
        message={`${confirmDel?.measured_on ?? ''} 기록을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await deleteMut.mutateAsync(confirmDel.id);
            toast.success('삭제됨');
          } catch (e: unknown) {
            toast.error(`삭제 실패: ${(e as Error).message}`);
          }
          setConfirmDel(null);
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
