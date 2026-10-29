import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { DonutChart } from '../../../shared/ui/donut-chart';
import { Spinner } from '../../../shared/ui/spinner';
import { StatCard } from '../../../shared/ui/stat-card';
import { formatDay } from './user-text';
import { useUserAnalytics } from './users-api';

/** Usage analytics (spec 10 §2.1): sign-ins per day, active users, last sign-in, access ending. */
export function UsageAnalytics() {
  const { t } = useTranslation();
  const analytics = useUserAnalytics(true);
  if (!analytics.data) return <Spinner label={t('loading')} />;
  const a = analytics.data;
  const total = a.signInsPerDay.reduce((sum, d) => sum + d.signIns, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={t('users.analytics.activeUsers')}
          value={a.activeUsers}
          subline={t('users.analytics.activeUsersSub')}
        />
        <section
          aria-labelledby="sign-ins"
          className="rounded-lg border border-border bg-card p-5 shadow-card md:col-span-2"
        >
          <h3 id="sign-ins" className="text-sm font-medium text-ink-secondary">
            {t('users.analytics.signIns')}
          </h3>
          <figure role="img" aria-label={t('users.analytics.signInsSummary', { total })}>
            <BarChart width={560} height={160} data={[...a.signInsPerDay]}>
              <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(8)} fontSize={11} />
              <YAxis allowDecimals={false} width={28} fontSize={11} />
              <Bar dataKey="signIns" fill="var(--color-primary)" isAnimationActive={false} />
            </BarChart>
          </figure>
          <p className="text-sm text-ink-secondary">
            {t('users.analytics.signInsSummary', { total })}
          </p>
        </section>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5 shadow-card">
          <DonutChart
            title={t('users.analytics.lastSignIn')}
            slices={[
              {
                label: t('users.analytics.within7Days'),
                value: a.lastSignIn.within7Days,
                tone: 'success',
              },
              {
                label: t('users.analytics.within30Days'),
                value: a.lastSignIn.within30Days,
                tone: 'info',
              },
              {
                label: t('users.analytics.within90Days'),
                value: a.lastSignIn.within90Days,
                tone: 'warning',
              },
              { label: t('users.analytics.older'), value: a.lastSignIn.older, tone: 'danger' },
              { label: t('users.analytics.never'), value: a.lastSignIn.never, tone: 'neutral' },
            ]}
          />
        </section>
        <section
          aria-labelledby="expiring"
          className="rounded-lg border border-border bg-card p-5 shadow-card"
        >
          <h3 id="expiring" className="mb-2 text-base font-semibold text-ink">
            {t('users.analytics.expiring')}
          </h3>
          {a.expiring.length === 0 ? (
            <p className="text-sm text-ink-secondary">{t('users.analytics.expiringNone')}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {a.expiring.map((e) => (
                <li key={`${e.userId}-${e.role}`} className="flex justify-between gap-2 py-2">
                  <span className="text-ink">
                    {e.displayName} · {e.role}
                  </span>
                  <span className="text-ink-secondary">
                    {t('users.analytics.until', { day: formatDay(e.validUntil) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
