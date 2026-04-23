import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLots } from '../../hooks/useLots';
import type { LotSummary } from '../../hooks/useLots';
import {
  useCreateLot,
  useUpdateLot,
  useDeleteLot,
  useStartLot,
  useEndLot,
  fetchClients,
} from '../../hooks/useAdminLots';
import type { ClientRow } from '../../hooks/useAdminLots';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { toast } from '../../lib/toast';
import { fmt } from '../../utils/formatting';

interface FormState {
  lot_no: string;
  client_id: string;
  product_name: string;
  target_quantity: string;
  notes: string;
}

const EMPTY: FormState = {
  lot_no: '',
  client_id: '',
  product_name: '',
  target_quantity: '',
  notes: '',
};

export function LotManagePage() {
  const { data: rows = [], isLoading } = useLots();
  const { data: clients = [] } = useQuery<ClientRow[]>({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const createMut = useCreateLot();
  const updateMut = useUpdateLot();
  const deleteMut = useDeleteLot();
  const startLot = useStartLot();
  const endLot = useEndLot();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<LotSummary | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    if (editId) {
      const row = rows.find((r) => r.id === editId);
      if (row)
        setForm({
          lot_no: row.lot_no,
          client_id: row.client_id,
          product_name: row.product_name ?? '',
          target_quantity: row.target_quantity?.toString() ?? '',
          notes: row.notes ?? '',
        });
    } else {
      setForm(EMPTY);
    }
  }, [modalOpen, editId, rows]);

  async function onSubmit() {
    if (!form.lot_no || !form.client_id) {
      toast.error('LOT번호와 납품처는 필수입니다.');
      return;
    }
    const payload = {
      lot_no: form.lot_no,
      client_id: form.client_id,
      product_name: form.product_name || null,
      target_quantity: form.target_quantity ? Number(form.target_quantity) : null,
      notes: form.notes || null,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, changes: payload });
        toast.success('LOT 수정됨');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('LOT 생성됨');
      }
      setModalOpen(false);
      setEditId(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  async function onDelete(row: LotSummary) {
    try {
      await deleteMut.mutateAsync(row.id);
      toast.success(`${row.lot_no} 삭제됨`);
    } catch (e: unknown) {
      toast.error(`삭제 실패: ${(e as Error).message}`);
    }
    setConfirmDel(null);
  }

  const columns: Column<LotSummary>[] = [
    {
      key: 'lot_no',
      header: 'LOT번호',
      render: (r) => <span className="font-mono">{r.lot_no}</span>,
    },
    { key: 'client', header: '납품처', render: (r) => r.client_name },
    { key: 'product', header: '제품', render: (r) => r.product_name ?? '-' },
    {
      key: 'target',
      header: '목표수량',
      align: 'right',
      render: (r) => (r.target_quantity != null ? fmt.int(r.target_quantity) : '-'),
    },
    {
      key: 'status',
      header: '상태',
      align: 'center',
      render: (r) =>
        r.status === 'running' ? (
          <Pill variant="info">진행중</Pill>
        ) : r.status === 'completed' ? (
          <Pill variant="ok">완료</Pill>
        ) : r.status === 'paused' ? (
          <Pill variant="warn">일시중지</Pill>
        ) : (
          <Pill variant="info">계획</Pill>
        ),
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {r.status === 'planned' && (
            <Button
              variant="primary"
              onClick={async () => {
                await startLot(r.id);
                toast.success('LOT 시작됨');
              }}
            >
              시작
            </Button>
          )}
          {r.status === 'running' && (
            <Button
              variant="primary"
              onClick={async () => {
                await endLot(r.id);
                toast.success('LOT 종료됨');
              }}
            >
              종료
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setEditId(r.id);
              setModalOpen(true);
            }}
          >
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
        <h1 className="text-lg font-semibold text-text">LOT 관리</h1>
        <Button
          onClick={() => {
            setEditId(null);
            setModalOpen(true);
          }}
        >
          + 신규 LOT
        </Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditId(null);
        }}
        title={editId ? 'LOT 편집' : '신규 LOT'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                setEditId(null);
              }}
            >
              취소
            </Button>
            <Button onClick={onSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? '저장' : '생성'}
            </Button>
          </>
        }
      >
        <FormField label="LOT번호 *">
          <TextInput
            value={form.lot_no}
            onChange={(e) => setForm({ ...form, lot_no: e.target.value })}
            placeholder="LOT-20260424-001"
          />
        </FormField>
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
        <FormField label="제품명">
          <TextInput
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
          />
        </FormField>
        <FormField label="목표 수량 (ea)">
          <TextInput
            type="number"
            min={1}
            value={form.target_quantity}
            onChange={(e) => setForm({ ...form, target_quantity: e.target.value })}
          />
        </FormField>
        <FormField label="비고">
          <TextArea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="LOT 삭제"
        message={
          confirmDel ? `${confirmDel.lot_no} 을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.` : ''
        }
        confirmLabel="삭제"
        variant="danger"
        onConfirm={() => confirmDel && onDelete(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
