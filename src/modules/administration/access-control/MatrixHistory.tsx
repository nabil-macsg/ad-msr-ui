import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatGst } from '../../../shared/time/format';
import { Button } from '../../../shared/ui/button';
import { EmptyState } from '../../../shared/ui/empty-state';
import { Spinner } from '../../../shared/ui/spinner';
import { MATRIX_KEY, useMatrixVersions, versionChanges } from './matrix-api';

/** The role's matrix versions, newest first, each with what it changed (spec 10 §2.3). */
export function MatrixHistory({ roleId }: { roleId: string }) {
  const { t } = useTranslation();
  const versions = useMatrixVersions(roleId);
  const [open, setOpen] = useState<number | null>(null);
  if (versions.isPending) return <Spinner label={t('loading')} />;
  const items = versions.data?.items ?? [];
  if (items.length === 0) return <EmptyState title={t('matrix.history.empty')} />;
  return (
    <ol className="space-y-3">
      {items.map((v) => (
        <li key={v.versionNo} className="rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">
                {t('matrix.history.version', { n: v.versionNo })} · {v.summary}
              </p>
              <p className="text-xs text-ink-secondary">
                {t('matrix.history.by', {
                  name: v.changedBy ?? t('matrix.history.system'),
                  at: formatGst(v.changedAt),
                })}
              </p>
            </div>
            <Button
              variant="secondary"
              aria-expanded={open === v.versionNo}
              onClick={() => setOpen(open === v.versionNo ? null : v.versionNo)}
            >
              {t('matrix.history.show')}
            </Button>
          </div>
          {open === v.versionNo && <VersionChanges versionNo={v.versionNo} roleId={roleId} />}
        </li>
      ))}
    </ol>
  );
}

function VersionChanges({ versionNo, roleId }: { versionNo: number; roleId: string }) {
  const { t } = useTranslation();
  const changes = useQuery({
    queryKey: [...MATRIX_KEY, 'changes', versionNo, roleId],
    queryFn: () => versionChanges(versionNo, roleId),
  });
  if (!changes.data) return <Spinner label={t('loading')} />;
  if (changes.data.changes.length === 0) {
    return <p className="mt-2 text-sm text-ink-secondary">{t('matrix.history.none')}</p>;
  }
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {changes.data.changes.map((c) => (
        <li key={`${c.kind}-${c.key}`} className="text-ink">
          <span className="font-medium">{c.label}</span>: {c.before} → {c.after}
        </li>
      ))}
    </ul>
  );
}
