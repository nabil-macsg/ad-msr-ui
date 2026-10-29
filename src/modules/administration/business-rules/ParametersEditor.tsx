import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/button';
import { CheckboxList } from '../../../shared/ui/checkbox-list';
import { Field, SelectField } from '../../../shared/ui/field';
import {
  emptyRow,
  type ParamDraft,
  type ParamProblem,
  type ParamsDraft,
  type RowDraft,
} from './param-draft';
import type { ColumnField, ParamField } from './rules-api';

/** A label with its unit: "Validity (months)". */
const withUnit = (f: ParamField | ColumnField) => (f.unit ? `${f.label} (${f.unit})` : f.label);

/**
 * A rule type's parameters, each with the control its kind needs (spec 10 §3.2: a type-specific
 * form for each rule type).
 */
export function ParametersEditor({
  fields,
  value,
  onChange,
  problems,
}: {
  fields: readonly ParamField[];
  value: ParamsDraft;
  onChange: (value: ParamsDraft) => void;
  problems: Readonly<Record<string, ParamProblem>>;
}) {
  const { t } = useTranslation();
  const set = (key: string, draft: ParamDraft) => onChange({ ...value, [key]: draft });
  const problem = (key: string) =>
    problems[key] ? t(`rules.params.problem.${problems[key]}`) : undefined;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">{t('rules.form.parameters')}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => {
          const d = value[f.key];
          const str = typeof d === 'string' ? d : '';
          const arr = Array.isArray(d) ? (d as string[]) : [];
          switch (f.kind) {
            case 'integer':
            case 'decimal':
              return (
                <div key={f.key} className="space-y-1">
                  <Field
                    label={withUnit(f)}
                    inputMode={f.kind === 'integer' ? 'numeric' : 'decimal'}
                    value={str}
                    error={problem(f.key)}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  {f.nullable && (
                    <p className="text-xs text-ink-muted">{t('rules.params.emptyIsNone')}</p>
                  )}
                </div>
              );
            case 'time':
              return (
                <Field
                  key={f.key}
                  type="time"
                  label={f.label}
                  value={str}
                  error={problem(f.key)}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              );
            case 'boolean':
              return (
                <label key={f.key} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={d === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                  />
                  {f.label}
                </label>
              );
            case 'choice':
              return (
                <SelectField
                  key={f.key}
                  label={f.label}
                  value={str}
                  error={problem(f.key)}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  <option value="">{t('rules.params.choose')}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              );
            case 'choices':
              return (
                <CheckboxList
                  key={f.key}
                  legend={f.label}
                  options={f.options ?? []}
                  selected={arr}
                  onChange={(selected) => set(f.key, selected)}
                />
              );
            case 'order':
              return (
                <OrderEditor
                  key={f.key}
                  field={f}
                  order={arr}
                  onChange={(order) => set(f.key, order)}
                />
              );
            case 'codes':
            case 'integers':
              return (
                <div key={f.key} className="space-y-1">
                  <Field
                    label={withUnit(f)}
                    value={str}
                    error={problem(f.key)}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <p className="text-xs text-ink-muted">{t('rules.params.commas')}</p>
                </div>
              );
            case 'table':
              return (
                <TableEditor
                  key={f.key}
                  field={f}
                  rows={(Array.isArray(d) ? d : []) as RowDraft[]}
                  onChange={(rows) => set(f.key, rows)}
                  problem={(row, column) => problem(`${f.key}.${row}.${column}`)}
                />
              );
          }
        })}
      </div>
    </fieldset>
  );
}

/** Every option, in the order that matters (e.g. manifest priority). */
function OrderEditor({
  field,
  order,
  onChange,
}: {
  field: ParamField;
  order: readonly string[];
  onChange: (order: string[]) => void;
}) {
  const { t } = useTranslation();
  const label = (value: string) => field.options?.find((o) => o.value === value)?.label ?? value;
  const move = (from: number, to: number) => {
    const next = [...order];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    onChange(next);
  };
  return (
    <fieldset className="space-y-1 md:col-span-2">
      <legend className="text-sm font-medium text-ink">{field.label}</legend>
      <ol className="space-y-1">
        {order.map((value, index) => (
          <li
            key={value}
            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1 text-sm"
          >
            <span>
              {index + 1}. {label(value)}
            </span>
            <span className="flex gap-1">
              <Button
                variant="ghost"
                aria-label={t('rules.params.moveUp', { item: label(value) })}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('rules.params.moveDown', { item: label(value) })}
                disabled={index === order.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}

/** Rows of a few columns (e.g. score bands). */
function TableEditor({
  field,
  rows,
  onChange,
  problem,
}: {
  field: ParamField;
  rows: readonly RowDraft[];
  onChange: (rows: RowDraft[]) => void;
  problem: (row: number, column: string) => string | undefined;
}) {
  const { t } = useTranslation();
  const columns = field.columns ?? [];
  const setCell = (index: number, key: string, cell: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: cell } : row)));
  return (
    <fieldset className="space-y-2 md:col-span-2">
      <legend className="text-sm font-medium text-ink">{field.label}</legend>
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-1 text-left font-medium text-ink-secondary">
                {withUnit(c)}
              </th>
            ))}
            <th scope="col" className="px-1 text-right font-medium text-ink-secondary">
              {t('rules.params.row')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // Rows have no identity of their own; their position is what the form edits.
            <tr key={index}>
              {columns.map((c) => {
                const cellLabel = t('rules.params.cell', { column: c.label, row: index + 1 });
                const error = problem(index, c.key);
                return (
                  <td key={c.key} className="px-1 py-1 align-top">
                    {c.kind === 'choice' ? (
                      <select
                        aria-label={cellLabel}
                        value={row[c.key] ?? ''}
                        onChange={(e) => setCell(index, c.key, e.target.value)}
                        className="min-h-touch w-full rounded-md border border-border bg-card px-2"
                      >
                        <option value="">{t('rules.params.choose')}</option>
                        {(c.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={cellLabel}
                        aria-invalid={error ? true : undefined}
                        inputMode={c.kind === 'integer' ? 'numeric' : 'decimal'}
                        value={row[c.key] ?? ''}
                        onChange={(e) => setCell(index, c.key, e.target.value)}
                        className="min-h-touch w-full rounded-md border border-border bg-card px-2 aria-invalid:border-danger-fg"
                      />
                    )}
                    {error && <p className="text-xs text-danger-fg">{error}</p>}
                  </td>
                );
              })}
              <td className="px-1 py-1 text-right">
                <Button
                  variant="ghost"
                  aria-label={t('rules.params.removeRow', { row: index + 1 })}
                  disabled={rows.length <= (field.minRows ?? 1)}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        variant="secondary"
        disabled={rows.length >= (field.maxRows ?? 10)}
        onClick={() => onChange([...rows, emptyRow(columns)])}
      >
        <Plus className="size-4" aria-hidden />
        {t('rules.params.addRow')}
      </Button>
    </fieldset>
  );
}
