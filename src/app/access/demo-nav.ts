import {
  Ambulance,
  Anchor,
  Bell,
  Boxes,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  ChartPie,
  CirclePlus,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileClock,
  FileExclamationPoint,
  FileStack,
  FileText,
  Flag,
  Gauge,
  GitBranch,
  Hammer,
  History,
  Hourglass,
  KeySquare,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  List,
  ListChecks,
  Map,
  MapPin,
  MapPinned,
  MessageSquareWarning,
  Monitor,
  MonitorPlay,
  Package,
  PackageCheck,
  Palette,
  Plane,
  Radio,
  Receipt,
  Rotate3d,
  Route,
  ScrollText,
  Settings,
  Settings2,
  Shapes,
  ShieldCheck,
  ShieldQuestionMark,
  Ship,
  SlidersHorizontal,
  SquareCheckBig,
  SquarePlus,
  Tablet,
  Tag,
  Ticket,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserCog,
  UserSearch,
  Users,
  UsersRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { PageKey } from './registry';

/**
 * Demo: the sidebar menus of the original ADNOC LMS demo (names, order, grouping, icons),
 * pointing at this app's pages. Items the user may not view are hidden (menu.ts).
 */
export interface NavItem {
  readonly key: PageKey;
  readonly label: string;
  readonly icon: LucideIcon;
}
export interface NavSection {
  readonly label: string;
  readonly items: readonly NavItem[];
}
export interface NavGroup {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly sections: readonly NavSection[];
}

export const NAV_HOME: NavItem = { key: 'home', label: 'Dashboard', icon: LayoutDashboard };
export const NAV_ADMINISTRATION: NavItem = {
  key: 'demo.admin-home',
  label: 'Administration',
  icon: Settings,
};
export const NAV_SUPPORT: NavItem = { key: 'support', label: 'Support', icon: LifeBuoy };

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'People Logistics',
    icon: Plane,
    sections: [
      {
        label: 'Scheduling',
        items: [
          { key: 'scheduling.dashboard', label: 'Scheduling Dashboard', icon: LayoutDashboard },
          { key: 'scheduling.recurring', label: 'Recurring Schedule', icon: CalendarRange },
          { key: 'scheduling.adhoc', label: 'Ad Hoc Movement', icon: SquarePlus },
          { key: 'scheduling.board', label: 'Planning Board', icon: LayoutGrid },
        ],
      },
      {
        label: 'Booking',
        items: [
          { key: 'booking.dashboard', label: 'Booking Dashboard', icon: LayoutDashboard },
          { key: 'booking.bookings', label: 'Bookings', icon: List },
          { key: 'booking.passengers', label: 'Passengers', icon: UserSearch },
          { key: 'booking.create', label: 'Create Booking', icon: CirclePlus },
          { key: 'booking.bulk', label: 'Bulk Booking', icon: UsersRound },
          { key: 'freight.requests', label: 'Freight Requests', icon: Package },
          { key: 'booking.approvals', label: 'Approvals', icon: SquareCheckBig },
          { key: 'booking.rotation', label: 'Rotation Template', icon: Rotate3d },
        ],
      },
      {
        label: 'Dispatch',
        items: [
          { key: 'dispatch.dashboard', label: 'Dispatch Dashboard', icon: LayoutDashboard },
          { key: 'dispatch.manifest', label: 'Manifest Confirmation', icon: SquareCheckBig },
          { key: 'dispatch.quick-add', label: 'Quick Add', icon: UsersRound },
          { key: 'dispatch.flight', label: 'Flight Dispatch', icon: Monitor },
          { key: 'dispatch.status', label: 'Status Update', icon: Radio },
          { key: 'dispatch.cargo', label: 'Cargo Transfer', icon: Package },
          { key: 'dispatch.freight-receipt', label: 'Freight Receipt', icon: PackageCheck },
          { key: 'hems.flights', label: 'HEMS Flights', icon: Ambulance },
          { key: 'dispatch.hub-arrivals', label: 'HUB Arrivals', icon: GitBranch },
        ],
      },
      {
        label: 'Terminal',
        items: [
          { key: 'terminal.kiosk-portal', label: 'Terminal Portal', icon: Tablet },
          { key: 'terminal.kiosk', label: 'Passenger Check-in', icon: CreditCard },
          { key: 'terminal.boarding-pass', label: 'Boarding Pass', icon: Ticket },
          { key: 'terminal.fids', label: 'Flight Information', icon: MonitorPlay },
        ],
      },
      {
        label: 'Reporting',
        items: [
          { key: 'reports.executive-summary', label: 'Executive Summary', icon: ChartColumn },
          { key: 'reports.zone-performance', label: 'Zone-Wise Dashboard', icon: Map },
          { key: 'reports.passenger-movement', label: 'Passenger Movement', icon: TrendingUp },
          { key: 'demo.reports-mode-analysis', label: 'Mode Analysis', icon: ChartPie },
          { key: 'reports.cancellation-delay', label: 'Cancellations', icon: CircleX },
          { key: 'reports.on-time-performance', label: 'On-Time Performance', icon: Timer },
          { key: 'reports.travel-history', label: 'Travel History', icon: History },
          { key: 'reports.charge-codes', label: 'Charge / Back-Charge', icon: Receipt },
        ],
      },
    ],
  },
  {
    label: 'POB Tracking',
    icon: Users,
    sections: [
      {
        label: 'Dashboard & Live Tracking',
        items: [
          { key: 'pob.dashboard', label: 'POB Dashboard', icon: LayoutDashboard },
          { key: 'pob.map', label: 'Map View', icon: MapPin },
          { key: 'pob.asset', label: 'Asset Detail', icon: Building2 },
          { key: 'pob.overstay', label: 'Overstay Tracker', icon: Hourglass },
        ],
      },
      {
        label: 'Manual Site Check-in',
        items: [
          { key: 'pob.vessel-checkin', label: 'Vessel Check-in', icon: Ship },
          { key: 'pob.crew', label: 'Crew Entry', icon: UsersRound },
          { key: 'pob.location-override', label: 'Location Override', icon: MapPinned },
        ],
      },
      {
        label: 'Emergency & Muster',
        items: [
          { key: 'pob.emergency', label: 'Emergency Muster', icon: TriangleAlert },
          { key: 'pob.muster-console', label: 'Muster Console', icon: ClipboardList },
        ],
      },
      {
        label: 'Reporting',
        items: [
          { key: 'pob.report', label: 'Normal / Emergency POB', icon: FileText },
          { key: 'pob.residence', label: 'Residence Duration', icon: Hourglass },
          { key: 'reports.builder', label: 'Report Builder', icon: Settings2 },
          { key: 'reports.scheduler', label: 'Report Scheduler', icon: CalendarClock },
          { key: 'reports.adnoc-pob', label: 'Custom ADNOC Format', icon: FileClock },
        ],
      },
    ],
  },
  {
    label: 'Helideck Inspection & Tests',
    icon: ClipboardCheck,
    sections: [
      {
        label: '',
        items: [{ key: 'helideck.dashboard', label: 'Helideck Dashboard', icon: LayoutDashboard }],
      },
      {
        label: 'Planning',
        items: [
          { key: 'helideck.calendar', label: 'Inspection & Test Calendar', icon: CalendarDays },
          { key: 'helideck.request', label: 'Manual Inspection / Test Request', icon: CirclePlus },
          {
            key: 'helideck.checklist-builder',
            label: 'Inspection Checklist Builder',
            icon: ClipboardList,
          },
          {
            key: 'demo.helideck-test-checklist-builder',
            label: 'Test Checklist Builder',
            icon: ClipboardList,
          },
          {
            key: 'helideck.confirmation',
            label: 'Planned Inspection / Test Confirmation',
            icon: SquareCheckBig,
          },
          { key: 'helideck.approvals', label: 'Inspection / Test Approval Queue', icon: GitBranch },
          {
            key: 'helideck.question-bank',
            label: 'Crew Assessment Question Bank',
            icon: ListChecks,
          },
        ],
      },
      {
        label: 'Scheduling',
        items: [
          { key: 'helideck.assignment', label: 'Auditor / Inspector Assignment', icon: UserSearch },
        ],
      },
      {
        label: 'Execution & Approval Workflow',
        items: [
          { key: 'demo.helideck-inspections', label: 'Inspections & Tests List', icon: List },
          {
            key: 'helideck.corrective-actions',
            label: 'Corrective Action Tracker',
            icon: SquareCheckBig,
          },
          { key: 'helideck.findings', label: 'Finding Status Board', icon: FileExclamationPoint },
          { key: 'helideck.acceptance', label: 'Acceptance Letter', icon: FileClock },
          { key: 'helideck.crew-assessment', label: 'Crew Assessment', icon: Users },
          {
            key: 'demo.helideck-assessment-inspector',
            label: 'Crew Assessment — Inspector',
            icon: Tablet,
          },
          {
            key: 'demo.helideck-assessment-crew',
            label: 'Crew Assessment (Crew View)',
            icon: ListChecks,
          },
          { key: 'helideck.test-recording', label: 'Friction & Drop Test Recording', icon: Gauge },
          {
            key: 'helideck.test-review',
            label: 'Third-Party Test Review',
            icon: ShieldQuestionMark,
          },
          { key: 'gcaa.tracker', label: 'UAE GCAA PAO Audit Tracker', icon: ClipboardCheck },
        ],
      },
      {
        label: 'HIP / Asset Management',
        items: [
          { key: 'helideck.hll', label: 'HLL Central View', icon: Gauge },
          { key: 'helideck.map', label: 'Asset Map View', icon: Map },
        ],
      },
      {
        label: 'ASP Audits',
        items: [
          { key: 'asp.checklists', label: 'ASP Department Checklist Configuration', icon: Hammer },
          { key: 'asp.annual-plan', label: 'ASP Annual Audit Plan', icon: Hammer },
          { key: 'asp.calendar', label: 'ASP Audit Calendar', icon: Hammer },
          { key: 'asp.checklist', label: 'ASP Digital Audit Checklist', icon: Hammer },
          { key: 'asp.findings', label: 'ASP Finding View & Closure', icon: Hammer },
          {
            key: 'asp.corrective-actions',
            label: 'Corrective Action Tracker (ASP Team)',
            icon: Hammer,
          },
          { key: 'asp.audits', label: 'ASP Audits', icon: FileText },
        ],
      },
    ],
  },
];

export const NAV_ADMIN: readonly NavSection[] = [
  {
    label: 'Access Control',
    items: [
      { key: 'admin.users', label: 'Users', icon: Users },
      { key: 'admin.roles', label: 'Roles', icon: UserCog },
      { key: 'admin.access-rights', label: 'Access Rights Matrix', icon: KeySquare },
    ],
  },
  {
    label: 'Engines',
    items: [
      { key: 'admin.approval-engine', label: 'Approval Engine', icon: Workflow },
      { key: 'admin.business-rules', label: 'Business Rules', icon: SlidersHorizontal },
      { key: 'admin.notification-engine', label: 'Notification Engine', icon: Bell },
      { key: 'admin.reason-codes', label: 'Reason Codes', icon: MessageSquareWarning },
    ],
  },
  {
    label: 'Governance',
    items: [{ key: 'admin.audit-log', label: 'Audit Log', icon: ScrollText }],
  },
  {
    label: 'Shared Masters',
    items: [
      { key: 'admin.locations', label: 'Locations', icon: MapPin },
      { key: 'admin.installations', label: 'Installations', icon: Anchor },
      { key: 'admin.routes', label: 'Routes', icon: Route },
      { key: 'admin.zones', label: 'Zones', icon: Map },
      { key: 'admin.location-types', label: 'Location Types', icon: Layers },
      { key: 'admin.installation-types', label: 'Installation Types', icon: Shapes },
      { key: 'admin.resource-categories', label: 'Resource Categories', icon: Tag },
      { key: 'admin.resource-types', label: 'Resource Types', icon: Boxes },
      { key: 'admin.service-providers', label: 'Service Providers', icon: Building2 },
      { key: 'admin.passenger-categories', label: 'Passenger Categories', icon: Palette },
      { key: 'admin.charge-codes', label: 'Charge Codes', icon: Receipt },
    ],
  },
  {
    label: 'People Logistics',
    items: [
      { key: 'admin.fleet', label: 'Fleet', icon: Plane },
      { key: 'admin.quotas', label: 'Quotas', icon: ChartPie },
    ],
  },
  {
    label: 'POB Tracking',
    items: [
      { key: 'admin.muster-points', label: 'Muster Points', icon: Flag },
      { key: 'admin.lifeboats', label: 'Lifeboat Capacity', icon: LifeBuoy },
      { key: 'admin.essential-positions', label: 'Essential Positions', icon: ShieldCheck },
    ],
  },
  {
    label: 'Helideck Inspection',
    items: [
      { key: 'admin.inspection-types', label: 'Inspection / Test Types', icon: ClipboardCheck },
      { key: 'admin.documentation-matrix', label: 'Documentation Matrix', icon: FileStack },
    ],
  },
];
