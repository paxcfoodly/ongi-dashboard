import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';

type Row = { id: number; name: string };
const columns: Column<Row>[] = [{ key: 'name', header: '이름', render: (r) => r.name }];
const rows: Row[] = [{ id: 1, name: '행1' }];

describe('DataTable', () => {
  it('onRowClick 이 있으면 행이 키보드로 포커스·실행 가능하다 (Enter/Space)', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />);
    const row = screen.getByRole('button', { name: /행1/ });
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    fireEvent.keyDown(row, { key: 'a' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('onRowClick 이 없으면 행에 버튼 역할·tabIndex 를 주지 않는다', () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('행1').closest('tr')).not.toHaveAttribute('tabindex');
  });
});
