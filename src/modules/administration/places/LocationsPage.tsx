import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { Banner } from '../../../shared/ui/banner';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import { MasterPage } from '../masters/master-page';
import { LocationForm } from './LocationForm';
import { formatGstDate } from '../../../shared/time/format';
import { CoordinatesCell, ServiceCell, ServiceabilityDialog } from './place-bits';
import {
  type Location,
  LOCATIONS_KEY,
  locationsResource,
  setLocationServiceability,
  syncLocationCoordinates,
  useLocationOptions,
  useAffectedJourneys,
} from './places-api';

const describe = (l: Location) => `${l.code} · ${l.name}`;

/**
 * Locations (spec 10 §5.1, BRD D.3.1.1): sites and their sub-locations, with coordinates VIA GIS
 * or by hand, POB limit, flags and focal point. Taking one out of service publishes the event
 * on which its journeys and bookings are cancelled.
 */
export default function LocationsPage() {
  const { t } = useTranslation();
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const options = useLocationOptions();
  const [serviceOf, setServiceOf] = useState<Location | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const canEdit = can(access, 'admin.locations', 'edit');
  const refresh = () => queryClient.invalidateQueries({ queryKey: LOCATIONS_KEY });

  const fromGis = async (location: Location) => {
    setNotice(null);
    try {
      await syncLocationCoordinates(location);
      setNotice({
        tone: 'success',
        text: t('places.coordinates.gisDone', { name: location.name }),
      });
      await refresh();
    } catch (error) {
      setNotice({
        tone: 'danger',
        text: error instanceof Error ? error.message : t('ui.confirm.failed'),
      });
    }
  };

  return (
    <>
      <MasterPage
        resource={locationsResource}
        title={t('places.locations.title')}
        subtitle={t('places.locations.subtitle')}
        noun={t('places.locations.noun')}
        searchPlaceholder={t('places.locations.search')}
        describe={describe}
        form={LocationForm}
        defaultSort={{ field: 'name', dir: 'asc' }}
        kpis={notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
        columns={[
          {
            id: 'code',
            header: t('places.locations.columns.code'),
            sortField: 'code',
            cell: (l) => <span className="font-mono text-sm">{l.code}</span>,
          },
          {
            id: 'name',
            header: t('places.locations.columns.name'),
            sortField: 'name',
            cell: (l) => (
              <div className="space-y-1">
                <p className="font-medium text-ink">{l.name}</p>
                {l.parent && (
                  <p className="text-xs text-ink-secondary">
                    {t('places.locations.under', { name: l.parent.name })}
                  </p>
                )}
                {l.subLocations > 0 && (
                  <p className="text-xs text-ink-secondary">
                    {t('places.locations.subLocations', { n: l.subLocations })}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {l.isHub && (
                    <StatusPill tone="info">{t('places.locations.flags.hub')}</StatusPill>
                  )}
                  {l.isComplex && (
                    <StatusPill tone="info">{t('places.locations.flags.complex')}</StatusPill>
                  )}
                  {l.isResidencyReset && (
                    <StatusPill tone="accent">
                      {t('places.locations.flags.residencyReset')}
                    </StatusPill>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: 'type',
            header: t('places.locations.columns.type'),
            sortField: 'type',
            cell: (l) => l.locationType.name,
          },
          {
            id: 'zone',
            header: t('places.locations.columns.zone'),
            sortField: 'zone',
            cell: (l) => l.zone.name,
          },
          {
            id: 'coordinates',
            header: t('places.locations.columns.coordinates'),
            cell: (l) => <CoordinatesCell coordinates={l.coordinates} />,
          },
          {
            id: 'pobLimit',
            header: t('places.locations.columns.pobLimit'),
            align: 'right',
            cell: (l) => l.pobLimit ?? '—',
          },
          {
            id: 'service',
            header: t('places.service.column'),
            cell: (l) => <ServiceCell record={l} />,
          },
        ]}
        filters={({ params, update }) => {
          const set = (name: string, value: string | undefined) => {
            const rest = Object.fromEntries(
              Object.entries(params.filters).filter(([k]) => k !== name),
            );
            update({ filters: value ? { ...rest, [name]: value } : rest });
          };
          return (
            <>
              <FilterSelect
                label={t('places.locations.filters.zone')}
                allLabel={t('ui.filter.all')}
                value={params.filters.zone}
                options={(options.data?.zones ?? []).map((z) => ({ value: z.id, label: z.name }))}
                onChange={(v) => set('zone', v)}
              />
              <FilterSelect
                label={t('places.locations.filters.type')}
                allLabel={t('ui.filter.all')}
                value={params.filters.type}
                options={(options.data?.locationTypes ?? []).map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
                onChange={(v) => set('type', v)}
              />
              <FilterSelect
                label={t('places.service.filter')}
                allLabel={t('ui.filter.all')}
                value={params.filters.serviceable}
                options={[
                  { value: 'true', label: t('places.service.inService') },
                  { value: 'false', label: t('places.service.outOfService') },
                ]}
                onChange={(v) => set('serviceable', v)}
              />
            </>
          );
        }}
        actions={(l) => [
          canEdit && {
            label: t(l.isServiceable ? 'places.service.takeOut' : 'places.service.putBack'),
            run: () => setServiceOf(l),
          },
          canEdit && { label: t('places.coordinates.gis'), run: () => void fromGis(l) },
        ]}
      />
      {serviceOf && (
        <ServiceabilityDialog
          open
          onOpenChange={(open) => {
            if (!open) setServiceOf(null);
          }}
          record={describe(serviceOf)}
          serviceable={!serviceOf.isServiceable}
          outBody={t('places.service.outLocation')}
          outDetails={<AffectedJourneys locationId={serviceOf.id} />}
          onConfirm={async (change) => {
            await setLocationServiceability(serviceOf, change);
            await refresh();
          }}
        />
      )}
    </>
  );
}

const shortDay = (iso: string) => formatGstDate(`${iso}T12:00:00+04:00`);

/** What a closure would cancel (P-63): listed before it is confirmed. */
function AffectedJourneys({ locationId }: { locationId: string }) {
  const { t } = useTranslation();
  const affected = useAffectedJourneys(locationId);
  const items = affected.data?.items ?? [];
  if (affected.isLoading)
    return <p className="text-sm text-ink-secondary">{t('places.service.checking')}</p>;
  if (affected.isError) return null;
  if (items.length === 0)
    return <p className="text-sm text-ink-secondary">{t('places.service.noJourneys')}</p>;
  const booked = items.filter((j) => j.booked).length;
  return (
    <Banner tone="warning" title={t('places.service.journeys', { count: items.length })}>
      <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
        {items.map((j) => (
          <li key={j.id}>
            {j.flightNumber} · {shortDay(j.serviceDate)}
            {j.booked ? ` · ${t('places.service.booked')}` : ''}
          </li>
        ))}
      </ul>
      {booked > 0 && <p className="mt-1">{t('places.service.bookedStay', { count: booked })}</p>}
    </Banner>
  );
}
