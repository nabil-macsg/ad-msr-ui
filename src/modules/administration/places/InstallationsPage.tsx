import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { Banner } from '../../../shared/ui/banner';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { FilterSelect } from '../../../shared/ui/filter-select';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { MasterPage } from '../masters/master-page';
import { InstallationFiles } from './InstallationFiles';
import { InstallationForm } from './InstallationForm';
import { CoordinatesCell, ServiceCell, ServiceabilityDialog } from './place-bits';
import {
  activateInstallation,
  type Installation,
  INSTALLATIONS_KEY,
  installationsResource,
  setInstallationServiceability,
  syncInstallationCoordinates,
  useInstallationOptions,
} from './places-api';

const describe = (i: Installation) => `${i.code} · ${i.name}`;
const STATUS_TONE: Readonly<Record<Installation['status'], Tone>> = {
  draft: 'warning',
  active: 'success',
  deactivated: 'neutral',
};

/**
 * Installations (spec 10 §5.1, BRD C.4.2-31): the helideck master, kept by the Aviation
 * Technical Team. A new installation is a draft; activation needs D, T, GCAA class of use,
 * elevation and coordinates (C.5.2). Demo placeholders show as pending confirmation (P-53).
 */
export default function InstallationsPage() {
  const { t, i18n } = useTranslation();
  const { data: access } = useMyAccess();
  const queryClient = useQueryClient();
  const options = useInstallationOptions();
  const [serviceOf, setServiceOf] = useState<Installation | null>(null);
  const [activating, setActivating] = useState<Installation | null>(null);
  const [filesOf, setFilesOf] = useState<Installation | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const canEdit = can(access, 'admin.installations', 'edit');
  const refresh = () => queryClient.invalidateQueries({ queryKey: INSTALLATIONS_KEY });
  const fieldList = (fields: readonly Installation['activationMissing'][number][]) =>
    new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
      fields.map((f) => t(`places.installations.fields.${f}`)),
    );

  const fromGis = async (installation: Installation) => {
    setNotice(null);
    try {
      await syncInstallationCoordinates(installation);
      setNotice({
        tone: 'success',
        text: t('places.coordinates.gisDone', { name: installation.name }),
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
        resource={installationsResource}
        title={t('places.installations.title')}
        subtitle={t('places.installations.subtitle')}
        noun={t('places.installations.noun')}
        searchPlaceholder={t('places.installations.search')}
        describe={describe}
        form={InstallationForm}
        defaultSort={{ field: 'name', dir: 'asc' }}
        kpis={notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
        status={(i) => (
          <StatusPill tone={STATUS_TONE[i.status]}>
            {t(`places.installations.status.${i.status}`)}
          </StatusPill>
        )}
        lifecycle={(i) => (i.status === 'active' ? 'deactivate' : null)}
        columns={[
          {
            id: 'code',
            header: t('places.installations.columns.code'),
            sortField: 'code',
            cell: (i) => <span className="font-mono text-sm">{i.code}</span>,
          },
          {
            id: 'name',
            header: t('places.installations.columns.name'),
            sortField: 'name',
            cell: (i) => (
              <div className="space-y-1">
                <p className="font-medium text-ink">{i.name}</p>
                {i.callsign && <p className="text-xs text-ink-secondary">{i.callsign}</p>}
                {i.unconfirmedFields.length > 0 && (
                  <StatusPill tone="warning">{t('places.installations.pending')}</StatusPill>
                )}
              </div>
            ),
          },
          {
            id: 'type',
            header: t('places.installations.columns.type'),
            sortField: 'type',
            cell: (i) => i.installationType.name,
          },
          {
            id: 'location',
            header: t('places.installations.columns.location'),
            sortField: 'location',
            cell: (i) => i.location.name,
          },
          {
            id: 'dt',
            header: t('places.installations.columns.dt'),
            cell: (i) =>
              i.dValue !== null && i.tValue !== null
                ? t('places.installations.dt', { d: i.dValue, t: i.tValue })
                : '—',
          },
          {
            id: 'classOfUse',
            header: t('places.installations.columns.classOfUse'),
            cell: (i) => i.gcaaClassOfUse ?? '—',
          },
          {
            id: 'coordinates',
            header: t('places.installations.columns.coordinates'),
            cell: (i) => <CoordinatesCell coordinates={i.coordinates} />,
          },
          {
            id: 'service',
            header: t('places.service.column'),
            cell: (i) => <ServiceCell record={i} />,
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
                label={t('places.installations.filters.location')}
                allLabel={t('ui.filter.all')}
                value={params.filters.location}
                options={(options.data?.locations ?? []).map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
                onChange={(v) => set('location', v)}
              />
              <FilterSelect
                label={t('places.installations.filters.type')}
                allLabel={t('ui.filter.all')}
                value={params.filters.type}
                options={(options.data?.installationTypes ?? []).map((o) => ({
                  value: o.id,
                  label: o.name,
                }))}
                onChange={(v) => set('type', v)}
              />
              <FilterSelect
                label={t('places.installations.filters.unconfirmed')}
                allLabel={t('ui.filter.all')}
                value={params.filters.unconfirmed}
                options={[
                  { value: 'true', label: t('places.installations.filters.pendingOnly') },
                  { value: 'false', label: t('places.installations.filters.confirmedOnly') },
                ]}
                onChange={(v) => set('unconfirmed', v)}
              />
            </>
          );
        }}
        actions={(i) => [
          canEdit &&
            i.status !== 'active' && {
              label: t(
                i.status === 'draft'
                  ? 'places.installations.activate'
                  : 'places.installations.reactivate',
              ),
              run: () => setActivating(i),
            },
          canEdit && {
            label: t(i.isServiceable ? 'places.service.takeOut' : 'places.service.putBack'),
            run: () => setServiceOf(i),
          },
          canEdit && { label: t('places.coordinates.gis'), run: () => void fromGis(i) },
          { label: t('places.installations.files'), run: () => setFilesOf(i) },
        ]}
      />
      {activating && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setActivating(null);
          }}
          title={t('places.installations.activateTitle', { record: describe(activating) })}
          body={
            activating.activationMissing.length > 0
              ? t('places.installations.missing', {
                  fields: fieldList(activating.activationMissing),
                })
              : t(
                  activating.status === 'draft'
                    ? 'places.installations.activateBody'
                    : 'places.installations.reactivateBody',
                )
          }
          confirmLabel={t(
            activating.status === 'draft'
              ? 'places.installations.activate'
              : 'places.installations.reactivate',
          )}
          tone="primary"
          requireReason={activating.status === 'deactivated'}
          onConfirm={async (reason) => {
            await activateInstallation(activating, reason || undefined);
            await refresh();
          }}
        />
      )}
      {serviceOf && (
        <ServiceabilityDialog
          open
          onOpenChange={(open) => {
            if (!open) setServiceOf(null);
          }}
          record={describe(serviceOf)}
          serviceable={!serviceOf.isServiceable}
          outBody={t('places.service.outInstallation')}
          onConfirm={async (change) => {
            await setInstallationServiceability(serviceOf, change);
            await refresh();
          }}
        />
      )}
      {filesOf && (
        <InstallationFiles
          installation={filesOf}
          canEdit={canEdit}
          onOpenChange={(open) => {
            if (!open) setFilesOf(null);
          }}
        />
      )}
    </>
  );
}
