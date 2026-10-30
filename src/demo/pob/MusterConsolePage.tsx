import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { Field, SelectField } from '../../shared/ui/field';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import {
  fieldErrorsOf,
  formatDateTime,
  messageOf,
  type MusterSummary,
  recordHeadcount,
  useLocationParam,
  useRefreshEmergency,
  useSite,
  useSites,
} from './emergency-api';
import { MusterRoster } from './emergency-roster';

export default function MusterConsolePage() {
  const sites = useSites();
  const [code, setCode] = useLocationParam(sites.data);
  const site = useSite(code);
  const [chosen, setChosen] = useState<{ code: string; point: string }>({ code: '', point: '' });
  const info = site.data;
  const muster = info?.muster ?? null;
  const point = chosen.code === code ? chosen.point : '';
  const current = muster?.points.find((p) => p.code === point);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Muster Console"
        subtitle="Record the headcount at one muster point, and tick people off the roster"
      />

      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 md:grid-cols-2">
        <SelectField label="Location" value={code} onChange={(e) => setCode(e.target.value)}>
          {sites.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Muster point"
          value={point}
          disabled={!muster}
          onChange={(e) => setChosen({ code, point: e.target.value })}
        >
          <option value="">— Select a muster point —</option>
          {info?.musterPoints.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </div>

      {site.error && <Banner tone="danger">{messageOf(site.error)}</Banner>}

      {info && !muster && (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-ink-muted">
          No muster is running at {info.name}. This console records a headcount during a declared
          muster — one is declared on{' '}
          <Link
            className="font-medium text-link hover:underline"
            to={`${routeOf('pob.emergency')}?location=${encodeURIComponent(info.code)}`}
          >
            Emergency Muster
          </Link>
          .
        </div>
      )}

      {muster && !current && (
        <Banner tone="warning" title={`Muster running since ${formatDateTime(muster.declaredAt)}`}>
          Choose your muster point to record its headcount and tick people off its roster.{' '}
          {muster.accounted} of {muster.frozen} accounted so far.
        </Banner>
      )}

      {muster && current && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Accounted here"
              value={current.accounted}
              subline={`${String(current.assigned)} assigned to this point`}
            />
            <StatCard
              title="Last headcount"
              value={current.headcount?.count ?? '—'}
              subline={
                current.headcount
                  ? `Recorded ${formatDateTime(current.headcount.recordedAt)}`
                  : 'Not recorded yet'
              }
            />
            <StatCard
              title="Accounted site-wide"
              value={`${String(muster.accounted)} / ${String(muster.frozen)}`}
              {...(muster.unaccounted === 0 ? { tone: 'success' as const } : {})}
            />
            <StatCard
              title="Unaccounted site-wide"
              value={muster.unaccounted}
              tone={muster.unaccounted > 0 ? 'danger' : 'success'}
            />
          </div>
          <HeadcountForm key={current.code} muster={muster} point={current.code} />
          <MusterRoster muster={muster} point={current.code} />
        </>
      )}
    </div>
  );
}

function HeadcountForm({ muster, point }: { muster: MusterSummary; point: string }) {
  const refresh = useRefreshEmergency();
  const [count, setCount] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = muster.points.find((p) => p.code === point)?.name ?? '';

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaved(null);
    if (count.trim() === '') {
      setError('Enter the number of people at the muster point');
      return;
    }
    setBusy(true);
    try {
      await recordHeadcount(muster.id, point, count.trim());
      setError(undefined);
      setSaved(`Headcount of ${count.trim()} recorded at ${name}.`);
      setCount('');
      await refresh();
    } catch (thrown) {
      setError(fieldErrorsOf(thrown).count ?? messageOf(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="text-base font-semibold text-ink">Record headcount</h2>
      {saved && <Banner tone="success">{saved}</Banner>}
      <div className="flex flex-wrap items-end gap-3">
        <Field
          className="w-64"
          label={`People counted at ${name}`}
          type="number"
          min={0}
          required
          value={count}
          error={error}
          onChange={(e) => setCount(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Record headcount
        </Button>
      </div>
    </form>
  );
}
