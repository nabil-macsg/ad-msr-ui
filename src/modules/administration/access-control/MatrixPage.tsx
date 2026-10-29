import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { DropdownMenu, Tabs } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ApiError } from '../../../api/errors';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { downloadFile } from '../../../shared/lists/download';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { EmptyState } from '../../../shared/ui/empty-state';
import { SelectField } from '../../../shared/ui/field';
import { PageHeader } from '../../../shared/ui/page-header';
import { Spinner } from '../../../shared/ui/spinner';
import { StatCard } from '../../../shared/ui/stat-card';
import { MatrixCapabilities } from './MatrixCapabilities';
import { MatrixHistory } from './MatrixHistory';
import { MatrixModules } from './MatrixModules';
import {
  MATRIX_KEY,
  type RoleMatrix,
  saveMatrix,
  useMatrixOptions,
  useRoleMatrix,
} from './matrix-api';
import { bodyOf, type Draft, draftOf, sameDraft } from './matrix-draft';

const TAB_CLASS =
  'min-h-touch border-b-2 border-transparent px-4 text-sm font-semibold text-ink-secondary data-[state=active]:border-primary data-[state=active]:text-ink';

type Notice = { tone: 'success' | 'danger'; text: string; reload?: boolean } | null;

/**
 * The Access Rights Matrix (spec 10 §2.3, BRD D.2.1.3): what each role holds, module by module
 * and page by page. Every save is a new version; it applies on everyone's next request.
 */
export default function MatrixPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useSearchParams();
  const roleId = search.get('role');
  const options = useMatrixOptions();
  const matrix = useRoleMatrix(roleId);
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<Notice>(null);

  const exportMatrix = (format: 'xlsx' | 'csv') => {
    downloadFile('/api/v1/access/access-rights/export', {
      format,
      ...(roleId ? { 'filter[role]': roleId } : {}),
    }).catch((error: unknown) => {
      setNotice({
        tone: 'danger',
        text: error instanceof Error ? error.message : t('masters.exportFailed'),
      });
    });
  };

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title={t('matrix.title')}
        subtitle={t('matrix.subtitle')}
        actions={
          can(access, 'admin.access-rights', 'export') && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="secondary">
                  <Download className="size-4" aria-hidden />
                  {t('ui.table.export')}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 min-w-40 rounded-md border border-border bg-card p-1 shadow-overlay"
                >
                  {(['xlsx', 'csv'] as const).map((format) => (
                    <DropdownMenu.Item
                      key={format}
                      onSelect={() => exportMatrix(format)}
                      className="flex min-h-10 cursor-pointer items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-surface-muted"
                    >
                      {t('ui.table.exportAs', { format: format === 'xlsx' ? 'Excel' : 'CSV' })}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )
        }
      />
      <div className="max-w-md">
        <SelectField
          label={t('matrix.role')}
          value={roleId ?? ''}
          onChange={(e) => {
            setNotice(null);
            setSearch(e.target.value ? { role: e.target.value } : {}, { replace: true });
          }}
        >
          <option value="">{t('matrix.chooseRole')}</option>
          {(options.data?.roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.isActive ? r.name : t('matrix.inactive', { name: r.name })}
            </option>
          ))}
        </SelectField>
      </div>
      <Banner tone="info">{t('matrix.rules')}</Banner>
      {notice && (
        <Banner tone={notice.tone}>
          {notice.text}{' '}
          {notice.reload && (
            <Button
              variant="link"
              onClick={() => {
                setNotice(null);
                void queryClient.invalidateQueries({ queryKey: MATRIX_KEY });
              }}
            >
              {t('matrix.reload')}
            </Button>
          )}
        </Banner>
      )}
      {!roleId && <EmptyState title={t('matrix.chooseRole')} />}
      {roleId && matrix.isPending && <Spinner label={t('loading')} />}
      {matrix.isError && <Banner tone="danger">{matrix.error.message}</Banner>}
      {roleId && matrix.data && matrix.data.role.id === roleId && (
        <RoleEditor
          // A new version (after a save, or a reload) starts a fresh draft.
          key={`${roleId}-${String(matrix.data.version)}`}
          matrix={matrix.data}
          locations={options.data?.locations ?? []}
          onNotice={setNotice}
        />
      )}
    </section>
  );
}

function RoleEditor({
  matrix,
  locations,
  onNotice,
}: {
  matrix: RoleMatrix;
  locations: readonly { id: string; code: string; name: string }[];
  onNotice: (notice: Notice) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [base] = useState(() => draftOf(matrix));
  const [draft, setDraft] = useState<Draft>(base);
  const [saving, setSaving] = useState(false);
  const dirty = !sameDraft(draft, base);
  const k = matrix.kpis;

  const save = async () => {
    setSaving(true);
    onNotice(null);
    try {
      const saved = await saveMatrix(matrix.role.id, matrix.version, bodyOf(draft));
      queryClient.setQueryData([...MATRIX_KEY, 'role', matrix.role.id], saved);
      void queryClient.invalidateQueries({ queryKey: [...MATRIX_KEY, 'versions'] });
      onNotice({ tone: 'success', text: t('matrix.saved', { version: saved.version }) });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        onNotice({ tone: 'danger', text: t('matrix.conflict'), reload: true });
      } else {
        onNotice({
          tone: 'danger',
          text: error instanceof Error ? error.message : t('ui.confirm.failed'),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title={t('matrix.kpi.modules')}
          value={k.modulesHeld}
          subline={t('matrix.kpi.modulesSub', { held: k.modulesHeld, total: k.modulesTotal })}
        />
        <StatCard title={t('matrix.kpi.view')} value={k.view} subline={t('matrix.kpi.pages')} />
        <StatCard title={t('matrix.kpi.edit')} value={k.edit} subline={t('matrix.kpi.pages')} />
        <StatCard title={t('matrix.kpi.export')} value={k.export} subline={t('matrix.kpi.pages')} />
      </div>
      {matrix.readOnlyReason && (
        <Banner tone="warning">{t(`matrix.readOnly.${matrix.readOnlyReason}`)}</Banner>
      )}
      <Tabs.Root defaultValue="pages" className="space-y-4">
        <Tabs.List className="flex gap-2 border-b border-border" aria-label={matrix.role.name}>
          <Tabs.Trigger value="pages" className={TAB_CLASS}>
            {t('matrix.tabs.pages')}
          </Tabs.Trigger>
          <Tabs.Trigger value="capabilities" className={TAB_CLASS}>
            {t('matrix.tabs.capabilities')}
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className={TAB_CLASS}>
            {t('matrix.tabs.history')}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="pages">
          <MatrixModules
            matrix={matrix}
            draft={draft}
            editable={matrix.editable}
            onChange={setDraft}
          />
        </Tabs.Content>
        <Tabs.Content value="capabilities">
          <MatrixCapabilities
            matrix={matrix}
            draft={draft}
            editable={matrix.editable}
            locations={locations}
            onChange={setDraft}
          />
        </Tabs.Content>
        <Tabs.Content value="history">
          <MatrixHistory roleId={matrix.role.id} />
        </Tabs.Content>
      </Tabs.Root>
      {dirty && (
        <div
          role="region"
          aria-label={t('matrix.unsaved')}
          className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-overlay"
        >
          <p className="font-medium text-ink">{t('matrix.unsaved')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDraft(base)}>
              {t('matrix.discard')}
            </Button>
            <Button disabled={saving} onClick={() => void save()}>
              {t('matrix.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
