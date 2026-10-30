import { lazy } from 'react';
import type { BuiltPages } from '../../app/pages/built-pages';

/** Demo core screens aligned with the original ADNOC LMS demo, by page key. */
export const CORE_PAGES: BuiltPages = {
  // The original's Dashboard: today's KPIs, flights, approvals and notifications.
  home: lazy(() => import('./DashboardPage')),
};
