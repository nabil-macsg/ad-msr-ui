import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { type PageKey, routeOf } from '../../app/access/registry';
import { pageIcon } from '../../app/shell/nav-icons';
import { PageHeader } from '../../shared/ui/page-header';

/** The original landing's two groups of tiles, in its order. */
const GROUPS: readonly { title: string; tiles: readonly [string, PageKey][] }[] = [
  {
    title: 'Master Data',
    tiles: [
      ['Locations', 'admin.locations'],
      ['Installations', 'admin.installations'],
      ['Routes', 'admin.routes'],
      ['Zones', 'admin.zones'],
      ['Location Types', 'admin.location-types'],
      ['Installation Types', 'admin.installation-types'],
      ['Fleet', 'admin.fleet'],
      ['Quotas', 'admin.quotas'],
      ['Resource Categories', 'admin.resource-categories'],
      ['Resource Types', 'admin.resource-types'],
      ['Service Providers', 'admin.service-providers'],
      ['Passenger Categories', 'admin.passenger-categories'],
      ['Charge Codes', 'admin.charge-codes'],
      ['Reason Codes', 'admin.reason-codes'],
    ],
  },
  {
    title: 'Users & Engines',
    tiles: [
      ['Users & Roles', 'admin.users'],
      ['Approval Engine', 'admin.approval-engine'],
      ['Business Rules', 'admin.business-rules'],
      ['Notification Engine', 'admin.notification-engine'],
    ],
  },
];

/** Administration landing (original `admin`): tiles into each master and engine. */
export default function AdminHomePage() {
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Master data, user access and workflow configuration for the LMS"
      />
      {GROUPS.map((group) => (
        <section key={group.title} aria-labelledby={`group-${group.title}`} className="space-y-3">
          <h2 id={`group-${group.title}`} className="text-sm font-semibold text-ink">
            {group.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.tiles.map(([label, key]) => {
              const Icon = pageIcon(key);
              return (
                <li key={key}>
                  <Link
                    to={routeOf(key)}
                    className="flex min-h-touch items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-ink transition-all hover:border-primary/40 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="size-4 text-ink-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
