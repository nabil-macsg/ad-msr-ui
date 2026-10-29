import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toKg, type WeightUnit } from '../units/weight';
import { Input } from './field';

export interface CapturedWeight {
  /** What is stored (PROMPT §2.15). */
  readonly kg: number;
  /** What was entered, kept with the record. */
  readonly captured: { readonly value: number; readonly unit: WeightUnit };
}

/**
 * A weight entered in kg or lb and stored in kg. Helicopter operations capture in lb, fixed wing
 * and ferry in kg (PROMPT §2.15); the default unit comes from the caller.
 */
export function UnitInput({
  label,
  value,
  defaultUnit = 'kg',
  onChange,
  error,
}: {
  label: string;
  value: CapturedWeight | null;
  defaultUnit?: WeightUnit;
  onChange: (value: CapturedWeight | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [unit, setUnit] = useState<WeightUnit>(value?.captured.unit ?? defaultUnit);
  const [text, setText] = useState(value ? String(value.captured.value) : '');

  const emit = (raw: string, nextUnit: WeightUnit) => {
    const number = Number(raw);
    onChange(
      raw.trim() === '' || !Number.isFinite(number) || number < 0
        ? null
        : { kg: toKg(number, nextUnit), captured: { value: number, unit: nextUnit } },
    );
  };

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          inputMode="decimal"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-kg`}
          onChange={(e) => {
            setText(e.target.value);
            emit(e.target.value, unit);
          }}
          className="max-w-40"
        />
        <div
          role="radiogroup"
          aria-label={t('ui.unit.weight')}
          className="flex rounded-md border border-border"
        >
          {(['kg', 'lb'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={unit === option}
              onClick={() => {
                setUnit(option);
                emit(text, option);
              }}
              className={
                unit === option
                  ? 'min-h-touch min-w-12 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary'
                  : 'min-h-touch min-w-12 px-3 text-sm text-ink-secondary hover:bg-surface-muted'
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <p id={`${id}-kg`} className={error ? 'text-sm text-danger-fg' : 'text-xs text-ink-muted'}>
        {error ?? (value && unit === 'lb' ? t('ui.unit.equals', { kg: value.kg }) : ' ')}
      </p>
    </div>
  );
}
