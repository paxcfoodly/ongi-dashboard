import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useClaims,
  useCreateClaim,
  useUpdateClaimStatus,
  useDeleteClaim,
} from '../../hooks/useAdminClaims';
import type { ClaimRow } from '../../hooks/useAdminClaims';
import { fetchClients } from '../../hooks/useAdminLots';
import type { ClientRow } from '../../hooks/useAdminLots';
import { useLots } from '../../hooks/useLots';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ResponseModal } from '../../components/common/ResponseModal';
import { useClaimResponse } from '../../hooks/useLlmAnalyze';
import { toast } from '../../lib/toast';
import { fmt } from '../../utils/formatting';

interface FormState {
  client_id: string;
  lot_id: string;
  received_at: string;
  defect_type: string;
  quantity: string;
  description: string;
}

const EMPTY: FormState = {
  client_id: '',
  lot_id: '',
  received_at: new Date().toISOString().slice(0, 16),
  defect_type: '',
  quantity: '',
  description: '',
};

export function ClaimPage() {
  const { data: rows = [], isLoading } = useClaims();
  const { data: clients = [] } = useQuery<ClientRow[]>({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });
  const { data: lots = [] } = useLots();

  const createMut = useCreateClaim();
  const updateStatusMut = useUpdateClaimStatus();
  const deleteMut = useDeleteClaim();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<ClaimRow | null>(null);

  const [llmOpen, setLlmOpen] = useState(false);
  const [llmText, setLlmText] = useState('');
  const [llmTitle, setLlmTitle] = useState('');
  const claimRespMut = useClaimResponse();

  async function generateResponseFor(r: ClaimRow) {
    setLlmOpen(true);
    setLlmTitle(`클레임 대응문 — ${r.client_name ?? '납품처'}`);
    setLlmText('');
    try {
      const res = await claimRespMut.mutateAsync({ claim_id: r.id });
      setLlmText(res.text);
    } catch (e) {
      setLlmText(`실패: ${(e as Error).message}`);
    }
  }

  async function onSubmit() {
    if (!form.client_id) {
      toast.error('납품처는 필수입니다.');
      return;
    }
    try {
      await createMut.mutateAsync({
        client_id: form.client_id,
        lot_id: form.lot_id || null,
        received_at: new Date(form.received_at).toISOString(),
        defect_type: form.defect_type || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        description: form.description || null,
      });
      toast.success('클레임 등록됨');
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`등록 실패: ${(e as Error).message}`);
    }
  }

  async function onStatusChange(row: ClaimRow, status: ClaimRow['status']) {
    try {
      await updateStatusMut.mutateAsync({ id: row.id, status });
      toast.success('상태 변경됨');
    } catch (e: unknown) {
      toast.error(`변경 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<ClaimRow>[] = [
    {
      key: 'received_at',
      header: '접수일시',
      render: (r) => new Date(r.received_at).toLocaleString('ko-KR'),
    },
    { key: 'client', header: '납품처', render: (r) => r.client_name ?? '-' },
    { key: 'defect_type', header: '불량 유형', render: (r) => r.defect_type ?? '-' },
    {
      key: 'quantity',
      header: '수량',
      align: 'right',
      render: (r) => (r.quantity != null ? fmt.int(r.quantity) : '-'),
    },
    {
      key: 'description',
      header: '설명',
      render: (r) => (
        <span className="truncate max-w-[300px] inline-block">{r.description ?? '-'}</span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      align: 'center',
      render: (r) =>
        r.status === 'resolved' ? (
          <Pill variant="ok">완료</Pill>
        ) : r.status === 'investigating' ? (
          <Pill variant="warn">조사중</Pill>
        ) : (
          <Pill variant="danger">미처리</Pill>
        ),
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (r) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Select
            value={r.status}
            onChange={(e) => onStatusChange(r, e.target.value as ClaimRow['status'])}
            options={[
              { value: 'open', label: '미처리' },
              { value: 'investigating', label: '조사중' },
              { value: 'resolved', label: '완료' },
            ]}
            className="!py-1 !text-[11px] w-[90px]"
          />
          <Button variant="secondary" onClick={() => generateResponseFor(r)}>
            대응문
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
        <h1 className="text-lg font-semibold text-text">클레임 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 신규 클레임</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        empty="등록된 클레임이 없습니다."
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="신규 클레임"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={onSubmit} disabled={createMut.isPending}>
              등록
            </Button>
          </>
        }
      >
        <FormField label="납품처 *">
          <Select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            options={[
              { value: '', label: '-- 선택 --' },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FormField>
        <FormField label="관련 LOT (선택)">
          <Select
            value={form.lot_id}
            onChange={(e) => setForm({ ...form, lot_id: e.target.value })}
            options={[
              { value: '', label: '-- 없음 --' },
              ...lots.map((l) => ({ value: l.id, label: `${l.lot_no} / ${l.client_name}` })),
            ]}
          />
        </FormField>
        <FormField label="접수일시">
          <TextInput
            type="datetime-local"
            value={form.received_at}
            onChange={(e) => setForm({ ...form, received_at: e.target.value })}
          />
        </FormField>
        <FormField label="불량 유형">
          <TextInput
            value={form.defect_type}
            onChange={(e) => setForm({ ...form, defect_type: e.target.value })}
          />
        </FormField>
        <FormField label="수량">
          <TextInput
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </FormField>
        <FormField label="설명">
          <TextArea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="클레임 삭제"
        message="이 클레임을 삭제하시겠습니까?"
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

      <ResponseModal
        open={llmOpen}
        onClose={() => setLlmOpen(false)}
        title={llmTitle}
        text={llmText}
        loading={claimRespMut.isPending}
      />
    </div>
  );
}
