import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Page } from '../access/registry';

/** The demo's state for a page that is in scope but not delivered yet. */
export function NotBuiltYet({ page }: { page: Pick<Page, 'label' | 'heldBy'> }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <h1 id="page-title" className="text-xl font-semibold text-ink">
        {page.label}
      </h1>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <Construction className="size-10 text-ink-muted" aria-hidden />
        <p className="text-lg font-semibold text-ink">{t('notBuilt.title')}</p>
        <p className="max-w-prose text-sm text-ink-secondary">
          {page.heldBy ? t('notBuilt.held', { point: page.heldBy }) : t('notBuilt.body')}
        </p>
      </div>
    </section>
  );
}
