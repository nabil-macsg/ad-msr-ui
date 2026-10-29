import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Banner } from '../../../shared/ui/banner';
import { Button } from '../../../shared/ui/button';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import type { MasterFormProps } from '../masters/master-page';
import { categoryOptions } from '../resources/resources-api';
import { type Route, saveRoute, useRouteOptions } from './places-api';

/**
 * New or edited route (spec 10 §5.1): origin, ordered stops and destination. Changing the path
 * saves a new revision; the distance is great-circle, and unknown while a stop has no coordinates.
 */
export function RouteForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Route>) {
  const { t } = useTranslation();
  const options = useRouteOptions();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,24}$/, t('places.routes.form.codeInvalid')),
    name: z.string().max(200),
    points: z
      .array(z.object({ locationId: z.string().min(1, t('places.routes.form.pointRequired')) }))
      .min(2),
    resourceCategory: z.string().min(1, t('places.routes.form.categoryRequired')),
    durationMinutes: z
      .string()
      .trim()
      .regex(/^(\d+)?$/, t('places.routes.form.durationInvalid'))
      .refine((v) => v === '' || Number(v) > 0, t('places.routes.form.durationInvalid')),
    isExclusive: z.boolean(),
    owningTeam: z.string().max(120),
  });
  type Values = z.infer<typeof schema>;
  const currentPath = record?.points.map((p) => p.id) ?? [];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      points: record
        ? currentPath.map((locationId) => ({ locationId }))
        : [{ locationId: '' }, { locationId: '' }],
      resourceCategory: record?.resourceCategory ?? '',
      durationMinutes: record?.durationMinutes ? String(record.durationMinutes) : '',
      isExclusive: record?.isExclusive ?? false,
      owningTeam: record?.owningTeam ?? '',
    },
  });
  const points = useFieldArray({ control: form.control, name: 'points' });
  const chosen = useWatch({ control: form.control, name: 'points' });
  const { errors, isSubmitting } = form.formState;
  const byId = new Map((options.data?.locations ?? []).map((l) => [l.id, l]));
  const path = chosen.map((p) => p.locationId);
  const noCoordinates = path.some((id) => id !== '' && byId.get(id)?.hasCoordinates === false);
  const nextRevision =
    record && (path.length !== currentPath.length || path.some((id, i) => id !== currentPath[i]))
      ? record.revision + 1
      : null;
  const pathChanged = nextRevision !== null;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const values = {
      name: v.name.trim() || null,
      resourceCategory: v.resourceCategory,
      durationMinutes: v.durationMinutes ? Number(v.durationMinutes) : null,
      isExclusive: v.isExclusive,
      owningTeam: v.owningTeam.trim() || null,
    };
    const ids = v.points.map((p) => p.locationId);
    try {
      await saveRoute(
        record,
        { ...values, code: v.code, points: ids },
        { ...values, ...(pathChanged ? { points: ids } : {}) },
      );
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });

  const labelOf = (index: number) =>
    index === 0
      ? t('places.routes.form.origin')
      : index === points.fields.length - 1
        ? t('places.routes.form.destination')
        : t('places.routes.form.stop', { n: index });
  const nameAt = (index: number) => byId.get(path[index] ?? '')?.name ?? labelOf(index);

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('places.routes.form.editTitle', { name: record.displayName })
          : t('places.routes.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('places.routes.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <div>
          <Field label={t('places.routes.form.name')} {...form.register('name')} />
          <p className="mt-1 text-xs text-ink-secondary">{t('places.routes.form.nameHint')}</p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">{t('places.routes.form.points')}</legend>
        <ol className="space-y-2">
          {points.fields.map((field, index) => (
            <li key={field.id} className="flex items-end gap-2">
              <SelectField
                className="flex-1"
                label={labelOf(index)}
                error={errors.points?.[index]?.locationId?.message}
                {...form.register(`points.${index}.locationId`)}
              >
                <option value="">{t('places.routes.form.choosePlace')}</option>
                {(options.data?.locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </SelectField>
              <Button
                variant="ghost"
                aria-label={t('places.routes.form.moveUp', { name: nameAt(index) })}
                disabled={index === 0}
                onClick={() => points.move(index, index - 1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('places.routes.form.moveDown', { name: nameAt(index) })}
                disabled={index === points.fields.length - 1}
                onClick={() => points.move(index, index + 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('places.routes.form.removeStop', { name: nameAt(index) })}
                disabled={points.fields.length <= 2}
                onClick={() => points.remove(index)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          disabled={points.fields.length >= 20}
          onClick={() => points.insert(points.fields.length - 1, { locationId: '' })}
        >
          <Plus className="size-4" aria-hidden />
          {t('places.routes.form.addStop')}
        </Button>
        {noCoordinates && <Banner tone="warning">{t('places.routes.noDistance')}</Banner>}
        {nextRevision !== null && (
          <p className="text-xs text-ink-secondary">
            {t('places.routes.form.newRevision', { n: nextRevision })}
          </p>
        )}
      </fieldset>

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t('places.routes.form.category')}
          error={errors.resourceCategory?.message}
          {...form.register('resourceCategory')}
        >
          <option value="">{t('places.routes.form.chooseCategory')}</option>
          {categoryOptions(
            t,
            options.data?.categories,
            record && { code: record.resourceCategory },
          ).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('places.routes.form.duration')}
          inputMode="numeric"
          error={errors.durationMinutes?.message}
          {...form.register('durationMinutes')}
        />
        <Field label={t('places.routes.form.team')} {...form.register('owningTeam')} />
        <label className="flex min-h-9 items-center gap-2 self-end text-sm text-ink">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            {...form.register('isExclusive')}
          />
          {t('places.routes.form.exclusive')}
        </label>
      </div>
    </EntityFormModal>
  );
}
