import { Link } from 'react-router';
import { routeOf } from '../../app/access/registry';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusPill } from '../../shared/ui/status-pill';

const NEEDED = [
  {
    title: 'The report template',
    body: 'The layout, column order and headings the report must come out in, as the recipients already expect to read it. Anything built before it arrives would have to be rebuilt.',
  },
  {
    title: 'The alert thresholds',
    body: 'What figure triggers an alert, at what level, and who it goes to. The report and the alerting are named together on the same row.',
  },
];

const BUILT = [
  { label: 'the daily POB report', to: routeOf('pob.report') },
  { label: 'the residence duration report', to: routeOf('pob.residence') },
  { label: 'the report builder', to: routeOf('reports.builder') },
  { label: 'the report scheduler', to: routeOf('reports.scheduler') },
];

/** Custom ADNOC-Format POB Report: awaiting the client's report template. */
export default function AdnocPobReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Custom ADNOC-Format POB Report"
        subtitle="Awaiting the client's report template"
      />
      <section className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">
              Not built — the format has not been issued
            </h2>
            <StatusPill tone="warning">Awaiting template</StatusPill>
          </div>
          <p className="max-w-3xl text-sm text-ink-body">
            This report is specified as following ADNOC&apos;s own template, which has not been
            finalised or delivered. It is a distinct requirement from the standard POB reports,
            which are built and working:{' '}
            {BUILT.map((b, i) => (
              <span key={b.to}>
                <Link to={b.to} className="text-link hover:underline">
                  {b.label}
                </Link>
                {i < BUILT.length - 2 ? ', ' : i === BUILT.length - 2 ? ' and ' : '.'}
              </span>
            ))}
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="text-label font-semibold text-ink-muted">
            What is needed before it can be built
          </h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {NEEDED.map((n) => (
              <li key={n.title} className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="font-medium text-ink">{n.title}</p>
                <p className="mt-1 text-sm text-ink-secondary">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
