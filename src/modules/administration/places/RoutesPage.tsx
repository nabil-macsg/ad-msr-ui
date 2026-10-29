import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Drawer } from '../../../shared/ui/drawer';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { Spinner } from '../../../shared/ui/spinner';
import { StatusPill } from '../../../shared/ui/status-pill';
import { MasterPage } from '../masters/master-page';
import { RouteForm } from './RouteForm';
import { categoryChoices, categoryText } from '../resources/resources-api';
import {
  type Route,
  routesResource,
  useRouteOptions,
  useRouteRevisions,
} from './places-api';

const describe = (r: Route) => `${r.code} · ${r.displayName}`;

/**
 * Routes (spec 10 §5.1, BRD D.3.1.3): origin, ordered stops and destination, with each leg's
 * great-circle distance. A changed path is a new revision; the earlier ones are kept.
 */
export default function RoutesPage() {
  const { t } = useTranslation();
  const options = useRouteOptions();
  const [revisionsOf, setRevisionsOf] = useState<Route | null>(null);

  return (
    <>
      <MasterPage
        resource={routesResource}
        title={t('places.routes.title')}
        subtitle={t('places.routes.subtitle')}
        noun={t('places.routes.noun')}
        searchPlaceholder={t('places.routes.search')}
        describe={describe}
        form={RouteForm}
        defaultSort={{ field: 'origin', dir: 'asc' }}
        columns={[
          {
            id: 'code',
            header: t('places.routes.columns.code'),
            sortField: 'code',
            cell: (r) => <span className="font-mono text-sm">{r.code}</span>,
          },
          {
            id: 'route',
            header: t('places.routes.columns.route'),
            sortField: 'origin',
            cell: (r) => (
              <div className="space-y-1">
                <p className="font-medium text-ink">{r.displayName}</p>
                {r.name && (
                  <p className="text-xs text-ink-secondary">
                    {r.points.map((p) => p.code).join(' → ')}
                  </p>
                )}
                {r.isExclusive && (
                  <StatusPill tone="accent">{t('places.routes.exclusive')}</StatusPill>
                )}
              </div>
            ),
          },
          {
            id: 'category',
            header: t('places.routes.columns.category'),
            sortField: 'category',
            cell: (r) => categoryText(t, r.resourceCategory, options.data?.categories),
          },
          {
            id: 'distance',
            header: t('places.routes.columns.distance'),
            align: 'right',
            cell: (r) =>
              r.distanceKm === null ? (
                <span className="inline-flex items-center gap-1 text-xs text-warning-fg">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {t('places.routes.noDistance')}
                </span>
              ) : (
                t('places.routes.km', { km: r.distanceKm.toFixed(1) })
              ),
          },
          {
            id: 'duration',
            header: t('places.routes.columns.duration'),
            align: 'right',
            cell: (r) =>
              r.durationMinutes === null
                ? '—'
                : t('places.routes.minutes', { n: r.durationMinutes }),
          },
          {
            id: 'team',
            header: t('places.routes.columns.team'),
            cell: (r) => r.owningTeam ?? '—',
          },
          {
            id: 'revision',
            header: t('places.routes.columns.revision'),
            align: 'right',
            cell: (r) => r.revision,
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
                label={t('places.routes.filters.category')}
                allLabel={t('ui.filter.all')}
                value={params.filters.category}
                options={categoryChoices(options.data?.categories)}
                onChange={(v) => set('category', v)}
              />
              <FilterSelect
                label={t('places.routes.filters.via')}
                allLabel={t('ui.filter.all')}
                value={params.filters.via}
                options={(options.data?.locations ?? []).map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
                onChange={(v) => set('via', v)}
              />
            </>
          );
        }}
        actions={(r) => [{ label: t('places.routes.revisions'), run: () => setRevisionsOf(r) }]}
      />
      {revisionsOf && (
        <RouteRevisions
          route={revisionsOf}
          onOpenChange={(open) => {
            if (!open) setRevisionsOf(null);
          }}
        />
      )}
    </>
  );
}

/** Every revision of a route's path, newest first. */
function RouteRevisions({
  route,
  onOpenChange,
}: {
  route: Route;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const revisions = useRouteRevisions(route.id);
  return (
    <Drawer
      open
      onOpenChange={onOpenChange}
      title={t('places.routes.revisionsOf', { record: describe(route) })}
    >
      {revisions.isPending && <Spinner label={t('loading')} />}
      {revisions.isError && <Banner tone="danger">{t('masters.loadFailed')}</Banner>}
      <ol className="space-y-3">
        {(revisions.data ?? []).map((r) => (
          <li key={r.revision} className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold text-ink">
              {t('places.routes.revision', { n: r.revision })}
            </p>
            <p className="text-sm text-ink">{r.points.map((p) => p.name).join(' → ')}</p>
            <p className="text-xs text-ink-secondary">
              {r.createdBy
                ? t('places.routes.revisionBy', { at: formatGst(r.createdAt), by: r.createdBy })
                : t('places.routes.revisionByUnknown', { at: formatGst(r.createdAt) })}
            </p>
          </li>
        ))}
      </ol>
    </Drawer>
  );
}
