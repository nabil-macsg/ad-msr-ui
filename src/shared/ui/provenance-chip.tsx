import { useTranslation } from 'react-i18next';
import { formatGst } from '../time/format';

export type Provenance =
  | 'sap'
  | 'fieldglass'
  | 'hse-passport'
  | 'gis'
  | 'imilaha'
  | 'contacts'
  | 'manual'
  /** Kept in MASAR itself, e.g. a department not in SAP. */
  | 'masar';

/** Where a value comes from; MASAR never writes back to the source (PROMPT §2.9, F-24). */
export function ProvenanceChip({ source, syncedAt }: { source: Provenance; syncedAt?: string }) {
  const { t } = useTranslation();
  const synced = syncedAt ? t('ui.provenance.syncedAt', { at: formatGst(syncedAt) }) : undefined;
  return (
    <span
      title={synced}
      className={
        source === 'manual'
          ? 'inline-flex rounded-sm border border-warning-fg/40 bg-warning-bg px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-warning-fg'
          : 'inline-flex rounded-sm border border-info-fg/30 bg-info-bg px-1.5 py-0.5 text-[0.6875rem] font-bold tracking-wide text-info-fg'
      }
    >
      {t(`ui.provenance.${source}`)}
      {synced && <span className="sr-only">, {synced}</span>}
    </span>
  );
}
