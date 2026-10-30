import { lazy } from 'react';
import type { BuiltPages } from '../../app/pages/built-pages';

/** Demo pob screens aligned with the original ADNOC LMS demo, by page key. */
export const POB_PAGES: BuiltPages = {
  // Live POB (owner: sites)
  'pob.dashboard': lazy(() => import('./DashboardPage')),
  'pob.map': lazy(() => import('./MapPage')),
  'pob.asset': lazy(() => import('./AssetPage')),
  // Overstay (owner: overstay)
  'pob.overstay': lazy(() => import('./OverstayPage')),
  // Records (owner: records)
  'pob.vessel-checkin': lazy(() => import('./VesselCheckinPage')),
  'pob.crew': lazy(() => import('./CrewPage')),
  'pob.location-override': lazy(() => import('./LocationOverridePage')),
  // Emergency (owner: emergency)
  'pob.emergency': lazy(() => import('./EmergencyPage')),
  'pob.muster-console': lazy(() => import('./MusterConsolePage')),
  'reports.evacuation': lazy(() => import('./EvacuationReportPage')),
  // Reports (owner: reports)
  'pob.report': lazy(() => import('./ReportPage')),
  'pob.residence': lazy(() => import('./ResidencePage')),
  'reports.builder': lazy(() => import('./ReportBuilderPage')),
  'reports.scheduler': lazy(() => import('./ReportSchedulerPage')),
  'reports.adnoc-pob': lazy(() => import('./AdnocPobReportPage')),
};
