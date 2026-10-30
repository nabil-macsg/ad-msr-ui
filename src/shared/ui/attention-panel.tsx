import { ChevronDown, ChevronRight, type LucideIcon, TriangleAlert } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../lib/cn';
import { StatusPill } from './status-pill';
import { TONE_PILL, type Tone } from './tone';

export interface AttentionItem {
  readonly key: string;
  readonly icon: LucideIcon;
  readonly tone: Tone;
  readonly text: ReactNode;
  readonly detail?: ReactNode;
  readonly pill?: string;
  /** Opens the item: a page, or a handler such as a drawer. */
  readonly to?: string;
  readonly onClick?: () => void;
}

const HEAD_TONE = {
  warning: 'border-warning-border bg-warning-bg text-warning-fg',
  danger: 'border-danger-border bg-danger-bg text-danger-fg',
  info: 'border-info-border bg-info-bg text-info-fg',
} as const;
const BADGE_TONE: Record<keyof typeof HEAD_TONE, string> = {
  warning: 'bg-warning-fg',
  danger: 'bg-danger-fg',
  info: 'bg-info-fg',
};
const ROW = 'flex w-full items-center gap-3 px-4 py-3 text-start';
const ROW_LINK =
  'transition-colors hover:bg-table-row-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

/**
 * Things on a dashboard that need a look, as a collapsible panel: open, with the first few
 * listed and the rest behind "Show all".
 */
export function AttentionPanel({
  title,
  items,
  tone = 'warning',
  shown = 3,
}: {
  title: string;
  items: readonly AttentionItem[];
  tone?: keyof typeof HEAD_TONE;
  shown?: number;
}) {
  const { t } = useTranslation();
  const bodyId = useId();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const visible = all ? items : items.slice(0, shown);

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card', HEAD_TONE[tone])}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:brightness-[0.98] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
            HEAD_TONE[tone],
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card/70">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <span className="flex-1 text-sm font-semibold">{title}</span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold text-card tabular-nums',
              BADGE_TONE[tone],
            )}
          >
            {items.length}
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="bg-card">
          <ul className="divide-y divide-border">
            {visible.map((item) => {
              const body = (
                <>
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      TONE_PILL[item.tone],
                    )}
                  >
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{item.text}</span>
                    {item.detail && (
                      <span className="block text-xs text-ink-muted">{item.detail}</span>
                    )}
                  </span>
                  {item.pill && <StatusPill tone={item.tone}>{item.pill}</StatusPill>}
                  {(item.to ?? item.onClick) && (
                    <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                  )}
                </>
              );
              return (
                <li key={item.key}>
                  {item.to ? (
                    <Link to={item.to} className={cn(ROW, ROW_LINK)}>
                      {body}
                    </Link>
                  ) : item.onClick ? (
                    <button type="button" onClick={item.onClick} className={cn(ROW, ROW_LINK)}>
                      {body}
                    </button>
                  ) : (
                    <div className={ROW}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length > shown && (
            <button
              type="button"
              aria-expanded={all}
              onClick={() => setAll((a) => !a)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              {all
                ? t('ui.attention.showFewer')
                : t('ui.attention.showAll', { count: items.length })}
              <ChevronDown
                className={cn('size-4 transition-transform', all && 'rotate-180')}
                aria-hidden
              />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** A labelled row of KPI cards. */
export function KpiGroup({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <h2 className="text-xs font-semibold tracking-wider text-ink-secondary uppercase">{label}</h2>
      <div className={cn('grid gap-4', className)}>{children}</div>
    </div>
  );
}
