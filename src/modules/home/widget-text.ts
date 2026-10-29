import type { TFunction } from 'i18next';
import { formatGst, formatGstTime } from '../../shared/time/format';
import type { HomeWidget } from './home-api';

/** How the web words a widget: its title, its sub-line, and its items' states and times. */
interface WidgetText {
  readonly title: (t: TFunction) => string;
  readonly subline?: (t: TFunction, w: HomeWidget) => string;
  readonly empty?: (t: TFunction) => string;
  readonly status?: (t: TFunction, status: string) => string;
  readonly at?: (t: TFunction, at: string) => string;
  /** A first column, e.g. a departure time. */
  readonly lead?: (t: TFunction, item: HomeWidget['items'][number]) => string;
}

const num = (w: HomeWidget, name: string) => Number(w.params[name] ?? 0);

/**
 * The widgets this web app knows, by key (spec 10 §1.1). The API decides who sees which; the
 * operational modules add theirs in their phases. A key not listed here is not shown.
 */
export const WIDGETS: Readonly<Record<string, WidgetText>> = {
  'approvals.waiting': {
    title: (t) => t('home.widgets.approvals.title'),
    subline: (t, w) =>
      num(w, 'overdue') > 0
        ? t('home.widgets.approvals.overdue', { count: num(w, 'overdue') })
        : t('home.widgets.approvals.onTime'),
    empty: (t) => t('home.widgets.approvals.empty'),
    status: (t) => t('home.widgets.approvals.overdueItem'),
    at: (t, at) => t('home.widgets.approvals.due', { when: formatGst(at) }),
  },
  'scheduling.today': {
    title: (t) => t('home.widgets.today.title'),
    subline: (t, w) =>
      num(w, 'withoutTime') > 0
        ? t('home.widgets.today.withoutTime', { count: num(w, 'withoutTime') })
        : t('home.widgets.today.count', { count: w.value ?? 0 }),
    empty: (t) => t('home.widgets.today.empty'),
    status: (t, status) =>
      t(`scheduling.journeys.status.${status as 'scheduled'}`, { defaultValue: status }),
    lead: (t, item) => (item.at ? formatGstTime(item.at) : t('home.widgets.today.noTime')),
  },
  'delegations.mine': {
    title: (t) => t('home.widgets.delegations.title'),
    subline: (t, w) =>
      t('home.widgets.delegations.subline', {
        given: num(w, 'given'),
        scheduled: num(w, 'scheduled'),
      }),
  },
  'access.expiring': {
    title: (t) => t('home.widgets.expiring.title'),
    subline: (t, w) => t('home.widgets.expiring.subline', { withoutRoles: num(w, 'withoutRoles') }),
  },
  'sync.health': {
    title: (t) => t('home.widgets.sync.title'),
    subline: (t, w) =>
      (w.value ?? 0) > 0
        ? t('home.widgets.sync.failing', { count: w.value ?? 0 })
        : t('home.widgets.sync.healthy'),
    status: (t, status) =>
      t(`home.widgets.sync.status.${status as 'succeeded'}`, {
        defaultValue: status,
      }),
    at: (t, at) => t('home.widgets.sync.lastRun', { when: formatGst(at) }),
  },
};
