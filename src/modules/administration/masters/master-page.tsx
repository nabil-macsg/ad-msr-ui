import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, Plus } from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { type ComponentType, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../api/errors';
import { can, type Right } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { AuditTrailDrawer } from '../../../shared/audit/audit-trail';
import { downloadFile } from '../../../shared/lists/download';
import { type ListParams, toExportQuery, useListParams } from '../../../shared/lists/list-params';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { type Column, DataTable, type ExportFormat } from '../../../shared/ui/data-table';
import { FilterBar } from '../../../shared/ui/filter-bar';
import { PageHeader } from '../../../shared/ui/page-header';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { MasterRecord, MasterResource } from './master-resource';

/** The create / edit form a master page opens; the master owns its fields (react-hook-form + zod). */
export interface MasterFormProps<T> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** null for a new record. */
  readonly record: T | null;
  /** Call after a successful save; the page closes the form and refreshes the list. */
  readonly onSaved: () => void;
}

export interface MasterPageProps<T extends MasterRecord> {
  readonly resource: MasterResource<T>;
  readonly title: string;
  readonly subtitle: string;
  /** The record in lower case, for "New zone". */
  readonly noun: string;
  readonly columns: readonly Column<T>[];
  /** How dialogs name a record, e.g. "DAS · Das Island". */
  readonly describe: (record: T) => string;
  readonly form: ComponentType<MasterFormProps<T>>;
  readonly searchPlaceholder?: string;
  /** The master's own filter controls, beside the search box. */
  readonly filters?: (list: {
    params: ListParams;
    update: (patch: Partial<ListParams>) => void;
  }) => ReactNode;
  /** KPI cards above the list. */
  readonly kpis?: ReactNode;
  /** The master's own row actions (e.g. "Activate access"), after History; check rights there. */
  readonly actions?: (row: T) => readonly (RowAction | false)[];
  readonly defaultSort?: ListParams['sort'];
  /** The status cell, for records with more states than active and deactivated. */
  readonly status?: (row: T) => ReactNode;
  /** Which of deactivate and reactivate a row offers, if not by `isActive`; null for neither. */
  readonly lifecycle?: (row: T) => 'deactivate' | 'reactivate' | null;
  /** The master's own words for deactivate and reactivate (e.g. "End" for a rule). */
  readonly lifecycleText?: Partial<Record<'deactivate' | 'reactivate', LifecycleText<T>>>;
  /** Whether a row can be edited here (false for records a source system owns). */
  readonly editable?: (row: T) => boolean;
  /** Whether a row offers Delete (false for built-in records); the API refuses them too. */
  readonly deletable?: (row: T) => boolean;
  /** False for fixed masters (e.g. resource categories): no New, whatever the rights. */
  readonly creatable?: boolean;
  /** Content above the list, e.g. a standing notice (quotas: fixed wing only). */
  readonly notice?: ReactNode;
  /** Open the New form straight away, e.g. from a link that says what to create. */
  readonly startNew?: boolean;
  /** Other tabs beside the list (e.g. a delivery log); the list is the first, under `label`. */
  readonly tabs?: {
    readonly label: string;
    readonly others: readonly { value: string; label: string; content: ReactNode }[];
  };
}

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary data-[state=active]:border-primary data-[state=active]:text-ink';

export interface LifecycleText<T> {
  readonly menu: string;
  readonly title: (record: T) => string;
  readonly body: (record: T) => string;
}

type Pending<T> = { readonly kind: 'deactivate' | 'reactivate' | 'delete'; readonly record: T };

/**
 * The master page pattern (PROMPT §4.2, spec 10 §5): title and subtitle, KPI cards, a filter
 * bar, a server-paged list with "N of M", "Show deactivated" and export, New and edit in a
 * modal, deactivate / reactivate / delete with a reason, and each record's audit trail.
 * Every control follows the page's rights; the API enforces the same rights.
 */
export function MasterPage<T extends MasterRecord>({
  resource,
  title,
  subtitle,
  noun,
  columns,
  describe,
  form: Form,
  searchPlaceholder,
  filters,
  kpis,
  defaultSort,
  actions,
  status,
  lifecycle,
  lifecycleText,
  tabs,
  creatable = true,
  notice,
  editable,
  deletable,
  startNew = false,
}: MasterPageProps<T>) {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const has = (right: Right) => can(access, resource.pageKey, right);
  const { params, update, apiQuery } = useListParams(defaultSort ? { sort: defaultSort } : {});
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [...resource.queryKey, 'list', apiQuery],
    queryFn: () => resource.list(apiQuery),
    placeholderData: keepPreviousData,
  });
  const [editing, setEditing] = useState<{ record: T | null } | null>(() =>
    startNew && creatable && has('create') ? { record: null } : null,
  );
  const [pending, setPending] = useState<Pending<T> | null>(null);
  const [historyOf, setHistoryOf] = useState<T | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: resource.queryKey });
  const lifecycleOf = (row: T) =>
    lifecycle ? lifecycle(row) : row.isActive ? 'deactivate' : 'reactivate';

  const confirm = async (reason: string) => {
    if (!pending) return;
    const { kind, record } = pending;
    try {
      if (kind === 'deactivate') await resource.deactivate(record, reason);
      else if (kind === 'reactivate') await resource.reactivate(record, reason);
      else await resource.remove?.(record, reason);
    } catch (error) {
      // Someone else changed it: show the latest version so the user can decide again.
      if (error instanceof ApiError && error.status === 409) await refresh();
      throw error;
    }
    await refresh();
  };

  /** Excel and CSV; PDF joins with the PDF service in Phase 4 (ADR-0044). */
  const exportList = (format: ExportFormat) => {
    setExportError(null);
    downloadFile(`${resource.path}/export`, { ...toExportQuery(params), format }).catch(
      (error: unknown) => {
        setExportError(error instanceof Error ? error.message : t('masters.exportFailed'));
      },
    );
  };

  const allColumns: readonly Column<T>[] = [
    ...columns,
    {
      id: 'status',
      header: t('masters.status'),
      cell: (row) =>
        status ? (
          status(row)
        ) : row.isActive ? (
          <StatusPill tone="success">{t('masters.active')}</StatusPill>
        ) : (
          <StatusPill tone="neutral">{t('masters.deactivated')}</StatusPill>
        ),
    },
    {
      id: 'actions',
      header: t('masters.actions'),
      align: 'right',
      cell: (row) => (
        <RowActions
          label={t('masters.actionsFor', { record: describe(row) })}
          items={[
            has('edit') &&
              (editable?.(row) ?? true) && {
                label: t('masters.edit'),
                run: () => setEditing({ record: row }),
              },
            { label: t('masters.history'), run: () => setHistoryOf(row) },
            ...(actions?.(row) ?? []),
            ...(['deactivate', 'reactivate'] as const).map(
              (kind) =>
                has('deactivate') &&
                lifecycleOf(row) === kind && {
                  label: lifecycleText?.[kind]?.menu ?? t(`masters.${kind}`),
                  run: () => setPending({ kind, record: row }),
                },
            ),
            has('delete') &&
              resource.remove !== undefined &&
              (deletable?.(row) ?? true) && {
                label: t('masters.delete'),
                run: () => setPending({ kind: 'delete', record: row }),
              },
          ]}
        />
      ),
    },
  ];

  const pendingLabel = pending ? describe(pending.record) : '';
  const pendingText =
    pending && pending.kind !== 'delete' ? lifecycleText?.[pending.kind] : undefined;
  const activeFilters = Object.keys(params.filters).length;

  const listView = (
    <>
      {notice}
      {kpis}
      <FilterBar
        q={params.q}
        onQChange={(q) => update({ q })}
        {...(searchPlaceholder ? { placeholder: searchPlaceholder } : {})}
        activeCount={activeFilters}
        onClear={() => update({ q: '', filters: {} })}
      >
        {filters?.({ params, update })}
      </FilterBar>
      {list.isError && (
        <Banner tone="danger">
          {list.error instanceof Error ? list.error.message : t('masters.loadFailed')}
        </Banner>
      )}
      {exportError && <Banner tone="danger">{exportError}</Banner>}
      <DataTable
        caption={title}
        columns={allColumns}
        rows={list.data?.items}
        total={list.data?.total}
        rowKey={(row) => row.id}
        params={params}
        onParamsChange={update}
        loading={list.isFetching}
        deactivatedToggle
        exports={{ allowed: has('export'), formats: ['xlsx', 'csv'], onExport: exportList }}
        {...(has('edit')
          ? {
              onRowClick: (row: T) => {
                if (editable?.(row) ?? true) setEditing({ record: row });
              },
            }
          : {})}
      />
    </>
  );

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          creatable &&
          has('create') && (
            <Button onClick={() => setEditing({ record: null })}>
              <Plus className="size-[14px]" aria-hidden />
              {t('masters.new', { noun })}
            </Button>
          )
        }
      />
      {tabs ? (
        <Tabs.Root defaultValue="list" className="space-y-4">
          <Tabs.List className="flex gap-2 border-b border-border" aria-label={title}>
            <Tabs.Trigger value="list" className={TAB_CLASS}>
              {tabs.label}
            </Tabs.Trigger>
            {tabs.others.map((tab) => (
              <Tabs.Trigger key={tab.value} value={tab.value} className={TAB_CLASS}>
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="list" className="space-y-6">
            {listView}
          </Tabs.Content>
          {tabs.others.map((tab) => (
            <Tabs.Content key={tab.value} value={tab.value} className="space-y-4">
              {tab.content}
            </Tabs.Content>
          ))}
        </Tabs.Root>
      ) : (
        listView
      )}

      {editing && (
        <Form
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          record={editing.record}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={
          pending
            ? (pendingText?.title(pending.record) ??
              t(`masters.${pending.kind}Title`, { record: pendingLabel }))
            : ''
        }
        body={
          pending ? (pendingText?.body(pending.record) ?? t(`masters.${pending.kind}Body`)) : ''
        }
        confirmLabel={pending ? (pendingText?.menu ?? t(`masters.${pending.kind}`)) : ''}
        tone={pending?.kind === 'reactivate' ? 'primary' : 'danger'}
        onConfirm={confirm}
      />

      {historyOf && (
        <AuditTrailDrawer
          open
          onOpenChange={(open) => {
            if (!open) setHistoryOf(null);
          }}
          title={t('masters.historyOf', { record: describe(historyOf) })}
          queryKey={[...resource.queryKey, historyOf.id]}
          load={(cursor) => resource.history(historyOf.id, cursor)}
        />
      )}
    </section>
  );
}

export interface RowAction {
  readonly label: string;
  readonly run: () => void;
}

/** A row's actions in a menu; clicks stay out of the row's own click. */
export function RowActions({
  label,
  items,
}: {
  label: string;
  items: readonly (RowAction | false)[];
}) {
  const actions = items.filter((item): item is RowAction => item !== false);
  return (
    <div
      className="inline-flex"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" aria-label={label}>
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-40 rounded-lg border border-border bg-card p-1 shadow-overlay"
          >
            {actions.map((action) => (
              <DropdownMenu.Item
                key={action.label}
                onSelect={action.run}
                className="flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm text-ink-secondary outline-none data-[highlighted]:bg-surface-muted data-[highlighted]:text-ink"
              >
                {action.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
