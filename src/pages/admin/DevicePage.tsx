import { useState } from 'react';
import {
  useDevices,
  useCreateDevice,
  useRegenerateDeviceKey,
  useUpdateDevice,
} from '../../hooks/useAdminDevices';
import type { DeviceRow } from '../../hooks/useAdminDevices';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';

interface FormState {
  code: string;
  name: string;
  type: 'vision_inspector' | 'equipment';
  role: string;
  process_order: string;
}

const EMPTY: FormState = {
  code: '',
  name: '',
  type: 'equipment',
  role: '',
  process_order: '99',
};

export function DevicePage() {
  const { data: rows = [], isLoading } = useDevices();
  const createMut = useCreateDevice();
  const regenMut = useRegenerateDeviceKey();
  const updateMut = useUpdateDevice();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [newKey, setNewKey] = useState<{ code: string; key: string } | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<DeviceRow | null>(null);

  async function onSubmit() {
    if (!form.code || !form.name) {
      toast.error('code와 name은 필수입니다.');
      return;
    }
    try {
      const { device, apiKey } = await createMut.mutateAsync({
        code: form.code,
        name: form.name,
        type: form.type,
        role: form.role || null,
        process_order: Number(form.process_order),
      });
      setNewKey({ code: device.code, key: apiKey });
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`생성 실패: ${(e as Error).message}`);
    }
  }

  async function onRegenerate(row: DeviceRow) {
    try {
      const apiKey = await regenMut.mutateAsync(row.id);
      setNewKey({ code: row.code, key: apiKey });
    } catch (e: unknown) {
      toast.error(`재발급 실패: ${(e as Error).message}`);
    }
    setConfirmRegen(null);
  }

  const columns: Column<DeviceRow>[] = [
    { key: 'order', header: '순서', align: 'center', render: (r) => r.process_order },
    {
      key: 'code',
      header: '코드',
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    { key: 'name', header: '이름', render: (r) => r.name },
    {
      key: 'type',
      header: '타입',
      render: (r) => (r.type === 'vision_inspector' ? 'AI 비전' : '일반 장비'),
    },
    { key: 'role', header: 'Role', render: (r) => r.role ?? '-' },
    {
      key: 'active',
      header: '활성',
      align: 'center',
      render: (r) =>
        r.active ? <Pill variant="ok">활성</Pill> : <Pill variant="danger">비활성</Pill>,
    },
    {
      key: 'last_seen',
      header: '마지막 수신',
      render: (r) =>
        r.last_seen_at ? new Date(r.last_seen_at).toLocaleString('ko-KR') : '-',
    },
    {
      key: 'actions',
      header: '작업',
      align: 'right',
      render: (r) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="secondary"
            onClick={() =>
              updateMut.mutate({ id: r.id, changes: { active: !r.active } })
            }
          >
            {r.active ? '비활성화' : '활성화'}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmRegen(r)}>
            키 재발급
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">장비 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 신규 장비</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="신규 장비"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button onClick={onSubmit} disabled={createMut.isPending}>
              생성
            </Button>
          </>
        }
      >
        <FormField
          label="장비 코드 *"
          hint="장비가 /ingest 호출 시 X-Device-Code 헤더로 보낼 식별자"
        >
          <TextInput
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="packaging_02"
          />
        </FormField>
        <FormField label="장비 이름 *">
          <TextInput
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label="타입 *">
          <Select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as FormState['type'] })
            }
            options={[
              { value: 'equipment', label: '일반 장비' },
              { value: 'vision_inspector', label: 'AI 비전검사기' },
            ]}
          />
        </FormField>
        <FormField
          label="Role"
          hint="primary_output = 일일 생산량 기준, inspection = AI 검사, 공란 = 보조"
        >
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: '', label: '(없음)' },
              { value: 'primary_output', label: 'primary_output' },
              { value: 'inspection', label: 'inspection' },
            ]}
          />
        </FormField>
        <FormField label="공정 순서 *">
          <TextInput
            type="number"
            min={1}
            value={form.process_order}
            onChange={(e) => setForm({ ...form, process_order: e.target.value })}
          />
        </FormField>
      </Modal>

      <Modal
        open={!!newKey}
        onClose={() => setNewKey(null)}
        title="API 키 발급 완료"
        footer={<Button onClick={() => setNewKey(null)}>확인</Button>}
      >
        <p className="text-xs text-text mb-2">
          장비 <strong>{newKey?.code}</strong>의 API 키입니다.{' '}
          <strong className="text-danger">
            이 화면을 닫으면 다시 볼 수 없습니다.
          </strong>{' '}
          안전한 곳에 복사해두세요.
        </p>
        <code className="block bg-surface2 border border-border rounded p-2 text-[11px] font-mono break-all">
          {newKey?.key}
        </code>
      </Modal>

      <ConfirmDialog
        open={!!confirmRegen}
        title="API 키 재발급"
        message={
          confirmRegen
            ? `${confirmRegen.code}의 API 키를 재발급합니다. 기존 키는 즉시 무효화되며, 장비 쪽 설정을 바로 갱신해야 합니다. 계속하시겠습니까?`
            : ''
        }
        confirmLabel="재발급"
        variant="danger"
        onConfirm={() => confirmRegen && onRegenerate(confirmRegen)}
        onCancel={() => setConfirmRegen(null)}
      />
    </div>
  );
}
