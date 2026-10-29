import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/cn';
import { TONE_TEXT, type Tone } from './tone';

export interface StatCardProps {
  readonly title: string;
  readonly value: ReactNode;
  /** The demo's sub-line, e.g. "3 gone · 5 still to go". */
  readonly subline?: ReactNode;
  readonly tone?: Tone;
  readonly icon?: ReactNode;
  /** Opens the list behind the number. */
  readonly to?: string;
}

/** A KPI card: title, big number, sub-line (PROMPT §4.2 page pattern). */
export function StatCard({ title, value, subline, tone, icon, to }: StatCardProps) {
  const body = (
    <>
      {/* The icon sits in the corner, so numbers line up across cards with and without one. */}
      {icon && (
        <span
          className={cn(
            'absolute top-3 right-3 flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary',
            tone && TONE_TEXT[tone],
          )}
        >
          {icon}
        </span>
      )}
      <p className={cn('text-label font-medium text-ink-secondary', icon && 'pr-10')}>{title}</p>
      <p
        className={cn(
          'mt-2 text-kpi leading-none font-semibold tracking-tight text-ink tabular-nums',
          tone && TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {subline && <p className="mt-2 text-xs text-ink-muted">{subline}</p>}
    </>
  );
  // h-full: cards in one grid row share a height.
  const box = 'relative block h-full rounded-xl border border-border bg-card p-4 transition-all';
  return to ? (
    <Link
      to={to}
      className={cn(
        box,
        'hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary',
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}
