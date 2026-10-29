import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../../test/axe';
import type { ListParams } from '../lists/list-params';
import { type Column, DataTable } from './data-table';
import { FilterBar } from './filter-bar';

interface Row {
  ref: string;
  name: string;
}
const COLUMNS: Column<Row>[] = [
  { id: 'ref', header: 'Reference', cell: (r) => r.ref, sortField: 'ref' },
  { id: 'name', header: 'Name', cell: (r) => r.name },
];
const ROWS: Row[] = [
  { ref: 'BK-2026-0001', name: 'Ahmed' },
  { ref: 'BK-2026-0002', name: 'Fatima' },
];
const PARAMS: ListParams = {
  q: '',
  page: 1,
  pageSize: 20,
  sort: null,
  filters: {},
  includeDeactivated: false,
};

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const onParamsChange = vi.fn();
  const view = render(
    <DataTable<Row>
      caption="Bookings"
      columns={COLUMNS}
      rows={ROWS}
      total={2}
      rowKey={(r) => r.ref}
      params={PARAMS}
      onParamsChange={onParamsChange}
      {...props}
    />,
  );
  return { onParamsChange, ...view };
}

describe('PROMPT-4.2 DataTable', () => {
  it('PROMPT-4.2 shows the rows with an "N of M" count', async () => {
    const { container } = renderTable({ total: 57 });
    const table = screen.getByRole('table', { name: 'Bookings' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('2 of 57')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    await expectAccessible(container);
  });

  it('PROMPT-2.16 sorting is the server’s: the header asks for field:asc, then field:desc', async () => {
    const user = userEvent.setup();
    const { onParamsChange, rerender } = renderTable();
    await user.click(screen.getByRole('button', { name: 'Sort by Reference' }));
    expect(onParamsChange).toHaveBeenLastCalledWith({ sort: { field: 'ref', dir: 'asc' } });
    rerender(
      <DataTable<Row>
        caption="Bookings"
        columns={COLUMNS}
        rows={ROWS}
        total={2}
        rowKey={(r) => r.ref}
        params={{ ...PARAMS, sort: { field: 'ref', dir: 'asc' } }}
        onParamsChange={onParamsChange}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Reference/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await user.click(screen.getByRole('button', { name: 'Sort by Reference' }));
    expect(onParamsChange).toHaveBeenLastCalledWith({ sort: { field: 'ref', dir: 'desc' } });
    expect(screen.queryByRole('button', { name: 'Sort by Name' })).toBeNull();
  });

  it('PROMPT-2.16 pages through the server’s results', async () => {
    const user = userEvent.setup();
    const { onParamsChange } = renderTable({ total: 45 });
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onParamsChange).toHaveBeenLastCalledWith({ page: 2 });
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(onParamsChange).toHaveBeenLastCalledWith({ pageSize: 50 });
  });

  it('PROMPT-2.16 offers exports only with the export right', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const { unmount } = renderTable({ exports: { allowed: false, onExport } });
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    unmount();
    renderTable({ exports: { allowed: true, formats: ['xlsx', 'pdf'], onExport } });
    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.queryByRole('menuitem', { name: 'Export as CSV' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Export as PDF' }));
    expect(onExport).toHaveBeenCalledWith('pdf');
  });

  it('PROMPT-2.16 masters have a Show deactivated toggle', async () => {
    const user = userEvent.setup();
    const { onParamsChange } = renderTable({ deactivatedToggle: true });
    await user.click(screen.getByRole('checkbox', { name: 'Show deactivated' }));
    expect(onParamsChange).toHaveBeenLastCalledWith({ includeDeactivated: true });
  });

  it('PROMPT-4.2 rows open by click or Enter', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    await user.click(screen.getByText('Ahmed'));
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[0]);
    screen.getByText('Fatima').closest('tr')?.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);
  });

  it('PROMPT-4.2 says when nothing matches the filters, and while loading', () => {
    const { rerender } = renderTable({ rows: [], total: 0, params: { ...PARAMS, q: 'zzz' } });
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
    rerender(
      <DataTable<Row>
        caption="Bookings"
        columns={COLUMNS}
        rows={undefined}
        total={undefined}
        rowKey={(r) => r.ref}
        params={PARAMS}
        onParamsChange={() => undefined}
        loading
      />,
    );
    expect(screen.getByText('Loading rows…')).toBeInTheDocument();
  });
});

describe('PROMPT-4.2 FilterBar', () => {
  it('PROMPT-4.2 searches after a pause in typing, and clears', async () => {
    const user = userEvent.setup();
    const onQChange = vi.fn();
    const onClear = vi.fn();
    const { container } = render(
      <FilterBar q="" onQChange={onQChange} onClear={onClear} activeCount={1} debounceMs={20} />,
    );
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'das ');
    await waitFor(() => expect(onQChange).toHaveBeenCalledWith('das'));
    expect(onQChange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalled();
    await expectAccessible(container);
  });

  it('PROMPT-4.2 follows the address when it changes', () => {
    const { rerender } = render(<FilterBar q="das" onQChange={() => undefined} />);
    expect(screen.getByRole('searchbox')).toHaveValue('das');
    rerender(<FilterBar q="" onQChange={() => undefined} />);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('PROMPT-4.2 keeps a cell’s state when the page re-renders with new columns', async () => {
    function Toggle() {
      const [on, setOn] = useState(false);
      return (
        <button type="button" onClick={() => setOn(true)}>
          {on ? 'Open' : 'Closed'}
        </button>
      );
    }
    const columns = (): Column<Row>[] => [
      { id: 'ref', header: 'Reference', cell: (r) => r.ref },
      { id: 'menu', header: 'Actions', cell: () => <Toggle /> },
    ];
    const props = {
      caption: 'Bookings',
      rows: ROWS.slice(0, 1),
      total: 1,
      rowKey: (r: Row) => r.ref,
      params: PARAMS,
      onParamsChange: () => undefined,
    };
    const view = render(<DataTable<Row> {...props} columns={columns()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Closed' }));
    view.rerender(<DataTable<Row> {...props} columns={columns()} />);
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });
});
