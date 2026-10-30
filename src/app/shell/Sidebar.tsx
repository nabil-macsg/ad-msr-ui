import { ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { NAV_AR } from '../../i18n/ar/nav';
import { cn } from '../../shared/lib/cn';
import { BrandLogo } from '../../shared/ui/brand-logo';
import { useAuth } from '../auth/auth-context';
import { mainMenu, type MenuGroup, type MenuItem, type MenuSection } from '../access/menu';
import { useMyAccess } from '../session/queries';
import { NAV_ICON, navLinkClass } from './nav-link-class';

/** A menu name in the current language: Arabic from NAV_AR, English as written. */
export function useNavLabel() {
  const { i18n } = useTranslation();
  return (label: string) => (i18n.language === 'ar' ? (NAV_AR[label] ?? label) : label);
}

export function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-nav-divider px-5 py-4">
      <BrandLogo on="dark" className="h-9" />
      <div className="border-s border-nav-divider ps-3">
        <p className="text-sm leading-tight font-semibold text-on-nav">{t('appName')}</p>
        <p className="text-2xs leading-tight text-on-nav-subtle">{t('appStrap')}</p>
      </div>
    </div>
  );
}

export function Sections({ sections }: { sections: readonly MenuSection[] }) {
  const navLabel = useNavLabel();
  return sections.map((section) => (
    <div key={section.area} className="mb-2">
      <p className="px-3 pt-3 pb-1 text-2xs font-semibold tracking-wider text-on-nav-subtle uppercase">
        {navLabel(section.area)}
      </p>
      <ul>
        {section.items.map((entry: MenuItem) => {
          const Icon = entry.icon;
          // As in the reference: a label that wraps keeps its icon beside the first line.
          return (
            <li key={entry.key}>
              <NavLink to={entry.route} end className={(s) => cn(navLinkClass(s), 'items-start')}>
                <Icon className={cn(NAV_ICON, 'mt-px')} aria-hidden />
                <span className="flex-1">{navLabel(entry.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

function Group({ group }: { group: MenuGroup }) {
  const navLabel = useNavLabel();
  const [open, setOpen] = useState(true);
  const id = `nav-${group.label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const Icon = group.icon;
  return (
    <li className="pt-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-caption font-semibold tracking-wider uppercase transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-nav',
          open ? 'text-on-nav' : 'text-on-nav-muted hover:text-on-nav',
        )}
      >
        <Icon className={NAV_ICON} aria-hidden />
        <span className="flex-1">{navLabel(group.label)}</span>
        <ChevronDown
          className={cn(
            'size-[13px] shrink-0 text-nav-control transition-transform',
            !open && '-rotate-90',
          )}
          aria-hidden
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className="mt-0.5 mb-2 ms-[18px] rounded-e-md border-s border-nav-divider bg-nav-sub ps-1.5"
      >
        <Sections sections={group.sections} />
      </div>
    </li>
  );
}

/** The navy sidebar, generated from the registry and the user's view rights (PROMPT §4.2). */
export function Sidebar() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const { logout } = useAuth();
  const navLabel = useNavLabel();
  const menu = mainMenu(access);
  return (
    <nav
      aria-label={t('shell.mainNavigation')}
      data-sidebar
      className="sticky top-[var(--preview-bar-h)] z-30 flex h-[calc(100vh-var(--preview-bar-h))] w-sidebar shrink-0 flex-col border-e border-nav-border bg-nav text-on-nav"
    >
      <Brand />
      <div className="nav-scroll flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {menu.home && (
          <NavLink to={menu.home.route} end className={navLinkClass}>
            <menu.home.icon className={NAV_ICON} aria-hidden />
            {navLabel(menu.home.label)}
          </NavLink>
        )}
        <ul>
          {menu.groups.map((group) => (
            <Group key={group.label} group={group} />
          ))}
        </ul>
      </div>
      <div className="shrink-0 space-y-0.5 border-t border-nav-divider px-2 pt-1 pb-2">
        {menu.administration && (
          <NavLink to={menu.administration.route} className={navLinkClass}>
            <menu.administration.icon className={NAV_ICON} aria-hidden />
            {t('shell.administration')}
          </NavLink>
        )}
        {menu.support && (
          <NavLink to={menu.support.route} className={navLinkClass}>
            <menu.support.icon className={NAV_ICON} aria-hidden />
            {navLabel(menu.support.label)}
          </NavLink>
        )}
        <button type="button" onClick={logout} className={navLinkClass({ isActive: false })}>
          <LogOut className={NAV_ICON} aria-hidden />
          {t('shell.signOut')}
        </button>
      </div>
      <p className="shrink-0 border-t border-nav-divider px-5 py-3 text-2xs leading-relaxed text-on-nav-subtle">
        {t('footer')}
      </p>
    </nav>
  );
}
