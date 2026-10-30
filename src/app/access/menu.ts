import type { LucideIcon } from 'lucide-react';
import {
  NAV_ADMIN,
  NAV_ADMINISTRATION,
  NAV_GROUPS,
  NAV_HOME,
  NAV_SUPPORT,
  type NavItem,
  type NavSection,
} from './demo-nav';
import { type MyAccess, can, routeOf } from './registry';

export interface MenuItem {
  readonly key: NavItem['key'];
  readonly label: string;
  readonly route: string;
  readonly icon: LucideIcon;
}
export interface MenuSection {
  readonly area: string;
  readonly items: readonly MenuItem[];
}
export interface MenuGroup {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly sections: readonly MenuSection[];
}

const item = (n: NavItem): MenuItem => ({
  key: n.key,
  label: n.label,
  route: routeOf(n.key),
  icon: n.icon,
});

/** A menu entry, if the user may view its page. */
const visible = (access: MyAccess | undefined, n: NavItem): MenuItem | null =>
  can(access, n.key) ? item(n) : null;

function sections(access: MyAccess | undefined, nav: readonly NavSection[]): MenuSection[] {
  return nav.flatMap((s): MenuSection[] => {
    const items = s.items.flatMap((n) => visible(access, n) ?? []);
    return items.length > 0 ? [{ area: s.label, items }] : [];
  });
}

export interface MainMenu {
  readonly home: MenuItem | null;
  readonly groups: readonly MenuGroup[];
  readonly support: MenuItem | null;
  /** The administration landing page, or the first administration page this user may open. */
  readonly administration: MenuItem | null;
}

/** The main sidebar: the original demo's menu (demo-nav.ts), filtered by view rights. */
export function mainMenu(access: MyAccess | undefined): MainMenu {
  const groups = NAV_GROUPS.flatMap((g): MenuGroup[] => {
    const s = sections(access, g.sections);
    return s.length > 0 ? [{ label: g.label, icon: g.icon, sections: s }] : [];
  });
  return {
    home: visible(access, NAV_HOME),
    groups,
    support: visible(access, NAV_SUPPORT),
    administration: visible(access, NAV_ADMINISTRATION) ?? adminMenu(access)[0]?.items[0] ?? null,
  };
}

/** The administration sidebar: its own groups, then "Back". */
export function adminMenu(access: MyAccess | undefined): MenuSection[] {
  return sections(access, NAV_ADMIN);
}
