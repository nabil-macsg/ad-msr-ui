import { lazy } from 'react';
import type { BuiltPages } from '../../app/pages/built-pages';

/** Demo admin screens aligned with the original ADNOC LMS demo, by page key. */
export const ADMIN_PAGES: BuiltPages = {
  'demo.admin-home': lazy(() => import('./AdminHomePage')),
  'admin.inspection-types': lazy(() => import('./InspectionTypesPage')),
  'admin.documentation-matrix': lazy(() => import('./DocumentationMatrixPage')),
};
