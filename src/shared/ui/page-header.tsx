import type { ReactNode } from 'react';

/** The page pattern's opening (PROMPT §4.2): an H1, a one-line plain-English subtitle, actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 id="page-title" className="type-page-title text-ink">
          {title}
        </h1>
        <p className="type-intro mt-1.5 max-w-4xl text-ink-secondary">{subtitle}</p>
      </div>
      {actions && <div className="ms-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
