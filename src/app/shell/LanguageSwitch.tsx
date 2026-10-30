import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** English ⇄ Arabic: a globe and the other language's own name, as Gulf sites show it. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const arabic = i18n.language === 'ar';
  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(arabic ? 'en' : 'ar')}
      aria-label={t('shell.switchLanguage')}
      title={t('shell.switchLanguage')}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-header-border px-3 text-on-header-muted transition-colors hover:border-primary/40 hover:bg-primary-subtle hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Globe className="size-4" aria-hidden />
      <span
        lang={arabic ? 'en' : 'ar'}
        className={arabic ? 'text-xs font-semibold' : 'text-sm leading-none font-semibold'}
      >
        {arabic ? 'English' : 'العربية'}
      </span>
    </button>
  );
}
