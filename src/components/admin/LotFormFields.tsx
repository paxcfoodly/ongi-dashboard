import { FormField, TextInput, TextArea } from '../common/FormField';
import { Select } from '../common/Select';
import type { ClientRow } from '../../hooks/useAdminLots';
import type { LotFormState } from './lotForm';

export function LotFormFields({
  form,
  setForm,
  clients,
}: {
  form: LotFormState;
  setForm: (f: LotFormState) => void;
  clients: ClientRow[];
}) {
  return (
    <>
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
      <FormField label="투입인원 (명)">
        <TextInput
          type="number"
          min={1}
          max={1000}
          step={1}
          value={form.worker_count}
          onChange={(e) => setForm({ ...form, worker_count: e.target.value })}
        />
      </FormField>
      <FormField label="수주일">
        <TextInput
          type="date"
          value={form.ordered_at}
          onChange={(e) => setForm({ ...form, ordered_at: e.target.value })}
        />
      </FormField>
      <FormField label="출하일">
        <TextInput
          type="date"
          value={form.shipped_at}
          onChange={(e) => setForm({ ...form, shipped_at: e.target.value })}
        />
      </FormField>
      <FormField label="시작 시각">
        <TextInput
          type="datetime-local"
          value={form.started_at}
          onChange={(e) => setForm({ ...form, started_at: e.target.value })}
        />
      </FormField>
      <FormField label="종료 시각">
        <TextInput
          type="datetime-local"
          value={form.ended_at}
          onChange={(e) => setForm({ ...form, ended_at: e.target.value })}
        />
      </FormField>
      <FormField label="비고">
        <TextArea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </FormField>
    </>
  );
}
