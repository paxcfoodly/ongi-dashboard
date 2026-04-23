import { useState } from 'react';
import { useTargets, useUpdateTarget } from '../../hooks/useAdminTargets';
import type { TargetRow } from '../../hooks/useAdminTargets';
import { DataTable } from '../../components/common/DataTable';
import type { Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { TextInput } from '../../components/common/FormField';
import { toast } from '../../lib/toast';

// DataTable's generic constraint requires an `id` field. `targets` is keyed by
// a text `key` column, so we alias it to `id` for row identity while keeping
// the rest of the row shape intact.
type TargetRowWithId = TargetRow & { id: string };

export function TargetPage() {
  const { data: rawRows = [], isLoading } = useTargets();
  const rows: TargetRowWithId[] = rawRows.map((r) => ({ ...r, id: r.key }));
  const updateMut = useUpdateTarget();

  const [editKey, setEditKey]   = useState<string | null>(null);
  const [editValue, setEditVal] = useState<string>('');

  function startEdit(r: TargetRow) {
    setEditKey(r.key);
    setEditVal(r.value.toString());
  }

  async function saveEdit() {
    if (editKey == null) return;
    const num = Number(editValue);
    if (Number.isNaN(num)) {
      toast.error('숫자만 입력 가능합니다.');
      return;
    }
    try {
      await updateMut.mutateAsync({ key: editKey, value: num });
      toast.success('저장됨');
      setEditKey(null);
    } catch (e: unknown) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    }
  }

  const columns: Column<TargetRowWithId>[] = [
    { key: 'key',         header: '키', render: (r) => <span className="font-mono text-xs">{r.key}</span> },
    { key: 'description', header: '설명', render: (r) => r.description ?? '-' },
    { key: 'value',       header: '값', align: 'right', render: (r) =>
      editKey === r.key ? (
        <div className="flex gap-1 items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <TextInput
            type="number" step="0.01"
            value={editValue}
            onChange={(e) => setEditVal(e.target.value)}
            className="!w-24"
          />
          <Button onClick={saveEdit} disabled={updateMut.isPending}>저장</Button>
          <Button variant="secondary" onClick={() => setEditKey(null)}>취소</Button>
        </div>
      ) : (
        <span className="font-mono">{r.value} {r.unit ?? ''}</span>
      )
    },
    { key: 'actions', header: '', align: 'right', render: (r) =>
      editKey === r.key ? null : (
        <Button variant="secondary" onClick={() => startEdit(r)}>편집</Button>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text">목표값 관리</h1>
      <DataTable columns={columns} rows={rows} loading={isLoading} />
    </div>
  );
}
