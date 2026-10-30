import { Pause, Play, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { runtimeConfig } from '../../app/config';
import { cn } from '../../shared/lib/cn';
import { Button } from '../../shared/ui/button';
import { buttonVariants } from '../../shared/ui/button-variants';
import { MapView } from '../../shared/ui/map-view';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';
import { TONE_DOT } from '../../shared/ui/tone';
import { capacityTone, statusTone, useSites, utilisation } from './sites-api';

const clock = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

/** POB Map View: every offshore site on the map, coloured by how full it is. */
export default function MapPage() {
  const { data: sites, refetch } = useSites();
  const [live, setLive] = useState(true);
  const [updated, setUpdated] = useState(clock);
  const [selected, setSelected] = useState<string | null>(null);
  const tiles = runtimeConfig().map;

  const refresh = () => {
    void refetch();
    setUpdated(clock());
  };
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      void refetch();
      setUpdated(clock());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [live, refetch]);

  const markers = useMemo(
    () =>
      (sites ?? []).map((s) => ({
        id: s.code,
        lat: s.lat,
        lng: s.lng,
        label: `${s.name} · ${String(s.pob)} POB (${String(utilisation(s))}%)`,
        tone: capacityTone(utilisation(s)),
      })),
    [sites],
  );
  const site = sites?.find((s) => s.code === selected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="POB Map View"
        subtitle="Geographic view of personnel on board across all offshore assets"
        actions={
          <>
            <span className="text-xs text-ink-muted" aria-live="polite">
              {live ? 'Refreshes every 30 seconds' : 'Auto-refresh paused'} · updated {updated}
            </span>
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw className="size-4" aria-hidden />
              Refresh
            </Button>
            <Button variant="secondary" aria-pressed={live} onClick={() => setLive((v) => !v)}>
              {live ? (
                <Play className="size-4" aria-hidden />
              ) : (
                <Pause className="size-4" aria-hidden />
              )}
              {live ? 'Live' : 'Paused'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <MapView
          markers={markers}
          tiles={{ url: tiles.tileUrl, attribution: tiles.attribution }}
          height={560}
          onSelect={setSelected}
        />
        <aside className="rounded-xl border border-border bg-card p-4">
          {site ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-ink">{site.name}</h2>
                  <p className="text-xs text-ink-muted">
                    {site.type} · {site.zoneName}
                  </p>
                </div>
                <StatusPill tone={statusTone(site.status)}>{site.status}</StatusPill>
              </div>
              <p className="text-kpi leading-none font-semibold text-ink">{site.pob}</p>
              <p className="text-xs text-ink-muted">
                {site.pob} / {site.limit} · POB Limit: {utilisation(site)}% utilization
              </p>
              <dl className="grid grid-cols-2 gap-1 text-xs text-ink-secondary">
                <div>Male {site.male}</div>
                <div>Female {site.female}</div>
                <div>Residents {site.residents}</div>
                <div>Visitors {site.visitors}</div>
                <div>↓ Arrived {site.arrivedToday}</div>
                <div>↑ Departed {site.departedToday}</div>
              </dl>
              <p className="text-xs text-ink-secondary">Conditions: {site.conditions}</p>
              <Link
                to={`${routeOf('pob.asset')}?location=${encodeURIComponent(site.code)}`}
                className={buttonVariants({ variant: 'primary', block: true })}
              >
                Open Asset Detail
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Select a marker to inspect a site.</p>
          )}
        </aside>
      </div>

      <ul className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
        {(
          [
            ['success', '< 70% capacity'],
            ['warning', '70–90% capacity'],
            ['danger', '> 90% capacity'],
          ] as const
        ).map(([tone, label]) => (
          <li key={tone} className="flex items-center gap-1.5">
            <span className={cn('size-3 rounded-full', TONE_DOT[tone])} aria-hidden />
            {label}
          </li>
        ))}
        <li className="text-ink-muted">Click any marker to inspect</li>
      </ul>
    </div>
  );
}
