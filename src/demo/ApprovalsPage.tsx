import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  CircleX,
  HardHat,
  type LucideIcon,
  Radar,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { routeOf } from '../app/access/registry';
import type { DemoRow } from '../mock/data/modules';
import { cn } from '../shared/lib/cn';
import { Banner } from '../shared/ui/banner';
import { Button } from '../shared/ui/button';
import { PageHeader } from '../shared/ui/page-header';
import { StatusPill } from '../shared/ui/status-pill';
import { TONE_PILL, type Tone } from '../shared/ui/tone';
import { ModeLabel, RouteStops } from '../shared/ui/transport';
import { changeBookingStatus, datasetKey, useDataset } from './demo-api';

type Tab = 'mine' | 'pending' | 'approved' | 'rejected';
const TABS: readonly { key: Tab; label: string; statuses: readonly string[] }[] = [
  { key: 'mine', label: 'My Approvals (Super Admin)', statuses: ['Pending approval'] },
  { key: 'pending', label: 'Pending', statuses: ['Pending approval'] },
  { key: 'approved', label: 'Approved', statuses: ['Confirmed', 'Checked in'] },
  { key: 'rejected', label: 'Rejected', statuses: ['Rejected', 'Cancelled'] },
];
const CATEGORY: Readonly<Record<string, { tone: Tone; icon: LucideIcon }>> = {
  'Direct Hire': { tone: 'info', icon: Users },
  Contractor: { tone: 'warning', icon: HardHat },
  'Essential Personnel': { tone: 'success', icon: Radar },
  VIP: { tone: 'accent', icon: Star },
  Visitor: { tone: 'neutral', icon: UserRound },
};
const STATUS_TONE: Readonly<Record<string, Tone>> = {
  'Pending approval': 'warning',
  Confirmed: 'success',
  'Checked in': 'success',
  Rejected: 'danger',
  Cancelled: 'danger',
};
const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
/** Contractors and visitors go through the aviation team as well. */
const chainOf = (row: DemoRow) =>
  ['Contractor', 'Visitor', 'VIP'].includes(str(row.category))
    ? ['Line Manager', 'Focal Point', 'Aviation Team']
    : ['Line Manager', 'Focal Point'];
const TH = 'px-4 py-3 text-start text-label font-bold text-on-table-head';
const SECTION = 'text-xs font-semibold tracking-wider text-ink-muted uppercase';

function CategoryPill({ category }: { category: unknown }) {
  const c = CATEGORY[str(category)] ?? { tone: 'neutral' as Tone, icon: UserRound };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_PILL[c.tone],
      )}
    >
      <c.icon className="size-3.5" aria-hidden />
      {str(category)}
    </span>
  );
}

function Expanded({ row }: { row: DemoRow }) {
  const chain = chainOf(row);
  const status = str(row.status);
  const done = status === 'Pending approval' ? 0 : chain.length;
  const rejected = status === 'Rejected' || status === 'Cancelled';
  return (
    <div className="grid gap-8 bg-surface-muted/40 px-6 py-5 lg:grid-cols-2">
      <section className="space-y-3">
        <h3 className={SECTION}>Journey Legs</h3>
        <p className="text-sm text-ink">
          Leg 1: {str(row.route)} ({str(row.mode)}) · {str(row.serviceDate)} {str(row.departs)}
        </p>
        <p className="font-mono text-xs text-ink-secondary">Charge Code: {str(row.chargeCode)}</p>
      </section>
      <section className="space-y-3">
        <h3 className={SECTION}>Approval Chain</h3>
        <ol className="space-y-2">
          {chain.map((stage, i) => {
            const state =
              rejected && i === 0
                ? 'Rejected'
                : i < done
                  ? 'Approved'
                  : i === done
                    ? 'Pending'
                    : 'Not Started';
            const tone: Tone =
              state === 'Approved'
                ? 'success'
                : state === 'Pending'
                  ? 'warning'
                  : state === 'Rejected'
                    ? 'danger'
                    : 'neutral';
            return (
              <li key={stage} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full border text-xs font-semibold',
                    TONE_PILL[tone],
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-ink">{stage}</span>
                <StatusPill tone={tone}>{state}</StatusPill>
                {state === 'Pending' && <span className="text-xs text-ink-muted">· SLA 24h</span>}
              </li>
            );
          })}
        </ol>
        <h3 className={cn(SECTION, 'pt-2')}>Approval History</h3>
        <p className="text-sm text-ink-muted italic">
          {status === 'Pending approval'
            ? 'No decisions recorded yet.'
            : `${rejected ? 'Rejected' : 'Approved'} by Super Admin.`}
        </p>
        <Link
          to={routeOf('booking.bookings')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          More detail — everything that has happened
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </section>
    </div>
  );
}

/** Booking Approvals: review, approve or reject travel requests, one by one or in bulk. */
export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const all = useDataset('bookings', { page: 1, pageSize: 500, sort: 'reference:desc' });
  const rows = all.data?.items ?? [];
  const statuses = TABS.find((t) => t.key === tab)?.statuses ?? [];
  const shown = rows.filter((r) => statuses.includes(str(r.status)));
  const fresh = new Set(rows.slice(0, 6).map((r) => r.id));
  const count = (key: Tab) =>
    rows.filter((r) => TABS.find((t) => t.key === key)?.statuses.includes(str(r.status))).length;
  const pendingTab = tab === 'mine' || tab === 'pending';

  const decide = async (ids: readonly string[], status: 'Confirmed' | 'Rejected') => {
    setBusy(true);
    setFailure(null);
    try {
      for (const id of ids) await changeBookingStatus(id, status);
      setPicked(new Set());
      await queryClient.invalidateQueries({ queryKey: datasetKey('bookings') });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The decision could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));

  return (
    <div className="space-y-5">
      <PageHeader title="Booking Approvals" subtitle="Review and approve pending travel requests" />

      <div
        role="group"
        aria-label="Approvals"
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface-muted p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setPicked(new Set());
              setOpen(null);
            }}
            className="inline-flex min-h-touch shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium whitespace-nowrap text-ink-secondary transition-all hover:text-ink aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-primary aria-pressed:shadow-raised"
          >
            {t.label}
            <span className="rounded-full bg-card px-2 py-0.5 text-2xs font-semibold text-ink-secondary tabular-nums">
              {count(t.key)}
            </span>
          </button>
        ))}
      </div>

      {failure && <Banner tone="danger">{failure}</Banner>}
      {pendingTab && picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary-subtle px-4 py-2.5 text-sm">
          <span className="font-semibold text-ink">{picked.size} selected</span>
          <Button disabled={busy} onClick={() => void decide([...picked], 'Confirmed')}>
            <CircleCheck className="size-4" aria-hidden />
            Approve
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void decide([...picked], 'Rejected')}
          >
            <CircleX className="size-4" aria-hidden />
            Reject
          </Button>
          <button
            type="button"
            className="ms-auto text-xs font-semibold text-primary hover:underline"
            onClick={() => setPicked(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <caption className="sr-only">Booking approvals</caption>
            <thead>
              <tr className="border-b border-border bg-table-head">
                <th scope="col" className="w-12 px-4 py-3">
                  {pendingTab && (
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      className="size-4 accent-primary"
                      checked={allPicked}
                      onChange={() =>
                        setPicked(allPicked ? new Set() : new Set(shown.map((r) => r.id)))
                      }
                    />
                  )}
                </th>
                {[
                  'Booking ID',
                  'Passenger',
                  'Company',
                  'Route',
                  'Travel Date',
                  'Category',
                  'Status',
                ].map((h) => (
                  <th key={h} scope="col" className={TH}>
                    {h}
                  </th>
                ))}
                <th scope="col" className={TH}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {all.isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-ink-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!all.isLoading && shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-ink-muted">
                    Nothing here.
                  </td>
                </tr>
              )}
              {shown.map((r) => {
                const chain = chainOf(r);
                const expanded = open === r.id;
                const pending = str(r.status) === 'Pending approval';
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={cn(
                        'border-b border-border/60 transition-colors hover:bg-table-row-hover',
                        expanded && 'bg-table-row-hover',
                      )}
                    >
                      <td className="px-4 py-3">
                        {pendingTab && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${str(r.reference)}`}
                            className="size-4 accent-primary"
                            checked={picked.has(r.id)}
                            onChange={() => toggle(r.id)}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-ink-secondary">
                          {str(r.reference)}
                        </span>
                        {fresh.has(r.id) && (
                          <span className="ms-2 rounded bg-success-fg px-1.5 py-0.5 text-2xs font-bold text-on-primary">
                            NEW
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{str(r.passenger)}</td>
                      <td className="px-4 py-3 text-ink-secondary">{str(r.company)}</td>
                      <td className="px-4 py-3 text-ink">
                        <RouteStops stops={str(r.route)} />
                        <ModeLabel mode={str(r.mode)} className="mt-0.5 text-xs text-ink-muted" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink tabular-nums">
                        {str(r.serviceDate)}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryPill category={r.category} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={STATUS_TONE[str(r.status)] ?? 'neutral'}>
                          {pending ? 'Pending' : str(r.status)}
                        </StatusPill>
                        {pending && (
                          <p className="mt-1 text-xs whitespace-nowrap text-warning-fg">
                            Stage 1 of {chain.length} — {chain[0]}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {pending && (
                            <>
                              <button
                                type="button"
                                aria-label={`Approve ${str(r.reference)}`}
                                title="Approve"
                                disabled={busy}
                                onClick={() => void decide([r.id], 'Confirmed')}
                                className="rounded-full p-1.5 text-success-fg transition-colors hover:bg-success-bg disabled:opacity-50"
                              >
                                <CircleCheck className="size-5" aria-hidden />
                              </button>
                              <button
                                type="button"
                                aria-label={`Reject ${str(r.reference)}`}
                                title="Reject"
                                disabled={busy}
                                onClick={() => void decide([r.id], 'Rejected')}
                                className="rounded-full p-1.5 text-danger-fg transition-colors hover:bg-danger-bg disabled:opacity-50"
                              >
                                <CircleX className="size-5" aria-hidden />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={`Details of ${str(r.reference)}`}
                            onClick={() => setOpen(expanded ? null : r.id)}
                            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                          >
                            <ChevronDown
                              className={cn(
                                'size-4 transition-transform',
                                expanded && 'rotate-180',
                              )}
                              aria-hidden
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border/60">
                        <td colSpan={9} className="p-0">
                          <Expanded row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
