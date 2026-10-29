import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { EntityFormModal } from '../../shared/ui/entity-form-modal';
import { Field, SelectField, TextAreaField } from '../../shared/ui/field';
import { FilterSelect } from '../../shared/ui/filter-select';
import { Markdown } from '../../shared/ui/markdown';
import { MasterPage, type MasterFormProps } from '../administration/masters/master-page';
import { type Article, articlesResource, saveArticle } from './support-api';

/** New article, or change one: markdown with a preview of what the Support page shows. */
function ArticleForm({ open, onOpenChange, record, onSaved }: MasterFormProps<Article>) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<string | null>(null);
  const schema = z.object({
    code: z.string().regex(/^[a-z][a-z0-9-]{2,60}$/, t('support.form.codeInvalid')),
    kind: z.enum(['faq', 'guide']),
    title: z.string().trim().min(1, t('support.form.titleRequired')).max(200),
    body: z.string().trim().min(1, t('support.form.bodyRequired')).max(20_000),
    sortOrder: z.string().regex(/^\d{1,4}$/, t('support.form.orderInvalid')),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: record?.code ?? '',
      kind: record?.kind ?? 'faq',
      title: record?.title ?? '',
      body: record?.body ?? '',
      sortOrder: String(record?.sortOrder ?? 100),
    },
  });
  const body = useWatch({ control: form.control, name: 'body' });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await saveArticle(record, { ...values, sortOrder: Number(values.sortOrder) });
      onSaved();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t('ui.confirm.failed'));
    }
  });
  return (
    <EntityFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        record ? t('support.form.editTitle', { title: record.title }) : t('support.form.newTitle')
      }
      onSubmit={submit}
      submitting={isSubmitting}
      error={failure}
      size="lg"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label={t('support.form.code')}
          error={errors.code?.message}
          readOnly={record !== null}
          {...form.register('code')}
        />
        <SelectField label={t('support.form.kind')} {...form.register('kind')}>
          <option value="faq">{t('support.kind.faq')}</option>
          <option value="guide">{t('support.kind.guide')}</option>
        </SelectField>
        <Field
          label={t('support.form.order')}
          inputMode="numeric"
          error={errors.sortOrder?.message}
          {...form.register('sortOrder')}
        />
      </div>
      <Field
        label={t('support.form.titleField')}
        error={errors.title?.message}
        {...form.register('title')}
      />
      <div className="space-y-1">
        <TextAreaField
          label={t('support.form.body')}
          rows={8}
          error={errors.body?.message}
          {...form.register('body')}
        />
        <p className="text-xs text-ink-muted">{t('support.form.bodyHint')}</p>
      </div>
      {body.trim() && (
        <section
          aria-labelledby="article-preview"
          className="space-y-1 rounded-md bg-surface-muted p-3"
        >
          <h3 id="article-preview" className="text-xs font-medium text-ink-secondary">
            {t('support.form.preview')}
          </h3>
          <Markdown text={body} />
        </section>
      )}
    </EntityFormModal>
  );
}

/** The Support page's articles (spec 10 §1.4): questions and guides, in markdown. */
export default function SupportArticlesPage() {
  const { t } = useTranslation();
  return (
    <MasterPage
      resource={articlesResource}
      title={t('support.articles.title')}
      subtitle={t('support.articles.subtitle')}
      noun={t('support.articles.noun')}
      searchPlaceholder={t('support.articles.search')}
      describe={(a) => a.title}
      form={ArticleForm}
      defaultSort={{ field: 'sortOrder', dir: 'asc' }}
      columns={[
        {
          id: 'title',
          header: t('support.articles.columns.title'),
          sortField: 'title',
          cell: (a) => (
            <div>
              <p className="font-medium text-ink">{a.title}</p>
              <p className="text-xs text-ink-secondary">{a.code}</p>
            </div>
          ),
        },
        {
          id: 'kind',
          header: t('support.articles.columns.kind'),
          sortField: 'kind',
          cell: (a) => t(`support.kind.${a.kind}`),
        },
        {
          id: 'order',
          header: t('support.articles.columns.order'),
          sortField: 'sortOrder',
          align: 'right',
          cell: (a) => a.sortOrder,
        },
      ]}
      filters={({ params, update }) => (
        <FilterSelect
          label={t('support.articles.columns.kind')}
          allLabel={t('ui.filter.all')}
          value={params.filters.kind}
          options={(['faq', 'guide'] as const).map((k) => ({
            value: k,
            label: t(`support.kind.${k}`),
          }))}
          onChange={(v) =>
            update({
              filters: v
                ? { ...params.filters, kind: v }
                : Object.fromEntries(Object.entries(params.filters).filter(([k]) => k !== 'kind')),
            })
          }
        />
      )}
    />
  );
}
