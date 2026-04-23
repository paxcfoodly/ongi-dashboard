import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  onRowClick,
  empty = '데이터가 없습니다.',
  loading = false,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-text-dim text-sm">
        로딩 중...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center text-text-muted text-sm">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface2">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 text-[11px] font-medium text-text-dim border-b border-border whitespace-nowrap ${
                  c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                }`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-border last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-surface2' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2.5 text-text whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
