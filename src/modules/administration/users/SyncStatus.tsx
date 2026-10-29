import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatGst } from '../../../shared/time/format';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { StatusPill } from '../../../shared/ui/status-pill';
import type { Tone } from '../../../shared/ui/tone';
import { type SyncRun, useLatestSyncRuns, useUserMutations } from './users-api';

const ADAPTERS = ['sap', 'fieldglass', 'hse_passport'] as const;
const TONE: Record<SyncRun['status'], Tone> = {
  running: 'info',
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
};

/** When each source system last synced, and "Sync now" for user administrators (PROMPT §2.9). */
export function SyncStatus({ canSync }: { canSync: boolean }) {
  const { t } = useTranslation();
  const latest = useLatestSyncRuns();
  const { sync } = useUserMutations();
  const [failure, setFailure] = useState<string | null>(null);
  const runOf = (adapter: SyncRun['adapter']) => latest.data?.find((r) => r.adapter === adapter);

  const start = (adapter: SyncRun['adapter']) => {
    setFailure(null);
    sync.mutateAsync(adapter).catch((error: unknown) => {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    });
  };

  return (
    <section
      aria-labelledby="sync-title"
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-card"
    >
      <h2 id="sync-title" className="text-base font-semibold text-ink">
        {t('users.sync.title')}
      </h2>
      {failure && <Banner tone="danger">{failure}</Banner>}
      <ul className="grid gap-3 md:grid-cols-3">
        {ADAPTERS.map((adapter) => {
          const run = runOf(adapter);
          const running = run?.status === 'running';
          return (
            <li key={adapter} className="space-y-1 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{t(`users.sync.adapter.${adapter}`)}</p>
                {run && (
                  <StatusPill tone={TONE[run.status]}>
                    {t(`users.sync.status.${run.status}`)}
                  </StatusPill>
                )}
              </div>
              <p className="text-sm text-ink-secondary">
                {run ? formatGst(run.finishedAt ?? run.startedAt) : t('users.sync.never')}
              </p>
              {run && !running && (
                <p className="text-xs text-ink-muted">
                  {t('users.sync.counts', {
                    created: run.counts.created ?? 0,
                    updated: run.counts.updated ?? 0,
                    left: run.counts.left ?? 0,
                    errors: run.counts.errors ?? 0,
                  })}
                </p>
              )}
              {canSync && (
                <Button
                  variant="secondary"
                  disabled={running || sync.isPending}
                  onClick={() => start(adapter)}
                  aria-label={`${t('users.sync.now')}: ${t(`users.sync.adapter.${adapter}`)}`}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  {running ? t('users.sync.running') : t('users.sync.now')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
