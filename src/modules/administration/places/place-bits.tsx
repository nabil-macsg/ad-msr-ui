import { type ComponentProps, type ReactNode, type SubmitEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { Field, SelectField, TextAreaField } from '../../../shared/ui/field';
import { Modal, ModalFooter } from '../../../shared/ui/modal';
import { ProvenanceChip } from '../../../shared/ui/provenance-chip';
import { StatusPill } from '../../../shared/ui/status-pill';
import { formatGst } from '../../../shared/time/format';
import { useReasonOptions } from '../reason-codes/reason-codes-api';
import type { ServiceabilityChange } from './places-api';

export interface StoredCoordinates {
  readonly lat: number;
  readonly lng: number;
  readonly source: 'integration' | 'manual';
  readonly syncedAt: string | null;
}

/** Coordinates with where they came from: VIA GIS, or entered by hand (BRD D.3.1.1). */
export function CoordinatesCell({ coordinates }: { coordinates: StoredCoordinates | null }) {
  const { t } = useTranslation();
  if (!coordinates)
    return <span className="text-sm text-ink-secondary">{t('places.coordinates.none')}</span>;
  return (
    <div className="space-y-1">
      <p className="font-mono text-xs text-ink">
        {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
      </p>
      <ProvenanceChip
        source={coordinates.source === 'integration' ? 'gis' : 'manual'}
        {...(coordinates.syncedAt ? { syncedAt: coordinates.syncedAt } : {})}
      />
    </div>
  );
}

/** In or out of service, with the reason and since when. */
export function ServiceCell({
  record,
}: {
  record: {
    isServiceable: boolean;
    unserviceableReasonCode: string | null;
    unserviceableReason: string | null;
    unserviceableSince: string | null;
  };
}) {
  const { t } = useTranslation();
  if (record.isServiceable) return <StatusPill tone="success">{t('places.service.in')}</StatusPill>;
  return (
    <div className="space-y-1">
      <StatusPill tone="danger">{t('places.service.out')}</StatusPill>
      <p className="max-w-56 text-xs text-ink-secondary">
        {[record.unserviceableReasonCode, record.unserviceableReason].filter(Boolean).join(' · ')}
      </p>
      {record.unserviceableSince && (
        <p className="text-xs text-ink-secondary">
          {t('places.service.since', { at: formatGst(record.unserviceableSince) })}
        </p>
      )}
    </div>
  );
}

/**
 * Takes a location or installation out of service, or back (spec 10 §5): out of service needs a
 * "Resource / Location Non-Serviceable" reason code and why; back needs why.
 */
export function ServiceabilityDialog({
  open,
  onOpenChange,
  record,
  serviceable,
  outBody,
  outDetails,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** How the dialog names the record, e.g. "DAS · Das Island". */
  record: string;
  /** The state it goes to. */
  serviceable: boolean;
  outBody: string;
  /** Shown when taking it out of service, e.g. the journeys that would be cancelled. */
  outDetails?: ReactNode;
  onConfirm: (change: ServiceabilityChange) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const reasons = useReasonOptions('non-serviceable', open && !serviceable);
  const [code, setCode] = useState('');
  const [why, setWhy] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!serviceable && reasons.data?.mandatory && !code) {
      setProblem(t('places.service.reasonCodeRequired'));
      return;
    }
    if (why.trim().length < 3) {
      setProblem(t('places.service.reasonRequired'));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await onConfirm({
        serviceable,
        reason: why.trim(),
        ...(!serviceable && code ? { reasonCode: code } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t('ui.confirm.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t(serviceable ? 'places.service.backTitle' : 'places.service.outTitle', { record })}
      description={serviceable ? t('places.service.back') : outBody}
    >
      <form id={id} onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        {problem && <Banner tone="danger">{problem}</Banner>}
        {!serviceable && outDetails}
        {!serviceable && (
          <SelectField
            label={t('places.service.reasonCode')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          >
            <option value="">{t('places.service.chooseReason')}</option>
            {(reasons.data?.options ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} · {o.description}
              </option>
            ))}
          </SelectField>
        )}
        <TextAreaField
          label={t('places.service.reason')}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={3}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('ui.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={busy}
            {...(serviceable ? {} : { className: 'bg-danger-fg hover:bg-danger-fg/90' })}
          >
            {t(serviceable ? 'places.service.putBack' : 'places.service.takeOut')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

type InputProps = Omit<ComponentProps<typeof Field>, 'label'>;

/** Latitude and longitude inputs, and the reason an override needs (BRD C.4.2-37). */
export function CoordinateFields({
  lat,
  lng,
  error,
  reason,
}: {
  lat: InputProps;
  lng: InputProps;
  error?: string | undefined;
  reason?: InputProps | undefined;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-2 md:col-span-2">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('places.coordinates.lat')} inputMode="decimal" error={error} {...lat} />
        <Field label={t('places.coordinates.lng')} inputMode="decimal" {...lng} />
      </div>
      <p className="text-xs text-ink-secondary">{t('places.coordinates.hint')}</p>
      {reason && <Field label={t('places.coordinates.reason')} {...reason} />}
    </fieldset>
  );
}
