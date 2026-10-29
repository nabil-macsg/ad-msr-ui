import { useId } from 'react';
import { cn } from '../lib/cn';
import type { SelectOption } from './filter-select';

const SHORT = 8;

/** Several choices from a list (zones, locations…), in a scrollable group with its legend. */
export function CheckboxList({
  legend,
  options,
  selected,
  onChange,
  hint,
}: {
  legend: string;
  options: readonly SelectOption[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  hint?: string;
}) {
  const id = useId();
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  return (
    <fieldset className="space-y-1" {...(hint ? { 'aria-describedby': `${id}-hint` } : {})}>
      <legend className="text-xs text-ink-secondary">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {/* A short list (days of the week) shows whole, in columns; a long one scrolls in place. */}
      <div
        className={cn(
          'rounded-lg border border-border p-2',
          options.length <= SHORT
            ? 'grid grid-cols-2 gap-1 sm:grid-cols-4'
            : 'max-h-44 space-y-1 overflow-y-auto',
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-xs text-ink-secondary hover:bg-surface-muted"
          >
            <input
              type="checkbox"
              className="size-4 rounded-sm accent-primary"
              checked={selected.includes(option.value)}
              onChange={(e) => toggle(option.value, e.target.checked)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
