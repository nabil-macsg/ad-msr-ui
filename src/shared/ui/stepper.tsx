import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';

export interface Step {
  readonly id: string;
  readonly label: string;
}

/** Where the user is in a multi-step flow (PROMPT §4.2), e.g. Journey → Review & Submit. */
export function Stepper({ steps, current }: { steps: readonly Step[]; current: number }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('ui.stepper.progress')}>
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2"
              aria-current={active ? 'step' : undefined}
            >
              {index > 0 && <span className="h-px w-8 bg-border" aria-hidden />}
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-pill border text-xs font-semibold',
                  done && 'border-success-fg bg-success-fg text-on-primary',
                  active && 'border-primary bg-primary text-on-primary',
                  !done && !active && 'border-border text-ink-muted',
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : index + 1}
              </span>
              <span
                className={cn('text-sm', active ? 'font-semibold text-ink' : 'text-ink-secondary')}
              >
                <span className="sr-only">
                  {t('ui.stepper.step', { n: index + 1, total: steps.length })}:{' '}
                </span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
