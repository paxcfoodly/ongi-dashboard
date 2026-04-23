import { useState } from 'react';
import {
  useUsers, useInviteUser, useUpdateUserProfile,
} from '../../hooks/useAdminUsers';
import type { UserRow } from '../../hooks/useAdminUsers';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { toast } from '../../lib/toast';

interface InviteForm {
  email: string;
  full_name: string;
  role: 'admin' | 'viewer';
  password: string;
}

const EMPTY: InviteForm = { email: '', full_name: '', role: 'viewer', password: '' };

export function UserPage() {
  const { data: rows = [], isLoading } = useUsers();
  const inviteMut = useInviteUser();
  const updateMut = useUpdateUserProfile();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InviteForm>(EMPTY);

  async function onInvite() {
    if (!form.email || !form.full_name) {
      toast.error('이메일과 이름은 필수입니다.');
      return;
    }
    try {
      await inviteMut.mutateAsync({
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        password: form.password || undefined,
      });
      toast.success(`${form.email} 초대됨`);
      setModalOpen(false);
      setForm(EMPTY);
    } catch (e: unknown) {
      toast.error(`초대 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<UserRow>[] = [
    { key: 'name',    header: '이름', render: (r) => r.full_name ?? '-' },
    { key: 'role',    header: '권한', align: 'center', render: (r) =>
      r.role === 'admin' ? <Pill variant="danger">admin</Pill> : <Pill variant="info">viewer</Pill>
    },
    { key: 'active',  header: '상태', align: 'center', render: (r) =>
      r.active ? <Pill variant="ok">활성</Pill> : <Pill variant="danger">비활성</Pill>
    },
    { key: 'created', header: '생성일', render: (r) =>
      new Date(r.created_at).toLocaleDateString('ko-KR')
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Select
          value={r.role}
          onChange={(e) => updateMut.mutate({ id: r.id, changes: { role: e.target.value as UserRow['role'] } })}
          options={[
            { value: 'viewer', label: 'viewer' },
            { value: 'admin', label: 'admin' },
          ]}
          className="!py-1 !text-[11px] w-[80px]"
        />
        <Button variant="secondary" onClick={() => updateMut.mutate({ id: r.id, changes: { active: !r.active } })}>
          {r.active ? '비활성화' : '활성화'}
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">사용자 관리</h1>
        <Button onClick={() => setModalOpen(true)}>+ 사용자 초대</Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="사용자 초대"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onInvite} disabled={inviteMut.isPending}>초대</Button>
          </>
        }
      >
        <FormField label="이메일 *">
          <TextInput type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </FormField>
        <FormField label="이름 *">
          <TextInput value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </FormField>
        <FormField label="권한">
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'viewer' })}
            options={[
              { value: 'viewer', label: 'viewer (읽기 + 알람 acknowledge)' },
              { value: 'admin', label: 'admin (전체 관리)' },
            ]}
          />
        </FormField>
        <FormField label="초기 비밀번호 (선택)" hint="미입력 시 사용자가 이메일 확인 후 스스로 설정">
          <TextInput type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="8자 이상" />
        </FormField>
      </Modal>
    </div>
  );
}
