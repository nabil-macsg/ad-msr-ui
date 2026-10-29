import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { type ListParams, PAGE_SIZES } from '../lists/list-params';
import { Button } from './button';
import { CONTROL } from './control-styles';
import { EmptyState } from './empty-state';

export interface Column<T> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  /** The API's sort field; sortable when set. */
  readonly sortField?: string;
  readonly align?: 'left' | 'right';
  readonly className?: string;
}

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';
const FORMAT_LABEL: Record<ExportFormat, string> = { xlsx: 'Excel', pdf: 'PDF', csv: 'CSV' };

export interface DataTableProps<T extends object> {
  /** The table's accessible name. */
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[] | undefined;
  readonly total: number | undefined;
  readonly rowKey: (row: T) => string;
  readonly params: ListParams;
  readonly onParamsChange: (patch: Partial<ListParams>) => void;
  readonly loading?: boolean;
  readonly onRowClick?: (row: T) => void;
  /** Masters: the "Show deactivated" toggle. */
  readonly deactivatedToggle?: boolean;
  /**
   * Exports (`GET …/export?format=`) are offered only with the page's export right
   * (PROMPT §2.16); pass `allowed: can(access, page, 'export')`.
   */
  readonly exports?: {
    readonly allowed: boolean;
    readonly formats?: readonly ExportFormat[];
    readonly onExport: (format: ExportFormat) => void;
  };
  readonly emptyTitle?: string;
  readonly toolbar?: ReactNode;
}

const features = tableFeatures({});
const EMPTY: never[] = [];

/** Server-paged, server-sorted list with an "N of M" count (PROMPT §4.2). */
export function DataTable<T extends object>({
  caption,
  columns,
  rows,
  total,
  rowKey,
  params,
  onParamsChange,
  loading = false,
  onRowClick,
  deactivatedToggle = false,
  exports,
  emptyTitle,
  toolbar,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns(
      columns.map((column) =>
        helper.display({
          id: column.id,
          header: column.header,
          cell: ({ row }) => column.cell(row.original),
        }),
      ),
    );
  }, [columns]);
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows ?? EMPTY,
    getRowId: (row) => rowKey(row),
  });
  const byId = new Map(columns.map((c) => [c.id, c]));
  const pages = Math.max(1, Math.ceil((total ?? 0) / params.pageSize));
  const filtered = Boolean(params.q) || Object.keys(params.filters).length > 0;

  const toggleSort = (field: string) => {
    const dir = params.sort?.field === field && params.sort.dir === 'asc' ? 'desc' : 'asc';
    onParamsChange({ sort: { field, dir } });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <p className="text-xs text-ink-muted" aria-live="polite">
          {total !== undefined && t('ui.table.count', { shown: rows?.length ?? 0, total })}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {toolbar}
          {deactivatedToggle && (
            <label className="flex min-h-touch cursor-pointer items-center gap-1.5 text-xs text-ink-secondary">
              <input
                type="checkbox"
                className="size-3.5 rounded-sm accent-primary"
                checked={params.includeDeactivated}
                onChange={(e) => onParamsChange({ includeDeactivated: e.target.checked })}
              />
              {t('ui.table.showDeactivated')}
            </label>
          )}
          {exports?.allowed && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary">
                  <Download className="size-[14px]" aria-hidden />
                  {t('ui.table.export')}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-overlay"
                >
                  {(exports.formats ?? (['xlsx', 'pdf', 'csv'] as const)).map((format) => (
                    <DropdownMenu.Item
                      key={format}
                      onSelect={() => exports.onExport(format)}
                      className="flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm text-ink-secondary outline-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-ink"
                    >
                      {t('ui.table.exportAs', { format: FORMAT_LABEL[format] })}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        {/* A floor width: on a narrow window the table scrolls sideways instead of
            squeezing columns to a word per line. */}
        <table className="w-full min-w-[56rem] border-collapse text-sm" aria-busy={loading}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-border bg-table-head">
                {group.headers.map((header) => {
                  const column = byId.get(header.column.id);
                  const sorted =
                    column?.sortField && params.sort?.field === column.sortField
                      ? params.sort.dir
                      : null;
                  const label = column?.header ?? '';
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={cn(
                        'h-11 px-4 py-2 text-left text-xs font-semibold whitespace-nowrap text-on-table-head',
                        column?.align === 'right' && 'text-right',
                      )}
                    >
                      {column?.sortField ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.sortField ?? '')}
                          className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={t('ui.table.sortBy', { column: label })}
                        >
                          {label}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && !rows?.length && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-muted">
                  {t('ui.table.loading')}
                </td>
              </tr>
            )}
            {!loading && rows?.length === 0 && (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    title={emptyTitle ?? t('ui.table.empty')}
                    body={filtered ? t('ui.table.emptyFiltered') : undefined}
                  />
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-0 hover:bg-table-row-hover',
                  onRowClick &&
                    'cursor-pointer hover:bg-table-row-hover focus-visible:bg-table-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                )}
                {...(onRowClick
                  ? {
                      tabIndex: 0,
                      onClick: () => onRowClick(row.original),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') onRowClick(row.original);
                      },
                    }
                  : {})}
              >
                {row.getAllCells().map((cell) => {
                  const column = byId.get(cell.column.id);
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        // 48 px rows for one line; two-line cells grow a little. Codes
                        // (monospace) never break mid-code.
                        'h-12 px-4 py-2 align-middle text-ink-body [&_.font-mono]:whitespace-nowrap',
                        // Figures and dates stay on one line ("152.4 km", "510 min").
                        column?.align === 'right' && 'text-right whitespace-nowrap tabular-nums',
                        column?.className,
                      )}
                    >
                      {/* Called directly, not through FlexRender: a page re-renders with new
                          column objects, and a cell must keep its state (an open row menu). */}
                      {column?.cell(row.original)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-4 py-2 text-xs text-ink-muted">
        <label className="flex items-center gap-2">
          {t('ui.table.pageSize')}
          <select
            className={cn('min-h-8 px-2 py-1', CONTROL)}
            value={params.pageSize}
            onChange={(e) => onParamsChange({ pageSize: Number(e.target.value) })}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>{t('ui.table.pageOf', { page: params.page, pages })}</span>
        <Button
          variant="ghost"
          aria-label={t('ui.table.previous')}
          disabled={params.page <= 1}
          onClick={() => onParamsChange({ page: params.page - 1 })}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          aria-label={t('ui.table.nextPage')}
          disabled={params.page >= pages}
          onClick={() => onParamsChange({ page: params.page + 1 })}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
