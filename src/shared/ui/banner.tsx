import { CircleCheckBig, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

const TONES = {
  info: { box: 'border-info-border bg-info-bg text-info-fg', Icon: Info },
  success: { box: 'border-success-border bg-success-bg text-success-fg', Icon: CircleCheckBig },
  warning: { box: 'border-warning-border bg-warning-bg text-warning-fg', Icon: TriangleAlert },
  danger: { box: 'border-danger-border bg-danger-bg text-danger-fg', Icon: TriangleAlert },
} as const;

/** Info, success, warning or danger message across a page or form. */
export function Banner({
  tone = 'info',
  title,
  action,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', box, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
