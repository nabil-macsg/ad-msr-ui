import { Check, Clock, Minus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { formatGst } from '../time/format';
import { slaHours } from '../time/sla';
import { TONE_PILL, type Tone } from './tone';

export type StageStatus = 'approved' | 'pending' | 'rejected' | 'waiting' | 'skipped';

export interface ApprovalStage {
  readonly id: string;
  readonly name: string;
  readonly status: StageStatus;
  readonly approver?: string;
  readonly decidedAt?: string;
  /** When the pending stage's SLA runs out (escalation follows). */
  readonly slaDueAt?: string;
}

const STATUS: Record<StageStatus, { tone: Tone; Icon: typeof Check }> = {
  approved: { tone: 'success', Icon: Check },
  pending: { tone: 'warning', Icon: Clock },
  rejected: { tone: 'danger', Icon: X },
  waiting: { tone: 'neutral', Icon: Clock },
  skipped: { tone: 'neutral', Icon: Minus },
};

/** Stage chips with status and SLA (PROMPT §4.2). */
export function ApprovalChain({
  stages,
  now = new Date(),
}: {
  stages: readonly ApprovalStage[];
  now?: Date;
}) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('ui.approval.chain')} className="flex flex-wrap items-center gap-2">
      {stages.map((stage, index) => {
        const { tone, Icon } = STATUS[stage.status];
        const hours =
          stage.status === 'pending' && stage.slaDueAt ? slaHours(stage.slaDueAt, now) : null;
        return (
          <li key={stage.id} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
            <div className={cn('rounded-lg border px-3 py-1.5 text-xs', TONE_PILL[tone])}>
              <p className="flex items-center gap-1 font-semibold">
                <Icon className="size-3.5" aria-hidden />
                {stage.name}
                <span className="sr-only">: {t(`ui.approval.${stage.status}`)}</span>
              </p>
              {stage.approver && <p>{stage.approver}</p>}
              {stage.decidedAt && <p>{formatGst(stage.decidedAt)}</p>}
              {hours !== null && (
                <p className={cn(hours < 0 && 'font-semibold text-danger-fg')}>
                  {hours < 0
                    ? t('ui.approval.slaOverdue', { hours: -hours })
                    : t('ui.approval.slaLeft', { hours })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
