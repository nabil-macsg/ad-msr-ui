import { ExternalLink, LifeBuoy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../shared/ui/banner';
import { Markdown } from '../../shared/ui/markdown';
import { PageHeader } from '../../shared/ui/page-header';
import { Spinner } from '../../shared/ui/spinner';
import { useSupport } from './support-api';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-card"
    >
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Support (spec 10 §1.4): who to contact, and how the system behaves. Every signed-in user (P-52). */
export default function SupportPage() {
  const { t } = useTranslation();
  const support = useSupport();
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader title={t('support.title')} subtitle={t('support.subtitle')} />
      {support.isPending && <Spinner label={t('loading')} />}
      {support.isError && <Banner tone="danger">{t('support.loadFailed')}</Banner>}
      {support.data && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section id="support-technical" title={t('support.technical.title')}>
              <p className="flex items-start gap-2 text-sm text-ink-secondary">
                <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t('support.technical.body')}
              </p>
              {support.data.portalUrl ? (
                <a
                  href={support.data.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline"
                >
                  {t('support.technical.portal')}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <p className="text-sm text-ink">{t('support.technical.noPortal')}</p>
              )}
            </Section>
            <Section id="support-contacts" title={t('support.contacts.title')}>
              <p className="text-sm text-ink-secondary">{t('support.contacts.body')}</p>
              {support.data.contacts.length === 0 ? (
                <p className="text-sm text-ink">{t('support.contacts.none')}</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">{t('support.contacts.title')}</caption>
                  <thead>
                    <tr className="text-left text-ink-secondary">
                      <th scope="col" className="py-1 font-medium">
                        {t('support.contacts.location')}
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        {t('support.contacts.focalPoint')}
                      </th>
                      <th scope="col" className="py-1 font-medium">
                        {t('support.contacts.email')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {support.data.contacts.map((c) => (
                      <tr key={c.code} className="border-t border-border">
                        <td className="py-1.5">{c.location}</td>
                        <td className="py-1.5">{c.name}</td>
                        <td className="py-1.5">
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-primary underline">
                              {c.email}
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>
          {(['faqs', 'guides'] as const).map((kind) => (
            <Section key={kind} id={`support-${kind}`} title={t(`support.${kind}`)}>
              <div className="divide-y divide-border">
                {support.data[kind].map((item) => (
                  <details key={item.id} className="group py-2">
                    <summary className="flex min-h-touch cursor-pointer items-center text-sm font-medium text-ink">
                      {item.title}
                    </summary>
                    <Markdown text={item.body} className="space-y-2 pb-2 text-sm text-ink" />
                  </details>
                ))}
              </div>
            </Section>
          ))}
        </>
      )}
    </section>
  );
}
