import { Monitor } from 'lucide-react';
import { type ReactNode, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

/** Desktop and tablet only: 768 px and wider (PROMPT §1.2, §4.2). */
export const WIDE_ENOUGH = '(min-width: 768px)';

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export function ViewportGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  if (useMediaQuery(WIDE_ENOUGH)) return children;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-nav px-8 text-center text-on-nav">
      <Monitor className="size-12 text-on-nav-muted" aria-hidden />
      <p className="text-2xl font-bold">{t('appName')}</p>
      <p className="max-w-sm text-base">{t('narrowViewport')}</p>
    </main>
  );
}
