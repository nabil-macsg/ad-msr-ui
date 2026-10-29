import { useId } from 'react';
import { cn } from '../lib/cn';
import { CONTROL } from './control-styles';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/** A labelled select for the filter bar; the first option clears the filter. */
export function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: readonly SelectOption[];
  allLabel: string;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-ink-secondary">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        className={cn('min-h-touch px-2.5 py-2', CONTROL)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
