import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../../shared/lib/cn';
import { StatCard } from '../../shared/ui/stat-card';
import { StatusPill } from '../../shared/ui/status-pill';
import type { HomeWidget } from './home-api';
import { WIDGETS } from './widget-text';

export function StatWidget({ widget }: { widget: HomeWidget }) {
  const { t } = useTranslation();
  const text = WIDGETS[widget.key];
  if (!text) return null;
  return (
    <StatCard
      title={text.title(t)}
      value={widget.failed ? '—' : (widget.value ?? '—')}
      subline={widget.failed ? t('home.failed') : text.subline?.(t, widget)}
      {...(widget.tone && !widget.failed ? { tone: widget.tone } : {})}
      {...(widget.link ? { to: widget.link } : {})}
    />
  );
}

export function ListWidget({ widget }: { widget: HomeWidget }) {
  const { t } = useTranslation();
  const text = WIDGETS[widget.key];
  if (!text) return null;
  const id = `widget-${widget.key.replace(/\W/g, '-')}`;
  let body: ReactNode;
  if (widget.failed) {
    body = <p className="text-sm text-ink-secondary">{t('home.failed')}</p>;
  } else if (widget.items.length === 0) {
    body = <p className="text-sm text-ink-secondary">{text.empty?.(t) ?? t('home.nothing')}</p>;
  } else {
    body = (
      <ul className="divide-y divide-border">
        {widget.items.map((item) => {
          const content = (
            <>
              {text.lead && (
                <span className="w-14 shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {text.lead(t, item)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                {item.detail && (
                  <p className="truncate text-xs text-ink-secondary">{item.detail}</p>
                )}
                {item.at && text.at && (
                  <p className="text-xs text-ink-muted">{text.at(t, item.at)}</p>
                )}
              </div>
              {item.status && (
                <StatusPill tone={item.tone ?? 'neutral'}>
                  {text.status?.(t, item.status) ?? item.status}
                </StatusPill>
              )}
            </>
          );
          const row = 'flex items-center gap-3 py-2';
          return (
            <li key={item.id}>
              {item.link ? (
                <Link to={item.link} className={cn(row, 'rounded-sm hover:bg-surface-muted')}>
                  {content}
                </Link>
              ) : (
                <div className={row}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-base font-semibold text-ink">
          {text.title(t)}
        </h2>
        {!widget.failed && widget.value !== null && (
          <span className="text-sm text-ink-secondary">
            {text.subline?.(t, widget)}
            {widget.link && (
              <>
                {' · '}
                <Link
                  to={widget.link}
                  className="font-medium text-link underline underline-offset-2 hover:no-underline"
                >
                  {t('home.open')}
                </Link>
              </>
            )}
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
