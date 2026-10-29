import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '../../shared/ui/button-variants';
import { routeOf } from '../access/registry';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">{t('notFound.title')}</h1>
      <p className="text-ink-secondary">{t('notFound.body')}</p>
      <Link to={routeOf('home')} className={buttonVariants({ variant: 'secondary' })}>
        {t('notFound.home')}
      </Link>
    </section>
  );
}
