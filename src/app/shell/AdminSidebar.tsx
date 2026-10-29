import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { adminMenu } from '../access/menu';
import { routeOf } from '../access/registry';
import { useMyAccess } from '../session/queries';
import { NAV_ICON, navLinkClass } from './nav-link-class';
import { Brand, Sections } from './Sidebar';

/** Administration's own sidebar, with "Back to MASAR" (PROMPT §4.2). */
export function AdminSidebar() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  return (
    <nav
      aria-label={t('shell.adminNavigation')}
      data-sidebar
      className="sticky top-[var(--preview-bar-h)] z-30 flex h-[calc(100vh-var(--preview-bar-h))] w-sidebar shrink-0 flex-col border-r border-nav-border bg-nav text-on-nav"
    >
      <Brand />
      <div className="shrink-0 px-2 pt-3">
        <NavLink to={routeOf('home')} end className={navLinkClass}>
          <ArrowLeft className={NAV_ICON} aria-hidden />
          {t('shell.backToMasar')}
        </NavLink>
        <p className="mt-3 px-3 text-caption font-semibold tracking-wider text-on-nav">
          {t('shell.administration').toUpperCase()}
        </p>
      </div>
      <div className="nav-scroll flex-1 overflow-y-auto px-2 pb-3">
        <Sections sections={adminMenu(access)} />
      </div>
    </nav>
  );
}
