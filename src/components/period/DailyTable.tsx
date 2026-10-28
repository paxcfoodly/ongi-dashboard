export interface DailyColumn<T> {
  header: string;
  cell: (row: T) => string;
  total: string;
  agg: 'sum' | 'avg' | 'none';
}

// 표시 전용: 값은 모두 호출 측(서비스)에서 계산해 문자열로 넘긴다
export function DailyTable<T extends { day: string }>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: DailyColumn<T>[];
}) {
  return (
    <section className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="text-text-dim text-left">
              <th className="py-1.5 pr-4 font-medium">날짜</th>
              {columns.map((c) => (
                <th key={c.header} className="py-1.5 px-2 font-medium text-right">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className="border-t border-border">
                <td className="py-1.5 pr-4">{r.day}</td>
                {columns.map((c) => (
                  <td key={c.header} className="py-1.5 px-2 text-right">{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-medium">
              <td className="py-1.5 pr-4">기간 합계·평균</td>
              {columns.map((c) => (
                <td key={c.header} className="py-1.5 px-2 text-right">
                  {c.agg === 'sum' ? `합계 ${c.total}` : c.agg === 'avg' ? `평균 ${c.total}` : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
