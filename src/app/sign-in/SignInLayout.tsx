import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../../shared/ui/brand-logo';
import { MODULES } from '../../api/registry.generated';

const CHIPS = MODULES.filter((m) => !['administration', 'ai'].includes(m.key));

/** The demo's split layout: brand on the left, the form on the right (PROMPT §4.4). */
export function SignInLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex flex-col justify-center gap-6 bg-nav px-10 py-12 text-on-nav lg:px-16">
        <div className="flex items-center gap-4">
          <BrandLogo on="dark" className="h-14" />
          <p className="text-sm font-semibold tracking-widest text-on-nav-muted uppercase">
            {t('appName')}
          </p>
        </div>
        <p className="max-w-lg text-3xl leading-tight font-bold">{t('signIn.strap')}</p>
        <ul className="flex max-w-lg flex-wrap gap-2" aria-label="Modules">
          {CHIPS.map((m) => (
            <li
              key={m.key}
              className="rounded-pill border border-nav-divider bg-nav-hover px-3 py-1 text-xs text-on-nav"
            >
              {m.label}
            </li>
          ))}
        </ul>
      </section>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
