import { type ReactNode, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { can } from '../../../app/access/registry';
import { useMyAccess } from '../../../app/session/queries';
import { Banner } from '../../../shared/ui/banner';
import { StatusPill } from '../../../shared/ui/status-pill';
import { type PobMaster, type Proposed, usePendingCount } from './pob-api';
import { SentContext } from './pob-context';

/** Holds the page's last proposal, so its notice can name the change it became. */
export function ProposalScope({ children }: { children: ReactNode }) {
  const [sent, setSent] = useState<Proposed | null>(null);
  const value = useMemo(() => ({ sent, report: setSent }), [sent]);
  return <SentContext.Provider value={value}>{children}</SentContext.Provider>;
}

/**
 * Above a POB master's list: changes need a second person; what was just sent; and how many wait.
 */
export function ApprovalNotice({ master }: { master: PobMaster }) {
  const { t } = useTranslation();
  const { sent } = useContext(SentContext);
  const { data: access } = useMyAccess();
  const canSee = can(access, 'admin.pending-changes', 'view');
  const waiting = usePendingCount(master, canSee);
  const link =
    canSee && (waiting.data ?? 0) > 0 ? (
      <Link to="/admin/pending-changes" className="font-semibold underline">
        {t('pob.notice.waiting', { count: waiting.data ?? 0 })}
      </Link>
    ) : undefined;
  if (sent && sent.items.length > 0) {
    return (
      <Banner tone="success" title={t('pob.notice.sentTitle')} action={link}>
        {t('pob.notice.sent', {
          count: sent.items.length,
          refs: sent.items.map((c) => c.ref).join(', '),
        })}
      </Banner>
    );
  }
  return (
    <Banner tone="info" action={link}>
      {t('pob.notice.makerChecker')}
    </Banner>
  );
}

/** A record with a change waiting: which, and what it does. */
export function PendingPill({ pending }: { pending: { ref: string; action: string } | null }) {
  const { t } = useTranslation();
  if (!pending) return null;
  return (
    <StatusPill tone="warning">
      {t('pob.pending.pill', {
        ref: pending.ref,
        action: t(`pob.action.${pending.action as 'update'}`),
      })}
    </StatusPill>
  );
}

/** The status cell: lifecycle, the master's own state, and any change waiting. */
export function PobStatus({
  isActive,
  state,
  pending,
}: {
  isActive: boolean;
  state?: ReactNode;
  pending: { ref: string; action: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-1">
      {isActive ? (
        (state ?? <StatusPill tone="success">{t('masters.active')}</StatusPill>)
      ) : (
        <StatusPill tone="neutral">{t('masters.deactivated')}</StatusPill>
      )}
      <PendingPill pending={pending} />
    </div>
  );
}
