import { zodResolver } from '@hookform/resolvers/zod';
import {
  Briefcase,
  Crown,
  HardHat,
  type LucideIcon,
  Radar,
  RefreshCw,
  ShieldCheck,
  Star,
  Stethoscope,
  User,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../../shared/ui/entity-form-modal';
import { Field, SelectField } from '../../../shared/ui/field';
import { StatusPill } from '../../../shared/ui/status-pill';
import { toNullable } from '../masters/form-values';
import { masterResource, saveMaster } from '../masters/master-api';
import { MasterPage, type MasterFormProps } from '../masters/master-page';
import type { PassengerCategory } from './orgs-api';

const resource = masterResource<PassengerCategory>(
  'passenger-categories',
  'admin.passenger-categories',
);
type Icon = PassengerCategory['icon'];
type Colour = PassengerCategory['colour'];
const ICONS: Readonly<Record<Icon, LucideIcon>> = {
  crown: Crown,
  star: Star,
  'shield-check': ShieldCheck,
  'refresh-cw': RefreshCw,
  briefcase: Briefcase,
  'hard-hat': HardHat,
  radar: Radar,
  'user-round': UserRound,
  user: User,
  stethoscope: Stethoscope,
};
const COLOURS: readonly Colour[] = [
  '#1D4ED8',
  '#16A34A',
  '#F59E0B',
  '#DC2626',
  '#7E22CE',
  '#0EA5E9',
  '#64748B',
];

/** A category's icon in its colour. */
function Badge({ category }: { category: Pick<PassengerCategory, 'icon' | 'colour' | 'name'> }) {
  const Glyph = ICONS[category.icon];
  return (
    <span
      className="inline-flex size-7 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: category.colour }}
      aria-hidden
    >
      <Glyph className="size-4" />
    </span>
  );
}

/**
 * Passenger categories (spec 10 §5.1, BRD D.3.1.10): who is seated first when demand exceeds
 * capacity (lower ranks first; crew changes, then VIP, then the rest), seat restrictions, the
 * source attribute mapped here, and the crew-change flag.
 */
export default function PassengerCategoriesPage() {
  const { t } = useTranslation();
  return (
    <MasterPage
      resource={resource}
      title={t('orgs.categories.title')}
      subtitle={t('orgs.categories.subtitle')}
      noun={t('orgs.categories.noun')}
      searchPlaceholder={t('orgs.categories.search')}
      describe={(c) => `${c.code} · ${c.name}`}
      form={CategoryForm}
      defaultSort={{ field: 'rank', dir: 'asc' }}
      columns={[
        {
          id: 'rank',
          header: t('orgs.categories.columns.rank'),
          sortField: 'rank',
          align: 'right',
          cell: (c) => c.priorityRank,
        },
        {
          id: 'name',
          header: t('orgs.categories.columns.name'),
          sortField: 'name',
          cell: (c) => (
            <div className="flex items-center gap-2">
              <Badge category={c} />
              <div>
                <p className="font-medium text-ink">{c.name}</p>
                <p className="font-mono text-xs text-ink-secondary">{c.code}</p>
              </div>
            </div>
          ),
        },
        {
          id: 'rules',
          header: t('orgs.categories.columns.rules'),
          cell: (c) => (
            <div className="flex flex-wrap gap-1">
              {c.isCrewChange && (
                <StatusPill tone="accent">{t('orgs.categories.crewChange')}</StatusPill>
              )}
              {c.seatForward && (
                <StatusPill tone="info">{t('orgs.categories.seatForward')}</StatusPill>
              )}
            </div>
          ),
        },
        {
          id: 'mapping',
          header: t('orgs.categories.columns.mapping'),
          cell: (c) => c.sourceMapping ?? '—',
        },
      ]}
    />
  );
}

function CategoryForm({ open, onOpenChange, record, onSaved }: MasterFormProps<PassengerCategory>) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const icons = Object.keys(ICONS) as Icon[];
  const schema = z.object({
    code: record
      ? z.string()
      : z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z0-9-]{2,20}$/, t('orgs.categories.form.codeInvalid')),
    name: z.string().trim().min(1, t('orgs.categories.form.nameRequired')).max(100),
    icon: z.enum(icons as [Icon, ...Icon[]]),
    colour: z.enum(COLOURS as [Colour, ...Colour[]]),
    priorityRank: z
      .string()
      .trim()
      .refine(
        (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 999,
        t('orgs.categories.form.rankInvalid'),
      ),
    seatForward: z.boolean(),
    isCrewChange: z.boolean(),
    sourceMapping: z.string().max(300),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      name: record?.name ?? '',
      icon: record?.icon ?? 'user',
      colour: record?.colour ?? '#64748B',
      priorityRank: record ? String(record.priorityRank) : '',
      seatForward: record?.seatForward ?? false,
      isCrewChange: record?.isCrewChange ?? false,
      sourceMapping: record?.sourceMapping ?? '',
    },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (v) => {
    setFailure(null);
    const body = {
      name: v.name,
      icon: v.icon,
      colour: v.colour,
      priorityRank: Number(v.priorityRank),
      seatForward: v.seatForward,
      isCrewChange: v.isCrewChange,
      sourceMapping: toNullable(v.sourceMapping),
    };
    try {
      await saveMaster('passenger-categories', record, record ? body : { ...body, code: v.code });
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : t('ui.confirm.failed'));
    }
  });

  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record
          ? t('orgs.categories.form.editTitle', { name: record.name })
          : t('orgs.categories.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label={t('orgs.categories.form.code')}
          error={errors.code?.message}
          disabled={record !== null}
          {...form.register('code')}
        />
        <Field
          label={t('orgs.categories.form.name')}
          error={errors.name?.message}
          {...form.register('name')}
        />
        <SelectField label={t('orgs.categories.form.icon')} {...form.register('icon')}>
          {icons.map((icon) => (
            <option key={icon} value={icon}>
              {t(`orgs.categories.icons.${icon}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('orgs.categories.form.colour')} {...form.register('colour')}>
          {COLOURS.map((colour) => (
            <option key={colour} value={colour}>
              {t(`orgs.categories.colours.${colour}`)}
            </option>
          ))}
        </SelectField>
        <div>
          <Field
            label={t('orgs.categories.form.rank')}
            inputMode="numeric"
            error={errors.priorityRank?.message}
            {...form.register('priorityRank')}
          />
          <p className="mt-1 text-xs text-ink-secondary">{t('orgs.categories.form.rankHint')}</p>
        </div>
        <div>
          <Field label={t('orgs.categories.form.mapping')} {...form.register('sourceMapping')} />
          <p className="mt-1 text-xs text-ink-secondary">{t('orgs.categories.form.mappingHint')}</p>
        </div>
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...form.register('seatForward')}
        />
        {t('orgs.categories.form.seatForward')}
      </label>
      <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          {...form.register('isCrewChange')}
        />
        {t('orgs.categories.form.crewChange')}
      </label>
    </EntityFormModal>
  );
}
