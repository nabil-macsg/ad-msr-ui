import { FileText, Siren } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { Banner } from '../../shared/ui/banner';
import { Button } from '../../shared/ui/button';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';
import { Field, SelectField } from '../../shared/ui/field';
import { Modal, ModalFooter } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatCard } from '../../shared/ui/stat-card';
import {
  declareMuster,
  fieldErrorsOf,
  formatDateTime,
  messageOf,
  type MusterSummary,
  type SiteStatus,
  standDown,
  useLocationParam,
  useRefreshEmergency,
  useSite,
  useSites,
} from './emergency-api';
import { MusterRoster } from './emergency-roster';

const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function EmergencyPage() {
  const sites = useSites();
  const [code, setCode] = useLocationParam(sites.data);
  const site = useSite(code);
  const refresh = useRefreshEmergency();
  const [declaring, setDeclaring] = useState(false);
  const [standingDown, setStandingDown] = useState(false);
  const info = site.data;
  const muster = info?.muster ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Muster"
        subtitle="Personnel accounting and evacuation status during a declared muster"
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link to={routeOf('reports.evacuation')}>
                <FileText className="size-4" aria-hidden />
                Evacuation report
              </Link>
            </Button>
            {muster ? (
              <Button
                className="bg-danger hover:bg-danger-fg"
                onClick={() => setStandingDown(true)}
              >
                Stand down muster
              </Button>
            ) : (
              <Button disabled={!info} onClick={() => setDeclaring(true)}>
                <Siren className="size-4" aria-hidden />
                Declare muster
              </Button>
            )}
          </>
        }
      />

      <div className="max-w-sm">
        <SelectField label="Location" value={code} onChange={(e) => setCode(e.target.value)}>
          {sites.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </div>

      {site.error && <Banner tone="danger">{messageOf(site.error)}</Banner>}
      {info && (muster ? <Running info={info} muster={muster} /> : <Idle info={info} />)}
      {info && <Kpis info={info} muster={muster} />}
      {info && muster && <MusterPoints muster={muster} />}
      {muster && <MusterRoster key={muster.id} muster={muster} />}

      {info && (
        <DeclareModal
          open={declaring}
          onOpenChange={setDeclaring}
          info={info}
          onDeclared={() => void refresh()}
        />
      )}
      {muster && info && (
        <ConfirmDialog
          open={standingDown}
          onOpenChange={setStandingDown}
          title="Stand down the muster"
          body={`Ends the muster at ${info.name}. ${String(muster.unaccounted)} of ${String(muster.frozen)} people are still unaccounted.`}
          confirmLabel="Stand down"
          onConfirm={async (reason) => {
            await standDown(muster.id, reason);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function Idle({ info }: { info: SiteStatus }) {
  return (
    <p className="text-sm text-ink-secondary">
      No muster is running. Declaring one freezes the {info.onSite} people on the deck at that
      moment;{' '}
      {info.aboardVessels > 0 &&
        `the ${String(info.aboardVessels)} aboard vessels are not expected on it, and `}
      anybody arriving afterwards is not on it either.
    </p>
  );
}

function Running({ info, muster }: { info: SiteStatus; muster: MusterSummary }) {
  return (
    <Banner
      tone="danger"
      title={`Muster running at ${info.name} since ${formatDateTime(muster.declaredAt)}`}
      action={
        <Button variant="secondary" asChild>
          <Link to={`${routeOf('pob.muster-console')}?location=${encodeURIComponent(info.code)}`}>
            Open Muster Console
          </Link>
        </Button>
      }
    >
      {muster.accounted} of {muster.frozen} people on the frozen list accounted for;{' '}
      {muster.unaccounted} still to find. People arriving after the declaration are not on it.
    </Banner>
  );
}

function Kpis({ info, muster }: { info: SiteStatus; muster: MusterSummary | null }) {
  const boats = info.lifeboats;
  const heldBack =
    boats && boats.heldBack > 0
      ? `${boats.heldBack === 1 ? 'One boat' : `${String(boats.heldBack)} boats`} held back`
      : 'All boats in service';
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="POB being evacuated"
        value={muster ? muster.frozen : info.onSite}
        subline={muster ? 'Frozen at the declaration' : 'On the deck right now'}
      />
      <StatCard
        title="Total accounted"
        value={muster?.accounted ?? 0}
        subline="Named against the frozen list"
        {...(muster && muster.unaccounted === 0 ? { tone: 'success' as const } : {})}
      />
      <StatCard
        title="Unaccounted"
        value={muster ? muster.unaccounted : info.onSite}
        subline="POB minus accounted"
        {...(muster && muster.unaccounted > 0 ? { tone: 'danger' as const } : {})}
      />
      <StatCard
        title="Lifeboat capacity"
        value={boats ? boats.capacity : 'Not recorded'}
        {...(boats && !boats.enough ? { tone: 'danger' as const } : {})}
        subline={
          boats
            ? `${heldBack} — ${boats.enough ? 'enough for everybody' : 'not enough for everybody'}`
            : 'No lifeboats recorded for this location'
        }
      />
    </div>
  );
}

function MusterPoints({ muster }: { muster: MusterSummary }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="mp-title">
      <h2 id="mp-title" className="text-base font-semibold text-ink">
        Muster points
      </h2>
      <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {muster.points.map((p) => {
          const pct = p.assigned === 0 ? 0 : Math.min(100, (p.accounted / p.assigned) * 100);
          return (
            <li key={p.code} className="rounded-lg border border-border p-4">
              <p className="text-sm font-medium text-ink">{p.name}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {p.accounted} accounted of {p.assigned} assigned
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${String(pct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-secondary">
                {p.headcount
                  ? `Headcount ${String(p.headcount.count)} at ${formatDateTime(p.headcount.recordedAt)}`
                  : 'No headcount recorded yet'}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DeclareModal({
  open,
  onOpenChange,
  info,
  onDeclared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: SiteStatus;
  onDeclared: () => void;
}) {
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (next: boolean) => {
    if (next) {
      setDate(today());
      setTime(nowTime());
    }
    setErrors({});
    setFailure(null);
    onOpenChange(next);
  };

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    if (!date) missing.date = 'Enter the date of the muster';
    if (!time) missing.time = 'Enter the time of the muster';
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    setBusy(true);
    setFailure(null);
    try {
      await declareMuster(info.code, date, time);
      onDeclared();
      change(false);
    } catch (thrown) {
      const fields = fieldErrorsOf(thrown);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFailure(messageOf(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={change} title="Declare a muster" size="sm">
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        {failure && <Banner tone="danger">{failure}</Banner>}
        <p className="text-sm text-ink-secondary">
          This freezes the <strong className="text-ink">{info.onSite}</strong> people on the deck at{' '}
          {info.name} as the list to account for. Anybody who arrives after this moment is not on
          it.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Date"
            type="date"
            required
            max={today()}
            value={date}
            error={errors.date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            label="Time"
            type="time"
            required
            value={time}
            error={errors.time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Declare muster
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
