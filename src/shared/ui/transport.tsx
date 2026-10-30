import { Anchor, ArrowRight, Helicopter, Plane, Ship } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '../lib/cn';

type Mode = 'plane' | 'helicopter' | 'ship' | 'anchor';
/** Transport modes as the API and the demo name them. */
const MODE: Readonly<Record<string, Mode>> = {
  'fixed-wing': 'plane',
  'Fixed Wing': 'plane',
  'rotary-wing': 'helicopter',
  'Rotary Wing': 'helicopter',
  marine: 'ship',
  ferry: 'ship',
  Ferry: 'ship',
  'Vessel / Boat': 'ship',
  'crew-boat': 'anchor',
  'Crew Boat': 'anchor',
};

/** A transport mode's icon: plane, helicopter, ship or anchor. */
export function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  const cls = cn('size-3.5 shrink-0', className);
  switch (MODE[mode] ?? 'plane') {
    case 'helicopter':
      return <Helicopter className={cls} aria-hidden />;
    case 'ship':
      return <Ship className={cls} aria-hidden />;
    case 'anchor':
      return <Anchor className={cls} aria-hidden />;
    default:
      return <Plane className={cls} aria-hidden />;
  }
}

/** A mode with its icon, e.g. ✈ Fixed Wing. */
export function ModeLabel({
  mode,
  label,
  className,
}: {
  mode: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <ModeIcon mode={mode} className="text-ink-muted" />
      {label ?? mode}
    </span>
  );
}

/** A route's stops with arrows between them; takes stops or "A → B" text. */
export function RouteStops({
  stops,
  className,
}: {
  stops: readonly string[] | string;
  className?: string;
}) {
  const list = typeof stops === 'string' ? stops.split(/\s*→\s*/) : stops;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
      {list.map((stop, i) => (
        <Fragment key={`${stop}-${String(i)}`}>
          {i > 0 && <ArrowRight className="size-3.5 shrink-0 text-ink-muted" aria-label="to" />}
          <span>{stop}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** Seats taken against capacity: green with room, amber nearly full, red when full. */
export function SeatCount({ booked, capacity }: { booked: number; capacity: number | null }) {
  const pct = capacity ? booked / capacity : 0;
  const tone = !capacity
    ? 'text-ink'
    : pct >= 1
      ? 'text-danger-fg'
      : pct >= 0.85
        ? 'text-warning-fg'
        : 'text-success-fg';
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className={cn('text-base font-semibold', tone)}>{booked}</span>
      <span className="text-xs text-ink-muted"> / {capacity ?? '—'}</span>
    </span>
  );
}
