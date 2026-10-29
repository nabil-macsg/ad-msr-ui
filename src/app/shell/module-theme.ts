import { matchPath } from 'react-router';
import { type ModuleKey, WEB_PAGES } from '../access/registry';

export type ShellModule = ModuleKey | 'shared';

/** Navigation colour scheme; tokens.css maps each to its sidebar colours. */
export type NavTheme = 'lms' | 'admin';

/**
 * Module → navigation theme, from the HTML reference: Administration has its own dark slate
 * chrome; every other module uses the ADNOC navy chrome.
 */
export const MODULE_NAV_THEME: Record<ShellModule, NavTheme> = {
  shared: 'lms',
  'people-logistics': 'lms',
  pob: 'lms',
  helideck: 'lms',
  'aviation-compliance': 'lms',
  reporting: 'lms',
  ai: 'lms',
  administration: 'admin',
};

// Static routes first, so "/booking/create" wins over "/booking/:ref".
const ROUTED = WEB_PAGES.filter((p) => p.route !== null).sort(
  (a, b) => Number((a.route ?? '').includes(':')) - Number((b.route ?? '').includes(':')),
);

/** The registry module that owns a path; "shared" when no page matches. */
export function moduleOfPath(pathname: string): ShellModule {
  const page = ROUTED.find((p) => matchPath({ path: p.route ?? '', end: true }, pathname));
  return page?.module ?? 'shared';
}
