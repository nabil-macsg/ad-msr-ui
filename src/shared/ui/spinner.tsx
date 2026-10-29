import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FullScreenSpinner() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}

/** An inline loading indicator with its own accessible label. */
export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-ink-secondary" role="status">
      <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}
