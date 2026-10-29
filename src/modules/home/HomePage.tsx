import { useTranslation } from 'react-i18next';
import { useMe } from '../../app/session/queries';
import { formatGstLongDay, gstDayKey } from '../../shared/time/format';
import { firstName } from '../../shared/time/gst';
import { Banner } from '../../shared/ui/banner';
import { Spinner } from '../../shared/ui/spinner';
import { useHome } from './home-api';
import { WIDGETS } from './widget-text';
import { ListWidget, StatWidget } from './widgets';

/**
 * Home (spec 10 §1.1): "Hello, ⟨name⟩", today's date and what is happening today for the
 * user's roles. Each role's widgets come from the API, which shows only what the user could
 * see on the pages they lead to; the operational modules add theirs in their phases.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const home = useHome();
  const roles = me?.roles.map((r) => r.name) ?? [];
  const as =
    roles.length === 0
      ? ''
      : roles.length === 1
        ? t('home.asRole', { role: roles[0] })
        : t('home.asRoles', { role: roles[0], count: roles.length - 1 });
  const widgets = (home.data?.widgets ?? []).filter((w) => WIDGETS[w.key] !== undefined);
  const stats = widgets.filter((w) => w.kind === 'stat');
  const lists = widgets.filter((w) => w.kind === 'list');

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="page-title" className="text-2xl font-bold text-ink">
          {me ? t('home.hello', { name: firstName(me.displayName) }) : t('loading')}
        </h1>
        <p className="text-sm text-ink-secondary">
          {formatGstLongDay(home.data?.today ?? gstDayKey(new Date()))}
          {as && ` · ${t('home.today', { as })}`}
        </p>
      </header>
      {home.isError && <Banner tone="danger">{t('home.loadFailed')}</Banner>}
      {home.isPending && <Spinner label={t('loading')} />}
      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((w) => (
            <StatWidget key={w.key} widget={w} />
          ))}
        </div>
      )}
      {lists.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((w) => (
            <ListWidget key={w.key} widget={w} />
          ))}
        </div>
      )}
      {home.isSuccess && widgets.length === 0 && (
        <p className="text-sm text-ink-secondary">{t('home.nothing')}</p>
      )}
    </section>
  );
}
