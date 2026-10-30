import { useState } from 'react';
import type { ListPage } from '../../modules/administration/masters/master-resource';
import { downloadFile } from '../../shared/lists/download';
import { Banner } from '../../shared/ui/banner';
import { POB_API, usePobQuery } from './pob-api';

/** Shared bits of the pob report screens (report, residence, builder, scheduler). */

export const REPORT_FORMATS = ['Excel', 'CSV', 'PDF'] as const;
export const FREQUENCIES = ['Daily', 'Weekly', 'Monthly'] as const;
export const RECIPIENTS = ['MC Control', 'Site Manager', 'Vice President'] as const;
export const CREW_TYPES = ['Resident', 'Contractor', 'Visitor'] as const;
export const EVAC_CATEGORIES = [
  'T1 - Essential Ops',
  'T2 - Non-Essential',
  'T3 - Visitor / Temp',
  'T4 - Medical',
] as const;
export const ZONES = ['Buhaser', 'Das', 'Ghasha', 'Other', 'Umm Shaif', 'Zakum'] as const;
/** The reporting sites in the POB report's order, named as in the Locations master. */
export const SITES = [
  'Das Island',
  'Zirku Island',
  'Upper Zakum',
  'Lower Zakum',
  'Umm Shaif',
  'ACPT',
  'NASR',
  'ABK',
  'Zirku Platform Z1',
  'Zirku Platform Z2',
  'Buhaser Field',
  'Ghasha Field',
  'Hail Field',
  'Umm Al Salsal Field',
  'Belbazem Field',
  'Satah Field',
  'Sarb Field',
  'Umm Al Dalkh',
  'Cosmo Field',
] as const;

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const formatNumber = (n: number | undefined) => (n ?? 0).toLocaleString('en');

export const searchOf = (query: Record<string, string | number | boolean>) =>
  new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();

/** A paged list from the pob reports mock API. */
export const useReportList = <T,>(path: string, query: Record<string, string | number | boolean>) =>
  usePobQuery<ListPage<T>>(`/reports/${path}?${searchOf(query)}`);

/** Downloads a report's CSV, and shows a failure in place. */
export function useReportExport() {
  const [error, setError] = useState<string | null>(null);
  const run = (path: string, query: Record<string, string | number | boolean> = {}) => {
    setError(null);
    downloadFile(`${POB_API}/reports/${path}`, query).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'The export failed.'),
    );
  };
  const banner = error ? <Banner tone="danger">{error}</Banner> : null;
  return { run, banner };
}

/** A saved-report definition as the Report Builder lists it. */
export interface ReportDefinitionRow {
  id: string;
  name: string;
  zone: string;
  asset: string;
  crewType: string;
  category: string;
  gender: string;
  format: (typeof REPORT_FORMATS)[number];
  isActive: boolean;
  includes: string;
  rowsToday: number;
  scheduled: string;
  scheduleCount: number;
}

export interface ReportScheduleRow {
  id: string;
  reportId: string;
  report: string;
  frequency: (typeof FREQUENCIES)[number];
  format: (typeof REPORT_FORMATS)[number];
  recipients: string[];
  isActive: boolean;
}

export const FREQUENCY_TEXT: Record<(typeof FREQUENCIES)[number], string> = {
  Daily: 'every morning',
  Weekly: 'every Monday morning',
  Monthly: 'on the first of the month',
};
