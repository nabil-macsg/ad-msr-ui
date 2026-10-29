import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '../shared/lib/cn';
import { BrandLogo } from '../shared/ui/brand-logo';
import { buttonVariants } from '../shared/ui/button-variants';

/** The demo's public front page: the name and the way in, nothing else. */
export function LandingPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-nav px-6 py-12 text-center text-on-nav">
      <BrandLogo on="dark" className="h-16 sm:h-20" />
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('demo.landing.title')}</h1>
      <Link
        to="/login"
        className={cn(
          buttonVariants(),
          'min-w-40 bg-nav-active text-nav-active-fg hover:bg-nav-hover',
        )}
      >
        {t('demo.landing.continue')}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </main>
  );
}
