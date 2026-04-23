import { useState } from 'react';
import {
  useAlarmRules, useCreateRule, useUpdateRule, useDeleteRule,
} from '../../hooks/useAdminAlarmRules';
import type { AlarmRule } from '../../hooks/useAdminAlarmRules';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Pill } from '../../components/common/Pill';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { FormField, TextInput, TextArea } from '../../components/common/FormField';
import { Select } from '../../components/common/Select';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toast } from '../../lib/toast';

interface FormState {
  name: string;
  metric: string;
  operator: AlarmRule['operator'];
  threshold: string;
  severity: AlarmRule['severity'];
  message_template: string;
}

const EMPTY: FormState = {
  name: '', metric: 'defect_rate', operator: '>', threshold: '1.0',
  severity: 'warning', message_template: '{{metric}} {{value}} — 목표 {{threshold}} 초과',
};

const METRIC_OPTS = [
  { value: 'defect_rate',  label: 'defect_rate (불량률 %)' },
  { value: 'cost_ratio',   label: 'cost_ratio (제조원가 %)' },
  { value: 'recheck_rate', label: 'recheck_rate (재검율 %)' },
];

export function AlarmRulePage() {
  const { data: rules = [], isLoading } = useAlarmRules();
  const createMut = useCreateRule();
  const updateMut = useUpdateRule();
  const deleteMut = useDeleteRule();

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<AlarmRule | null>(null);

  function openNew() {
    setEditId(null); setForm(EMPTY); setModalOpen(true);
  }

  function openEdit(r: AlarmRule) {
    setEditId(r.id);
    setForm({
      name: r.name, metric: r.metric, operator: r.operator,
      threshold: r.threshold.toString(), severity: r.severity,
      message_template: r.message_template,
    });
    setModalOpen(true);
  }

  async function onSubmit() {
    if (!form.name || !form.metric || !form.message_template) {
      toast.error('이름/지표/메시지 템플릿은 필수입니다.');
      return;
    }
    const payload = {
      name: form.name,
      metric: form.metric,
      operator: form.operator,
      threshold: Number(form.threshold),
      severity: form.severity,
      message_template: form.message_template,
    };
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, changes: payload });
        toast.success('규칙 수정됨');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('규칙 추가됨');
      }
      setModalOpen(false);
      setEditId(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<AlarmRule>[] = [
    { key: 'name',     header: '이름', render: (r) => r.name },
    { key: 'metric',   header: '지표', render: (r) => <span className="font-mono text-xs">{r.metric}</span> },
    { key: 'op',       header: '조건', align: 'center', render: (r) =>
      <span className="font-mono">{r.operator} {r.threshold}</span>
    },
    { key: 'severity', header: '심각도', align: 'center', render: (r) =>
      r.severity === 'danger'  ? <Pill variant="danger">danger</Pill> :
      r.severity === 'warning' ? <Pill variant="warn">warning</Pill> :
                                  <Pill variant="info">info</Pill>
    },
    { key: 'enabled', header: '활성', align: 'center', render: (r) =>
      r.enabled ? <Pill variant="ok">ON</Pill> : <Pill variant="danger">OFF</Pill>
    },
    { key: 'actions', header: '작업', align: 'right', render: (r) => (
      <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" onClick={() => updateMut.mutate({ id: r.id, changes: { enabled: !r.enabled } })}>
          {r.enabled ? '끄기' : '켜기'}
        </Button>
        <Button variant="secondary" onClick={() => openEdit(r)}>편집</Button>
        <Button variant="danger" onClick={() => setConfirmDel(r)}>삭제</Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">알람 규칙</h1>
        <Button onClick={openNew}>+ 신규 규칙</Button>
      </div>

      <DataTable columns={columns} rows={rules} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? '규칙 편집' : '신규 규칙'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button>
            <Button onClick={onSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? '저장' : '생성'}
            </Button>
          </>
        }
      >
        <FormField label="규칙 이름 *">
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="불량률 상한 초과" />
        </FormField>
        <FormField label="지표 *">
          <Select
            value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })}
            options={METRIC_OPTS}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="연산자">
            <Select
              value={form.operator}
              onChange={(e) => setForm({ ...form, operator: e.target.value as AlarmRule['operator'] })}
              options={[
                { value: '>', label: '>' }, { value: '>=', label: '>=' },
                { value: '<', label: '<' }, { value: '<=', label: '<=' },
                { value: '=', label: '=' },
              ]}
            />
          </FormField>
          <FormField label="임계값">
            <TextInput type="number" step="0.01" value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </FormField>
        </div>
        <FormField label="심각도">
          <Select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value as AlarmRule['severity'] })}
            options={[
              { value: 'info', label: 'info' },
              { value: 'warning', label: 'warning' },
              { value: 'danger', label: 'danger' },
            ]}
          />
        </FormField>
        <FormField label="메시지 템플릿 *" hint="{{value}}, {{threshold}} 치환자 사용 가능">
          <TextArea value={form.message_template}
            onChange={(e) => setForm({ ...form, message_template: e.target.value })} />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="규칙 삭제"
        message={confirmDel ? `"${confirmDel.name}" 규칙을 삭제하시겠습니까?` : ''}
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
