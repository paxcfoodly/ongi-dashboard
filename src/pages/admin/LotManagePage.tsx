import { useEffect, useRef, useState } from 'react';
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
import { LotFormFields } from '../../components/admin/LotFormFields';
import { EMPTY_LOT_FORM } from '../../components/admin/lotForm';
import type { LotFormState } from '../../components/admin/lotForm';
import { toast } from '../../lib/toast';
import { fmt } from '../../utils/formatting';
import { toDatetimeLocal, fromDatetimeLocal } from '../../utils/datetime';

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
  const [form, setForm] = useState<LotFormState>(EMPTY_LOT_FORM);
  const [confirmDel, setConfirmDel] = useState<LotSummary | null>(null);

  // 폼 초기값은 모달을 열 때 / 편집 대상이 바뀔 때 한 번만 채운다.
  // (30초 주기 재조회로 rows 가 바뀌어도 입력 중인 값을 덮어쓰지 않도록)
  const seededKey = useRef<string | null>(null);

  useEffect(() => {
    if (!modalOpen) {
      seededKey.current = null;
      return;
    }
    const key = editId ?? '__new__';
    if (seededKey.current === key) return;
    if (editId) {
      const row = rows.find((r) => r.id === editId);
      // 행이 아직 로드되지 않았으면 다음 렌더에서 다시 시도
      if (!row) return;
      setForm({
        lot_no: row.lot_no,
        client_id: row.client_id,
        product_name: row.product_name ?? '',
        target_quantity: row.target_quantity?.toString() ?? '',
        notes: row.notes ?? '',
        worker_count: row.worker_count?.toString() ?? '',
        ordered_at: row.ordered_at ?? '',
        shipped_at: row.shipped_at ?? '',
        started_at: toDatetimeLocal(row.started_at),
        ended_at: toDatetimeLocal(row.ended_at),
      });
    } else {
      setForm(EMPTY_LOT_FORM);
    }
    seededKey.current = key;
  }, [modalOpen, editId, rows]);

  async function onSubmit() {
    if (!form.lot_no || !form.client_id) {
      toast.error('LOT번호와 납품처는 필수입니다.');
      return;
    }
    // 투입인원: 빈 값은 null, 값이 있으면 양의 정수만 허용
    let workerCount: number | null = null;
    if (form.worker_count !== '') {
      workerCount = Number(form.worker_count);
      if (!Number.isInteger(workerCount) || workerCount <= 0) {
        toast.error('투입인원은 1 이상의 정수여야 합니다.');
        return;
      }
    }
    const payload = {
      lot_no: form.lot_no,
      client_id: form.client_id,
      product_name: form.product_name || null,
      target_quantity: form.target_quantity ? Number(form.target_quantity) : null,
      notes: form.notes || null,
      worker_count: workerCount,
      ordered_at: form.ordered_at || null,
      shipped_at: form.shipped_at || null,
    };
    // 시작/종료 시각: 편집 시 원본(분 단위 표시값)과 달라진 경우에만 전송해 초 단위 값 보존
    const orig = editId ? rows.find((r) => r.id === editId) : undefined;
    const timeChanged = (key: 'started_at' | 'ended_at') =>
      !orig || form[key] !== toDatetimeLocal(orig[key]);
    const timePayload: { started_at?: string | null; ended_at?: string | null } = {};
    if (timeChanged('started_at')) timePayload.started_at = fromDatetimeLocal(form.started_at);
    if (timeChanged('ended_at')) timePayload.ended_at = fromDatetimeLocal(form.ended_at);
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, changes: { ...payload, ...timePayload } });
        toast.success('LOT 수정됨');
      } else {
        await createMut.mutateAsync({ ...payload, ...timePayload });
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
      key: 'worker_count',
      header: '투입인원',
      align: 'right',
      render: (r) => (r.worker_count != null ? fmt.int(r.worker_count) : '-'),
    },
    {
      key: 'man_hour',
      header: '작업공수 (man-hour)',
      align: 'right',
      render: (r) => (r.man_hour != null ? r.man_hour.toFixed(1) : '-'),
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
        <LotFormFields form={form} setForm={setForm} clients={clients} />
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
