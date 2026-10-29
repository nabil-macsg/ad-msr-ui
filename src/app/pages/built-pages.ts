import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import type { PageKey } from '../access/registry';

/**
 * Pages that are built. Each module adds its pages here as its phase delivers them; every
 * other registry route shows "In scope, not built yet" (PROMPT §0, plan P0-14).
 */
export const BUILT_PAGES: Partial<Record<PageKey, LazyExoticComponent<ComponentType>>> = {
  // Shared pages
  home: lazy(() => import('../../modules/home/HomePage')),
  account: lazy(() => import('../../modules/account/AccountPage')),
  notifications: lazy(() => import('../../modules/account/NotificationsPage')),
  support: lazy(() => import('../../modules/support/SupportPage')),
  // Demo only: representative screens for modules MASAR hasn't built yet (src/demo).
  'booking.dashboard': lazy(() =>
    import('../../demo/screens').then((m) => ({ default: m.BookingDashboardScreen })),
  ),
  'booking.bookings': lazy(() =>
    import('../../demo/screens').then((m) => ({ default: m.BookingsScreen })),
  ),
  'dispatch.dashboard': lazy(() =>
    import('../../demo/screens').then((m) => ({ default: m.DispatchScreen })),
  ),
  'pob.dashboard': lazy(() => import('../../demo/screens').then((m) => ({ default: m.PobScreen }))),
  'helideck.dashboard': lazy(() =>
    import('../../demo/screens').then((m) => ({ default: m.HelideckScreen })),
  ),
  'reports.executive-summary': lazy(() =>
    import('../../demo/screens').then((m) => ({ default: m.ReportsScreen })),
  ),
  // Phase 2 — Scheduling (spec 20 §2)
  'scheduling.dashboard': lazy(
    () => import('../../modules/people-logistics/scheduling/SchedulingDashboardPage'),
  ),
  'scheduling.recurring': lazy(
    () => import('../../modules/people-logistics/scheduling/RecurringSchedulesPage'),
  ),
  'scheduling.adhoc': lazy(
    () => import('../../modules/people-logistics/scheduling/AdhocMovementsPage'),
  ),
  'scheduling.board': lazy(
    () => import('../../modules/people-logistics/scheduling/PlanningBoardPage'),
  ),
  'scheduling.premanifest': lazy(
    () => import('../../modules/people-logistics/scheduling/PremanifestPage'),
  ),
  'scheduling.requests': lazy(
    () => import('../../modules/people-logistics/scheduling/UnscheduledRequestsPage'),
  ),
  // Phase 1 — Administration (spec 10)
  'admin.users': lazy(() => import('../../modules/administration/users/UsersPage')),
  'admin.roles': lazy(() => import('../../modules/administration/access-control/RolesPage')),
  'admin.delegations': lazy(
    () => import('../../modules/administration/delegations/DelegationsPage'),
  ),
  'admin.devices': lazy(() => import('../../modules/administration/devices/DevicesPage')),
  'admin.access-rights': lazy(
    () => import('../../modules/administration/access-control/MatrixPage'),
  ),
  'admin.approval-engine': lazy(
    () => import('../../modules/administration/approval-engine/ApprovalEnginePage'),
  ),
  'admin.business-rules': lazy(
    () => import('../../modules/administration/business-rules/BusinessRulesPage'),
  ),
  'admin.notification-engine': lazy(
    () => import('../../modules/administration/notification-engine/NotificationEnginePage'),
  ),
  'admin.reason-codes': lazy(
    () => import('../../modules/administration/reason-codes/ReasonCodesPage'),
  ),
  'admin.audit-log': lazy(() => import('../../modules/administration/audit-log/AuditLogPage')),
  'admin.support-articles': lazy(() => import('../../modules/support/SupportArticlesPage')),
  'admin.external-contacts': lazy(
    () => import('../../modules/administration/external-contacts/ExternalContactsPage'),
  ),
  'admin.zones': lazy(() => import('../../modules/administration/places/ZonesPage')),
  'admin.location-types': lazy(
    () => import('../../modules/administration/places/LocationTypesPage'),
  ),
  'admin.locations': lazy(() => import('../../modules/administration/places/LocationsPage')),
  'admin.installation-types': lazy(
    () => import('../../modules/administration/places/InstallationTypesPage'),
  ),
  'admin.installations': lazy(
    () => import('../../modules/administration/places/InstallationsPage'),
  ),
  'admin.routes': lazy(() => import('../../modules/administration/places/RoutesPage')),
  'admin.resource-categories': lazy(
    () => import('../../modules/administration/resources/ResourceCategoriesPage'),
  ),
  'admin.resource-types': lazy(
    () => import('../../modules/administration/resources/ResourceTypesPage'),
  ),
  'admin.aircraft-models': lazy(
    () => import('../../modules/administration/resources/AircraftModelsPage'),
  ),
  'admin.fleet': lazy(() => import('../../modules/administration/resources/FleetPage')),
  'admin.quotas': lazy(() => import('../../modules/administration/resources/QuotasPage')),
  'admin.cargo-types': lazy(() => import('../../modules/administration/resources/CargoTypesPage')),
  'admin.fuel-stations': lazy(
    () => import('../../modules/administration/resources/FuelStationsPage'),
  ),
  'admin.muster-points': lazy(
    () => import('../../modules/administration/pob-masters/MusterPointsPage'),
  ),
  'admin.lifeboats': lazy(() => import('../../modules/administration/pob-masters/LifeboatsPage')),
  'admin.essential-positions': lazy(
    () => import('../../modules/administration/pob-masters/EssentialPositionsPage'),
  ),
  'admin.pending-changes': lazy(
    () => import('../../modules/administration/pob-masters/PendingChangesPage'),
  ),
  'admin.service-providers': lazy(
    () => import('../../modules/administration/organisations/ServiceProvidersPage'),
  ),
  'admin.passenger-categories': lazy(
    () => import('../../modules/administration/organisations/PassengerCategoriesPage'),
  ),
  'admin.charge-codes': lazy(
    () => import('../../modules/administration/organisations/ChargeCodesPage'),
  ),
  'admin.departments': lazy(() =>
    import('../../modules/administration/organisations/OrgUnitPages').then((m) => ({
      default: m.DepartmentsPage,
    })),
  ),
  'admin.companies': lazy(() =>
    import('../../modules/administration/organisations/OrgUnitPages').then((m) => ({
      default: m.CompaniesPage,
    })),
  ),
};
