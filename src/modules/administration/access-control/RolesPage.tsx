import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { can, routeOf } from '../../../app/access/registry';
import { useMe, useMyAccess } from '../../../app/session/queries';
import { Banner } from '../../../shared/ui/banner';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { MasterPage } from '../masters/master-page';
import { RoleForm } from './RoleForm';
import { ROLE_TYPES, rolesResource, SCOPE_LEVELS } from './roles-api';

/** Roles (spec 10 §2.2, BRD D.2.1.2). */
export default function RolesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: access } = useMyAccess();
  const { data: me } = useMe();
  // Nobody changes a role they hold; the API refuses it too (SELF_EDIT).
  const held = new Set(me?.roles.map((r) => r.code));
  return (
    <MasterPage
      resource={rolesResource}
      title={t('roles.title')}
      subtitle={t('roles.subtitle')}
      noun={t('roles.noun')}
      searchPlaceholder={t('roles.search')}
      describe={(r) => r.name}
      form={RoleForm}
      editable={(r) => !held.has(r.code)}
      defaultSort={{ field: 'name', dir: 'asc' }}
      kpis={<Banner tone="info">{t('roles.banner')}</Banner>}
      columns={[
        {
          id: 'role',
          header: t('roles.columns.role'),
          sortField: 'name',
          cell: (r) => (
            <div>
              <p className="flex items-center gap-1 font-medium text-ink">
                {r.name}
                {r.isLocked && (
                  <Lock className="size-3.5 text-ink-muted" aria-label={t('roles.lockedYes')} />
                )}
              </p>
              <p className="text-xs text-ink-secondary">{r.code}</p>
            </div>
          ),
        },
        {
          id: 'purpose',
          header: t('roles.columns.purpose'),
          className: 'max-w-80',
          cell: (r) => <span className="line-clamp-2 text-sm">{r.description}</span>,
        },
        {
          id: 'type',
          header: t('roles.columns.type'),
          sortField: 'type',
          cell: (r) => t(`roles.type.${r.type}`),
        },
        {
          id: 'scopeLevel',
          header: t('roles.columns.scopeLevel'),
          cell: (r) => t(`roles.scopeLevel.${r.scopeLevel}`),
        },
        {
          id: 'holders',
          header: t('roles.columns.holders'),
          sortField: 'holders',
          align: 'right',
          className: 'whitespace-nowrap',
          cell: (r) =>
            r.maxHolders === null
              ? r.holders
              : t('roles.holders', { holders: r.holders, max: r.maxHolders }),
        },
      ]}
      filters={({ params, update }) => {
        const set = (name: string, value: string | undefined) => {
          const rest = Object.fromEntries(
            Object.entries(params.filters).filter(([k]) => k !== name),
          );
          update({ filters: value ? { ...rest, [name]: value } : rest });
        };
        return (
          <>
            <FilterSelect
              label={t('roles.filters.type')}
              allLabel={t('ui.filter.all')}
              value={params.filters.type}
              options={ROLE_TYPES.map((v) => ({ value: v, label: t(`roles.type.${v}`) }))}
              onChange={(v) => set('type', v)}
            />
            <FilterSelect
              label={t('roles.filters.scopeLevel')}
              allLabel={t('ui.filter.all')}
              value={params.filters.scopeLevel}
              options={SCOPE_LEVELS.map((v) => ({ value: v, label: t(`roles.scopeLevel.${v}`) }))}
              onChange={(v) => set('scopeLevel', v)}
            />
          </>
        );
      }}
      actions={(r) => [
        can(access, 'admin.access-rights') && {
          label: t('roles.openMatrix'),
          run: () => void navigate(`${routeOf('admin.access-rights')}?role=${r.id}`),
        },
      ]}
    />
  );
}
