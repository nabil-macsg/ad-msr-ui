/* GENERATED from contracts/openapi.yaml by `pnpm api:generate`. Do not edit by hand. */

export const RIGHTS = [
  "view",
  "create",
  "edit",
  "deactivate",
  "delete",
  "export",
  "reopen"
] as const;
export type Right = (typeof RIGHTS)[number];

export const MODULES = [
  {
    "key": "people-logistics",
    "label": "People Logistics",
    "sidebar": "PEOPLE LOGISTICS"
  },
  {
    "key": "pob",
    "label": "POB Tracking",
    "sidebar": "POB TRACKING"
  },
  {
    "key": "helideck",
    "label": "Helideck Inspection & Tests",
    "sidebar": "HELIDECK INSPECTION & TESTS"
  },
  {
    "key": "aviation-compliance",
    "label": "Aviation Compliance",
    "sidebar": "AVIATION COMPLIANCE"
  },
  {
    "key": "reporting",
    "label": "Reports & Insights",
    "sidebar": "REPORTS & INSIGHTS"
  },
  {
    "key": "administration",
    "label": "Administration",
    "sidebar": "ADMINISTRATION"
  },
  {
    "key": "ai",
    "label": "AI assistant",
    "sidebar": "AI ASSISTANT"
  }
] as const;
export type ModuleKey = (typeof MODULES)[number]['key'];

export type Layout = 'main' | 'admin' | 'kiosk' | 'fids' | 'print';

export interface RegistryPage {
  readonly key: string;
  readonly module: ModuleKey | 'shared';
  /** Sidebar sub-section, upper case. */
  readonly area: string;
  readonly label: string;
  /** Web route; null for app-only features. */
  readonly route: string | null;
  readonly channel: 'web' | 'mobile';
  readonly rights: readonly Right[];
  /** Shown in the sidebar (detail pages are reached from lists). */
  readonly menu: boolean;
  readonly layout: Layout;
  /** Held by an open point until it is answered. */
  readonly heldBy: string | null;
}

export const PAGES = [
  {
    "key": "home",
    "module": "shared",
    "area": "HOME",
    "label": "Home",
    "route": "/",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "notifications",
    "module": "shared",
    "area": "HOME",
    "label": "Notifications",
    "route": "/notifications",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "account",
    "module": "shared",
    "area": "ACCOUNT",
    "label": "My account",
    "route": "/account",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "support",
    "module": "shared",
    "area": "SUPPORT",
    "label": "Support",
    "route": "/support",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.dashboard",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Scheduling Dashboard",
    "route": "/scheduling",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.recurring",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Recurring Schedules",
    "route": "/scheduling/recurring",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.adhoc",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Ad Hoc Movements",
    "route": "/scheduling/adhoc",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.board",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Planning Board",
    "route": "/scheduling/board",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.premanifest",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Pre-manifest",
    "route": "/scheduling/premanifest",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "scheduling.requests",
    "module": "people-logistics",
    "area": "SCHEDULING",
    "label": "Unscheduled Requests",
    "route": "/scheduling/requests",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.dashboard",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Booking Dashboard",
    "route": "/booking",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.bookings",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Bookings",
    "route": "/booking/my-bookings",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.detail",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Booking Detail",
    "route": "/booking/:ref",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "reopen"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.create",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Create Booking",
    "route": "/booking/create",
    "channel": "web",
    "rights": [
      "view",
      "create"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.bulk",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Bulk Booking",
    "route": "/booking/bulk",
    "channel": "web",
    "rights": [
      "view",
      "create"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.approvals",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Approvals",
    "route": "/booking/approvals",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.passengers",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Passengers",
    "route": "/booking/passengers",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.rotation",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Rotation Template",
    "route": "/booking/rotation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.quota-overrides",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Quota Overrides",
    "route": "/booking/quota-overrides",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.insight",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Booking Insight",
    "route": "/booking/insight",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "booking.vip-reservations",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "VIP Seat Reservations",
    "route": "/booking/vip-reservations",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "freight.requests",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Freight Requests",
    "route": "/booking/freight",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "freight.create",
    "module": "people-logistics",
    "area": "BOOKING",
    "label": "Create Freight Booking",
    "route": "/booking/freight/new",
    "channel": "web",
    "rights": [
      "view",
      "create"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.dashboard",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Dispatch Dashboard",
    "route": "/dispatch",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.manifest",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Manifest Confirmation",
    "route": "/dispatch/manifest",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.quick-add",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Quick Add",
    "route": "/dispatch/quick-add",
    "channel": "web",
    "rights": [
      "view",
      "create"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.flight",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Flight Dispatch",
    "route": "/dispatch/flight",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.status",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Status Update",
    "route": "/dispatch/status",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.hub-arrivals",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "HUB Arrivals",
    "route": "/dispatch/hub-arrivals",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.cargo",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Cargo Transfer",
    "route": "/dispatch/cargo",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "dispatch.freight-receipt",
    "module": "people-logistics",
    "area": "DISPATCH",
    "label": "Freight Receipt",
    "route": "/dispatch/freight-receipt",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "terminal.kiosk-portal",
    "module": "people-logistics",
    "area": "TERMINAL",
    "label": "Kiosk Portal",
    "route": "/dispatch/kiosk-portal",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "kiosk",
    "heldBy": null
  },
  {
    "key": "terminal.kiosk",
    "module": "people-logistics",
    "area": "TERMINAL",
    "label": "Check-in Kiosk",
    "route": "/dispatch/kiosk",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "kiosk",
    "heldBy": null
  },
  {
    "key": "terminal.fids",
    "module": "people-logistics",
    "area": "TERMINAL",
    "label": "Flight Information Display",
    "route": "/dispatch/fids",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "fids",
    "heldBy": null
  },
  {
    "key": "terminal.boarding-pass",
    "module": "people-logistics",
    "area": "TERMINAL",
    "label": "Boarding Pass",
    "route": "/dispatch/boarding-pass/:legId",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": false,
    "layout": "print",
    "heldBy": null
  },
  {
    "key": "hems.flights",
    "module": "people-logistics",
    "area": "SUPPORT FUNCTIONS",
    "label": "HEMS Flights",
    "route": "/dispatch/hems",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "flight-log.entries",
    "module": "people-logistics",
    "area": "SUPPORT FUNCTIONS",
    "label": "Flight Log",
    "route": "/dispatch/flight-log",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "fuel.stock",
    "module": "people-logistics",
    "area": "SUPPORT FUNCTIONS",
    "label": "Fuel Stock",
    "route": "/fuel/stock",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "fuel.log",
    "module": "people-logistics",
    "area": "SUPPORT FUNCTIONS",
    "label": "Fueling Log",
    "route": "/fuel/log",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "provider.journeys",
    "module": "people-logistics",
    "area": "SERVICE PROVIDER",
    "label": "My Journeys",
    "route": "/provider/journeys",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "provider.load-sheets",
    "module": "people-logistics",
    "area": "SERVICE PROVIDER",
    "label": "Load Sheets",
    "route": "/provider/load-sheets",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "provider.fleet",
    "module": "people-logistics",
    "area": "SERVICE PROVIDER",
    "label": "My Fleet",
    "route": "/provider/fleet",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "provider.flight-logs",
    "module": "people-logistics",
    "area": "SERVICE PROVIDER",
    "label": "Flight Logs",
    "route": "/provider/flight-logs",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.dashboard",
    "module": "pob",
    "area": "LIVE",
    "label": "POB Dashboard",
    "route": "/pob/dashboard",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.map",
    "module": "pob",
    "area": "LIVE",
    "label": "Map View",
    "route": "/pob/map",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.asset",
    "module": "pob",
    "area": "LIVE",
    "label": "Asset Detail",
    "route": "/pob/asset/:locationId",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.overstay",
    "module": "pob",
    "area": "LIVE",
    "label": "Overstay Tracker",
    "route": "/pob/overstay",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.checkin",
    "module": "pob",
    "area": "RECORDS",
    "label": "Offshore Check-in",
    "route": "/pob/checkin",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.vessel-checkin",
    "module": "pob",
    "area": "RECORDS",
    "label": "Vessel / Barge Check-in",
    "route": "/pob/vessel-checkin",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.crew",
    "module": "pob",
    "area": "RECORDS",
    "label": "Crew Entry",
    "route": "/pob/crew",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.location-override",
    "module": "pob",
    "area": "RECORDS",
    "label": "Location Override",
    "route": "/pob/location-override",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.emergency",
    "module": "pob",
    "area": "EMERGENCY",
    "label": "Emergency Muster",
    "route": "/pob/emergency",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.muster-console",
    "module": "pob",
    "area": "EMERGENCY",
    "label": "Muster Console",
    "route": "/pob/muster-console",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.report",
    "module": "pob",
    "area": "REPORTS",
    "label": "POB Report",
    "route": "/pob/report",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "pob.residence",
    "module": "pob",
    "area": "REPORTS",
    "label": "Residence Duration",
    "route": "/pob/residence",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.dashboard",
    "module": "helideck",
    "area": "OVERVIEW",
    "label": "Helideck Dashboard",
    "route": "/helideck",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.hll",
    "module": "helideck",
    "area": "OVERVIEW",
    "label": "Helideck Limitations List",
    "route": "/helideck/hll",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.map",
    "module": "helideck",
    "area": "OVERVIEW",
    "label": "Asset Map View",
    "route": "/helideck/map",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.calendar",
    "module": "helideck",
    "area": "PLANNING",
    "label": "Inspection & Test Calendar",
    "route": "/helideck/calendar",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.annual-plan",
    "module": "helideck",
    "area": "PLANNING",
    "label": "Annual Verification Plan",
    "route": "/helideck/annual-plan",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.request",
    "module": "helideck",
    "area": "PLANNING",
    "label": "Ad Hoc Request",
    "route": "/helideck/request",
    "channel": "web",
    "rights": [
      "view",
      "create"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.approvals",
    "module": "helideck",
    "area": "APPROVALS",
    "label": "Approval Queue",
    "route": "/helideck/approvals",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.confirmation",
    "module": "helideck",
    "area": "APPROVALS",
    "label": "Readiness Confirmation",
    "route": "/helideck/confirmation",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.assignment",
    "module": "helideck",
    "area": "EXECUTION",
    "label": "Inspector Assignment",
    "route": "/helideck/assignment",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.checklist",
    "module": "helideck",
    "area": "EXECUTION",
    "label": "Digital Checklist",
    "route": "/helideck/checklist/:ref",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "reopen"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.checklist-builder",
    "module": "helideck",
    "area": "EXECUTION",
    "label": "Checklist Builder",
    "route": "/helideck/checklist-builder",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.test-recording",
    "module": "helideck",
    "area": "TESTS",
    "label": "Test Recording",
    "route": "/helideck/test-recording",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.test-review",
    "module": "helideck",
    "area": "TESTS",
    "label": "Test Review",
    "route": "/helideck/test-review",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.findings",
    "module": "helideck",
    "area": "FINDINGS",
    "label": "Finding Status Board",
    "route": "/helideck/findings",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.corrective-actions",
    "module": "helideck",
    "area": "FINDINGS",
    "label": "Corrective Action Tracker",
    "route": "/helideck/corrective-actions",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.acceptance",
    "module": "helideck",
    "area": "ACCEPTANCE",
    "label": "Acceptance Letter",
    "route": "/helideck/acceptance",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.documents",
    "module": "helideck",
    "area": "ACCEPTANCE",
    "label": "Document Library",
    "route": "/helideck/installations/:id/documents",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.crew-assessment",
    "module": "helideck",
    "area": "CREW",
    "label": "Crew Assessment",
    "route": "/helideck/crew-assessment",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "helideck.question-bank",
    "module": "helideck",
    "area": "CREW",
    "label": "Question Bank",
    "route": "/helideck/question-bank",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.audits",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "ASP Audits",
    "route": "/aviation/asp",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.annual-plan",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Annual Audit Plan",
    "route": "/aviation/asp/annual-plan",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.calendar",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Audit Calendar",
    "route": "/aviation/asp/calendar",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.departments",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Department Setup",
    "route": "/aviation/asp/audits/:ref/departments",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.checklists",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Department Checklist Configuration",
    "route": "/aviation/asp/checklists",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.checklist",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Digital Audit Checklist",
    "route": "/aviation/asp/checklist/:ref/:department",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "reopen"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.review",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Audit Review",
    "route": "/aviation/asp/review/:ref",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.findings",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Findings & Closure",
    "route": "/aviation/asp/findings",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "asp.corrective-actions",
    "module": "aviation-compliance",
    "area": "ASP AUDITS",
    "label": "Corrective Action Tracker",
    "route": "/aviation/asp/corrective-actions",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "gcaa.tracker",
    "module": "aviation-compliance",
    "area": "GCAA",
    "label": "GCAA PAO Audit Tracker",
    "route": "/aviation/gcaa-tracker",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "gcaa.internal-audits",
    "module": "aviation-compliance",
    "area": "GCAA",
    "label": "Internal GCAA Audits",
    "route": "/aviation/internal-audits",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export",
      "reopen"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "registers.airworthiness",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Airworthiness Documents",
    "route": "/aviation/registers/airworthiness",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.maintenance-plan",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Maintenance Plan & Status",
    "route": "/aviation/registers/maintenance-plan",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.ad-sb",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "AD/SB Compliance",
    "route": "/aviation/registers/ad-sb",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.defects",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Defects, MEL & Downtime",
    "route": "/aviation/registers/defects",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.maintenance-audits",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Maintenance Audits",
    "route": "/aviation/registers/maintenance-audits",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.occurrences",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Occurrences & Incidents",
    "route": "/aviation/registers/occurrences",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.moc-reviews",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Project / MOC Reviews",
    "route": "/aviation/registers/moc-reviews",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.orientation-assessments",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Rig/Barge Orientation Assessments",
    "route": "/aviation/registers/orientation-assessments",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "registers.aerodrome-documents",
    "module": "aviation-compliance",
    "area": "TECHNICAL REGISTERS",
    "label": "Aerodrome Documents",
    "route": "/aviation/registers/aerodrome-documents",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.executive-summary",
    "module": "reporting",
    "area": "EXECUTIVE",
    "label": "Executive Summary",
    "route": "/reports/executive-summary",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.zone-performance",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Zone Performance",
    "route": "/reports/zone-performance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.passenger-movement",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Passenger Movement",
    "route": "/reports/passenger-movement",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.helicopter-operations",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Helicopter Operations",
    "route": "/reports/helicopter-operations",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.marine-operations",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Marine Operations",
    "route": "/reports/marine-operations",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.crew-change",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Crew Change Management",
    "route": "/reports/crew-change",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.travel-compliance",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Compliance Dashboard",
    "route": "/reports/travel-compliance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.vip-movements",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "VIP Movements",
    "route": "/reports/vip-movements",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.cancellation-delay",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Cancellation & Delay",
    "route": "/reports/cancellation-delay",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.seat-utilisation",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Seat & Capacity Utilisation",
    "route": "/reports/seat-utilisation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.asset-utilisation",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Asset Utilisation",
    "route": "/reports/asset-utilisation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.cost-efficiency",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Cost & Efficiency",
    "route": "/reports/cost-efficiency",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.daily-flight-hours",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Daily Flight Hours",
    "route": "/reports/daily-flight-hours",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.fuel-consumption",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Fuel Consumption & Stock",
    "route": "/reports/fuel-consumption",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.invoicing",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Fixed Wing / Ferry / Helicopter Invoicing",
    "route": "/reports/invoicing",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.on-time-performance",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "On-Time Performance",
    "route": "/reports/on-time-performance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.recovery-plan",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Recovery Plan",
    "route": "/reports/recovery-plan",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.resource-utilisation",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Resource Utilisation",
    "route": "/reports/resource-utilisation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.flight-manifest",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Flight Manifest",
    "route": "/reports/flight-manifest",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.technical-performance",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Technical / Maintenance Performance",
    "route": "/reports/technical-performance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.freight-movement",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Freight Movement",
    "route": "/reports/freight-movement",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.no-show",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "No-Show Report",
    "route": "/reports/no-show",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.kpi-analytics",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "KPI Analytics",
    "route": "/reports/kpi-analytics",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.travel-history",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Travel History",
    "route": "/reports/travel-history",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.charge-codes",
    "module": "reporting",
    "area": "PEOPLE LOGISTICS",
    "label": "Charge / Back-Charge",
    "route": "/reports/charge-codes",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.personnel-at-risk",
    "module": "reporting",
    "area": "POB",
    "label": "Personnel At Risk",
    "route": "/reports/personnel-at-risk",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.muster-evacuation",
    "module": "reporting",
    "area": "POB",
    "label": "Emergency Muster / Evacuation",
    "route": "/reports/muster-evacuation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.daily-pob",
    "module": "reporting",
    "area": "POB",
    "label": "Daily POB Report",
    "route": "/reports/daily-pob",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.evacuation",
    "module": "reporting",
    "area": "POB",
    "label": "Evacuation Report",
    "route": "/reports/evacuation",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.days-since-travel",
    "module": "reporting",
    "area": "POB",
    "label": "Days Since Last Travel",
    "route": "/reports/days-since-travel",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.passenger-cargo-count",
    "module": "reporting",
    "area": "POB",
    "label": "Passenger & Cargo Count",
    "route": "/reports/passenger-cargo-count",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.adnoc-pob",
    "module": "reporting",
    "area": "POB",
    "label": "Custom ADNOC POB Report",
    "route": "/reports/adnoc-pob",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-04"
  },
  {
    "key": "reports.aviation-technical-compliance",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Aviation Technical Compliance",
    "route": "/reports/aviation-technical-compliance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.acceptance-register",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Acceptance & Dispensation Register",
    "route": "/reports/acceptance-register",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.hll-extension",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "HLL Extension Report",
    "route": "/reports/hll-extension",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.inspection-closeout",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Inspection & Non-Compliance Closeout",
    "route": "/reports/inspection-closeout",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.friction-certificate",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Friction Test Certificate",
    "route": "/reports/friction-certificate",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.expiry-forecast",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Helideck Expiry Forecast",
    "route": "/reports/expiry-forecast",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.orientation-assessment",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Rig/Barge Helideck Orientation Assessment",
    "route": "/reports/orientation-assessment",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.asset-master-data",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Helideck Asset Master Data",
    "route": "/reports/asset-master-data",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.findings-summary",
    "module": "reporting",
    "area": "HELIDECK & AVIATION TECHNICAL",
    "label": "Aviation Compliance Findings Summary",
    "route": "/reports/findings-summary",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.helicopter-maintenance",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Helicopter Maintenance & Technical",
    "route": "/reports/helicopter-maintenance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.maintenance-audit-findings",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Maintenance Audit & Findings",
    "route": "/reports/maintenance-audit-findings",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.sp-performance",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "SP Performance / Technical Dispatch Reliability",
    "route": "/reports/sp-performance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.occurrences",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Aviation Occurrence & Incident (GCAA MOR)",
    "route": "/reports/occurrences",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.moc-review-tracker",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Project Aviation Technical Review Tracker",
    "route": "/reports/moc-review-tracker",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.technical-monthly-kpi",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Aviation Technical Monthly KPI",
    "route": "/reports/technical-monthly-kpi",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": "P-11"
  },
  {
    "key": "reports.asp-compliance",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "ASP Compliance %",
    "route": "/reports/asp-compliance",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.asp-findings-closeout",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "ASP Findings Closeout",
    "route": "/reports/asp-findings-closeout",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.internal-gcaa-summary",
    "module": "reporting",
    "area": "COMPLIANCE",
    "label": "Internal GCAA Audit Summary",
    "route": "/reports/internal-gcaa-summary",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.builder",
    "module": "reporting",
    "area": "TOOLS",
    "label": "Report Builder",
    "route": "/reports/builder",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "reports.scheduler",
    "module": "reporting",
    "area": "TOOLS",
    "label": "Report Scheduler",
    "route": "/reports/scheduler",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "admin.users",
    "module": "administration",
    "area": "ACCESS CONTROL",
    "label": "Users",
    "route": "/admin/users",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "deactivate",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.roles",
    "module": "administration",
    "area": "ACCESS CONTROL",
    "label": "Roles",
    "route": "/admin/roles",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.access-rights",
    "module": "administration",
    "area": "ACCESS CONTROL",
    "label": "Access Rights Matrix",
    "route": "/admin/access-rights",
    "channel": "web",
    "rights": [
      "view",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.delegations",
    "module": "administration",
    "area": "ACCESS CONTROL",
    "label": "Delegation",
    "route": "/admin/delegations",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.approval-engine",
    "module": "administration",
    "area": "ENGINES",
    "label": "Approval Engine",
    "route": "/admin/approval-engine",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.business-rules",
    "module": "administration",
    "area": "ENGINES",
    "label": "Business Rules",
    "route": "/admin/business-rules",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.notification-engine",
    "module": "administration",
    "area": "ENGINES",
    "label": "Notification Engine",
    "route": "/admin/notification-engine",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.reason-codes",
    "module": "administration",
    "area": "ENGINES",
    "label": "Reason Codes",
    "route": "/admin/reason-codes",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.audit-log",
    "module": "administration",
    "area": "GOVERNANCE",
    "label": "Audit Log",
    "route": "/admin/audit-log",
    "channel": "web",
    "rights": [
      "view",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.support-articles",
    "module": "administration",
    "area": "GOVERNANCE",
    "label": "Support Articles",
    "route": "/admin/support-articles",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.locations",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Locations",
    "route": "/admin/locations",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.installations",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Installations",
    "route": "/admin/installations",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.routes",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Routes",
    "route": "/admin/routes",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.zones",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Zones",
    "route": "/admin/zones",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.location-types",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Location Types",
    "route": "/admin/location-types",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.installation-types",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Installation Types",
    "route": "/admin/installation-types",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.resource-categories",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Resource Categories",
    "route": "/admin/resource-categories",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.resource-types",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Resource Types",
    "route": "/admin/resource-types",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.service-providers",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Service Providers",
    "route": "/admin/service-providers",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.passenger-categories",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Passenger Categories",
    "route": "/admin/passenger-categories",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.charge-codes",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Charge Codes",
    "route": "/admin/charge-codes",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.departments",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Departments",
    "route": "/admin/departments",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.companies",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "Companies",
    "route": "/admin/companies",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.external-contacts",
    "module": "administration",
    "area": "SHARED MASTERS",
    "label": "External Organisation Contacts",
    "route": "/admin/external-contacts",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.fleet",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Fleet",
    "route": "/admin/fleet",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.quotas",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Quotas",
    "route": "/admin/quotas",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.fuel-stations",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Fuel Stations",
    "route": "/admin/fuel-stations",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.cargo-types",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Cargo Types",
    "route": "/admin/cargo-types",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.aircraft-models",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Aircraft Models",
    "route": "/admin/aircraft-models",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.devices",
    "module": "administration",
    "area": "PEOPLE LOGISTICS",
    "label": "Devices",
    "route": "/admin/devices",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.muster-points",
    "module": "administration",
    "area": "POB TRACKING",
    "label": "Muster Points",
    "route": "/admin/muster-points",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.lifeboats",
    "module": "administration",
    "area": "POB TRACKING",
    "label": "Lifeboats",
    "route": "/admin/lifeboats",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.essential-positions",
    "module": "administration",
    "area": "POB TRACKING",
    "label": "Essential Positions",
    "route": "/admin/essential-positions",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.pending-changes",
    "module": "administration",
    "area": "POB TRACKING",
    "label": "Pending Master Changes",
    "route": "/admin/pending-changes",
    "channel": "web",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.inspection-types",
    "module": "administration",
    "area": "HELIDECK",
    "label": "Inspection / Test Types",
    "route": "/admin/inspection-types",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.documentation-matrix",
    "module": "administration",
    "area": "HELIDECK",
    "label": "Documentation Matrix",
    "route": "/admin/documentation-matrix",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.limitation-codes",
    "module": "administration",
    "area": "HELIDECK",
    "label": "Limitation Codes",
    "route": "/admin/limitation-codes",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.department-focal-points",
    "module": "administration",
    "area": "AVIATION COMPLIANCE",
    "label": "Department Focal Points",
    "route": "/admin/department-focal-points",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.asp-scoring",
    "module": "administration",
    "area": "AVIATION COMPLIANCE",
    "label": "ASP Response Scoring",
    "route": "/admin/asp-scoring",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "admin.audit-checklist-library",
    "module": "administration",
    "area": "AVIATION COMPLIANCE",
    "label": "Audit Checklist Library",
    "route": "/admin/audit-checklist-library",
    "channel": "web",
    "rights": [
      "view",
      "create",
      "edit",
      "deactivate",
      "delete",
      "export"
    ],
    "menu": true,
    "layout": "admin",
    "heldBy": null
  },
  {
    "key": "ai.assistant",
    "module": "ai",
    "area": "AI ASSISTANT",
    "label": "Booking Assistant",
    "route": "/assistant",
    "channel": "web",
    "rights": [
      "view"
    ],
    "menu": false,
    "layout": "main",
    "heldBy": "P-12"
  },
  {
    "key": "mobile.home",
    "module": "shared",
    "area": "APP",
    "label": "Home",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.notifications",
    "module": "shared",
    "area": "APP",
    "label": "Notifications",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.profile",
    "module": "shared",
    "area": "APP",
    "label": "Profile, delegations, devices, support",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.bookings",
    "module": "people-logistics",
    "area": "APP",
    "label": "My Bookings",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.approvals",
    "module": "people-logistics",
    "area": "APP",
    "label": "Approvals",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.flight-log",
    "module": "people-logistics",
    "area": "APP",
    "label": "Digital Flight Log",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.inspections",
    "module": "helideck",
    "area": "APP",
    "label": "Inspections & Tests",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.crew-assessment",
    "module": "helideck",
    "area": "APP",
    "label": "Crew Assessment",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.asp-audits",
    "module": "aviation-compliance",
    "area": "APP",
    "label": "ASP Department Audit Checklist",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.internal-audits",
    "module": "aviation-compliance",
    "area": "APP",
    "label": "Internal GCAA Audit Checklist",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.muster-console",
    "module": "pob",
    "area": "APP",
    "label": "Muster Console",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.offshore-checkin",
    "module": "pob",
    "area": "APP",
    "label": "Offshore Check-in",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view",
      "create",
      "edit"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  },
  {
    "key": "mobile.ai-assistant",
    "module": "ai",
    "area": "APP",
    "label": "AI Booking Assistant",
    "route": null,
    "channel": "mobile",
    "rights": [
      "view"
    ],
    "menu": true,
    "layout": "main",
    "heldBy": null
  }
] as const satisfies readonly RegistryPage[];
export type PageKey = (typeof PAGES)[number]['key'];

export const CAPABILITIES = [
  {
    "key": "dispatch.offload",
    "module": "people-logistics",
    "label": "Offload a passenger",
    "locationScoped": true
  },
  {
    "key": "dispatch.reallocate-seat",
    "module": "people-logistics",
    "label": "Reallocate a seat",
    "locationScoped": true
  },
  {
    "key": "dispatch.switch-resource",
    "module": "people-logistics",
    "label": "Switch resource",
    "locationScoped": true
  },
  {
    "key": "dispatch.reopen",
    "module": "people-logistics",
    "label": "Reopen a departure",
    "locationScoped": true
  },
  {
    "key": "dispatch.freeze-override",
    "module": "people-logistics",
    "label": "Change a frozen departure",
    "locationScoped": true
  },
  {
    "key": "booking.quota-override",
    "module": "people-logistics",
    "label": "Override a quota",
    "locationScoped": false
  },
  {
    "key": "booking.vip-reserve",
    "module": "people-logistics",
    "label": "Reserve VIP seats",
    "locationScoped": false
  },
  {
    "key": "booking.reserve-waitlist",
    "module": "people-logistics",
    "label": "Reserve waitlist seats",
    "locationScoped": false
  },
  {
    "key": "booking.after-cutoff-cancel",
    "module": "people-logistics",
    "label": "Cancel after cut-off",
    "locationScoped": false
  },
  {
    "key": "booking.raise-on-behalf",
    "module": "people-logistics",
    "label": "Raise on behalf of others",
    "locationScoped": false
  },
  {
    "key": "booking.manual-passenger-exception",
    "module": "people-logistics",
    "label": "Add a passenger manually",
    "locationScoped": false
  },
  {
    "key": "booking.charge-code-correction",
    "module": "people-logistics",
    "label": "Correct a charge code",
    "locationScoped": false
  },
  {
    "key": "pob.essential-departure-override",
    "module": "pob",
    "label": "Override essential coverage",
    "locationScoped": true
  },
  {
    "key": "muster.reconcile-signoff",
    "module": "pob",
    "label": "Sign off a muster",
    "locationScoped": true
  },
  {
    "key": "masters.pob.approve",
    "module": "pob",
    "label": "Approve POB master changes",
    "locationScoped": true
  },
  {
    "key": "hll.edit",
    "module": "helideck",
    "label": "Edit the HLL",
    "locationScoped": false
  },
  {
    "key": "hll.review-publish",
    "module": "helideck",
    "label": "Publish the HLL",
    "locationScoped": false
  },
  {
    "key": "findings.override-target",
    "module": "helideck",
    "label": "Override a finding target date",
    "locationScoped": false
  },
  {
    "key": "gcaa.reopen-closed-audit",
    "module": "aviation-compliance",
    "label": "Reopen a GCAA audit",
    "locationScoped": false
  },
  {
    "key": "internal-audit.reopen",
    "module": "aviation-compliance",
    "label": "Reopen an internal audit",
    "locationScoped": false
  },
  {
    "key": "records.reopen",
    "module": "administration",
    "label": "Reopen closed records",
    "locationScoped": false
  },
  {
    "key": "sync.force-release",
    "module": "administration",
    "label": "Force-release offline work",
    "locationScoped": false
  },
  {
    "key": "demo-data.manage",
    "module": "administration",
    "label": "Manage demo data",
    "locationScoped": false
  }
] as const;
export type CapabilityKey = (typeof CAPABILITIES)[number]['key'];
