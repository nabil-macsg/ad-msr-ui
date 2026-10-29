import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Provenance } from '../../../shared/ui/provenance-chip';
import type { Tone } from '../../../shared/ui/tone';
import type { ScopeSummary, UserSummary } from './users-api';

/** `2027-03-31` → `31 Mar 2027`: access days are GST calendar days. */
export const formatDay = (day: string): string => format(parseISO(day), 'd MMM yyyy');

export const STATUS_TONE: Record<UserSummary['status'], Tone> = {
  invited: 'info',
  active: 'success',
  deactivated: 'neutral',
};

export const PROVENANCE: Record<UserSummary['source'], Provenance> = {
  sap: 'sap',
  fieldglass: 'fieldglass',
  external_contact: 'contacts',
  manual_exception: 'manual',
};

/** A scope in words: "All locations", "Das Island, Zirku", "Own records". */
export function useScopeText(): (scope: ScopeSummary) => string {
  const { t } = useTranslation();
  return (scope) => {
    const parts = [
      scope.allLocations ? t('users.scope.allLocations') : null,
      ...scope.zones.map((z) => z.name),
      ...scope.locations.map((l) => l.name),
      scope.serviceProvider?.name ?? null,
      ...scope.departments.map((d) => d.name),
      scope.moduleKeys ? t('users.scope.modules', { modules: scope.moduleKeys.join(', ') }) : null,
      scope.self ? t('users.scope.self') : null,
      scope.lineManagerOf ? t('users.scope.lineManagerOf') : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(', ') : t('users.scope.none');
  };
}
