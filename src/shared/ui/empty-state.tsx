import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

/** Nothing to show yet, with what the user can do about it. */
export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 text-border-strong">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-prose text-sm text-ink-secondary">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
