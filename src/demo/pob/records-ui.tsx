import type { ReactNode } from 'react';
import { cn } from '../../shared/lib/cn';

/** What still stops a form from being saved, listed under it (the original's live checklist). */
export function MissingList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-0.5 rounded-lg bg-warning-bg px-4 py-2 text-xs text-warning-fg">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  );
}

/** A small muted note under a section, as in the original. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-xs text-ink-muted', className)}>{children}</p>;
}

/** A label and its value in a detail panel. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className="text-ink-muted">{label}</span>
      <span className="text-end text-ink">{children}</span>
    </div>
  );
}

/** A person in a pick list: name, extra detail and Optima number. */
export function PersonChoice({
  name,
  detail,
  optima,
  selected,
  onSelect,
  radio = false,
  group,
}: {
  name: string;
  detail: string;
  optima: string;
  selected: boolean;
  onSelect: () => void;
  radio?: boolean;
  group?: string;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">{name}</span>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
      <span className="font-mono text-xs text-ink-secondary">{optima}</span>
    </>
  );
  const box = cn(
    'flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition-colors',
    selected ? 'border-primary bg-primary-subtle' : 'border-border hover:bg-surface-muted',
  );
  return radio ? (
    <label className={box}>
      <input
        type="radio"
        name={group}
        checked={selected}
        onChange={onSelect}
        className="size-4 accent-primary"
      />
      {body}
    </label>
  ) : (
    <button type="button" className={box} aria-pressed={selected} onClick={onSelect}>
      {body}
    </button>
  );
}
