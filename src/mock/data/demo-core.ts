/**
 * Sample data for the demo core screens (Dashboard and Support), taken from the original
 * ADNOC LMS demo. Flight numbers, places, people and resources match the scheduling and
 * location seeds. Days are offsets from today, so the demo stays current.
 */

export type FlightStatus =
  | 'Arrived'
  | 'Closed for Dispatch'
  | 'Cancelled'
  | 'Delayed'
  | 'Boarding'
  | 'Closed for Boarding';

export interface DashboardFlight {
  readonly id: string;
  readonly time: string;
  readonly flightNumber: string;
  readonly from: string;
  readonly to: string;
  readonly mode: 'Fixed Wing' | 'Rotary Wing' | 'Ferry' | 'Crew Boat';
  readonly resource: string;
  readonly booked: number;
  readonly capacity: number;
  readonly status: FlightStatus;
}

export const DASHBOARD_FLIGHTS: readonly DashboardFlight[] = [
  ['05:00', 'AML303', 'Abu Dhabi', 'Das Island', 'Ferry', 'Ferry', 45, 120, 'Arrived'],
  ['07:00', 'ADA101', 'Abu Dhabi', 'Das Island', 'Fixed Wing', 'Dash 8-300', 17, 50, 'Closed for Dispatch'],
  ['08:00', 'ADA201', 'Das Island', 'Upper Zakum', 'Rotary Wing', 'AW139', 4, 12, 'Cancelled'],
  ['08:30', 'FAL201', 'Das Island', 'Umm Shaif', 'Rotary Wing', 'AW139', 12, 12, 'Arrived'],
  ['09:00', 'FAL207', 'Abu Dhabi', 'Umm Shaif', 'Rotary Wing', 'Bell 412', 0, 12, 'Arrived'],
  ['09:00', 'AML403', 'Zirku Island', 'Zirku Platform Z2', 'Crew Boat', 'Supply Vessel', 0, 40, 'Arrived'],
  ['09:15', 'AML401', 'Zirku Island', 'Zirku Platform Z1', 'Crew Boat', 'Supply Vessel', 14, 40, 'Delayed'],
  ['10:00', 'FAL205', 'Zirku Island', 'NASR', 'Rotary Wing', 'AW189', 0, 16, 'Arrived'],
  ['11:00', 'ADA202', 'Upper Zakum', 'Das Island', 'Rotary Wing', 'AW189', 0, 16, 'Arrived'],
  ['12:00', 'FAL202', 'Umm Shaif', 'Das Island', 'Rotary Wing', 'AW139', 0, 12, 'Arrived'],
  ['15:15', 'ADA903', 'Abu Dhabi', 'Das Island', 'Fixed Wing', 'Dash 8-300', 20, 50, 'Boarding'],
  ['16:00', 'ADA102', 'Das Island', 'Abu Dhabi', 'Fixed Wing', 'Dash 8-300', 25, 50, 'Closed for Boarding'],
].map(([time, flightNumber, from, to, mode, resource, booked, capacity, status]) => ({
  id: `flight-${String(flightNumber)}`,
  time: String(time),
  flightNumber: String(flightNumber),
  from: String(from),
  to: String(to),
  mode: mode as DashboardFlight['mode'],
  resource: String(resource),
  booked: Number(booked),
  capacity: Number(capacity),
  status: status as FlightStatus,
}));

export interface DashboardApproval {
  readonly id: string;
  readonly passenger: string;
  readonly reference: string;
  readonly from: string;
  readonly to: string;
  /** Days from today the passenger travels. */
  readonly dayOffset: number;
  readonly overQuota: boolean;
  readonly stage: string;
}

export const DASHBOARD_APPROVALS: readonly DashboardApproval[] = [
  ['James Mitchell', 'BK-2026-0003', 'Abu Dhabi', 'Das Island', 1, false, 'Focal Point'],
  ['Sarah Johnson', 'BK-2026-0005', 'Abu Dhabi', 'Das Island', 2, false, 'Line Manager'],
  ['Khalid Al Dhaheri', 'BK-2026-0011', 'Abu Dhabi', 'Das Island', 3, false, 'Line Manager'],
  ['Priya Sharma', 'BK-2026-0012', 'Abu Dhabi', 'Das Island', 4, true, 'Aviation Team'],
  ['Jamil Rahman', 'BK-2026-0264', 'Upper Zakum', 'Das Island', 1, true, 'Line Manager'],
  ['Stuart Blackwood', 'BK-2026-0213', 'Abu Dhabi', 'Zirku Island', 1, true, 'Line Manager'],
  ['Deepak Pillai', 'BK-2026-0262', 'Upper Zakum', 'Das Island', 1, true, 'Line Manager'],
  ['Saif Al Mazrouei', 'BK-2026-0253', 'Zirku Island', 'Abu Dhabi', 1, true, 'Line Manager'],
  ['Tamer Mansour', 'BK-2026-0233', 'Das Island', 'Abu Dhabi', 1, false, 'Line Manager'],
  ['Simon Harrington', 'BK-2026-0283', 'Zirku Island', 'Abu Dhabi', 1, false, 'Line Manager'],
  ['Sarita Thapa', 'BK-2026-0270', 'Upper Zakum', 'Das Island', 1, true, 'Line Manager'],
  ['Ricardo Delos Reyes', 'BK-2026-0252', 'Zirku Island', 'Abu Dhabi', 1, true, 'Line Manager'],
].map(([passenger, reference, from, to, dayOffset, overQuota, stage]) => ({
  id: `approval-${String(reference)}`,
  passenger: String(passenger),
  reference: String(reference),
  from: String(from),
  to: String(to),
  dayOffset: Number(dayOffset),
  overQuota: Boolean(overQuota),
  stage: String(stage),
}));

/** All bookings waiting at the user's desk; the card lists the first ones. */
export const APPROVALS_WAITING = 215;
export const WAITLISTED_TODAY = 7;

export interface DashboardNotice {
  readonly id: string;
  readonly text: string;
  readonly tone: 'danger' | 'warning' | 'info';
  /** The page key the notice opens. */
  readonly page: 'dispatch.status' | 'booking.approvals' | 'pob.overstay';
}

export const DASHBOARD_NOTICES: readonly DashboardNotice[] = [
  {
    id: 'n1',
    text: 'ADA201 cancelled — Weather — sea state above limits',
    tone: 'danger',
    page: 'dispatch.status',
  },
  { id: 'n2', text: 'AML401 delayed — Awaiting passengers', tone: 'warning', page: 'dispatch.status' },
  {
    id: 'n3',
    text: '34 bookings held over a category quota, waiting on an override',
    tone: 'warning',
    page: 'booking.approvals',
  },
  {
    id: 'n4',
    text: '9 people are past 90 continuous days offshore',
    tone: 'info',
    page: 'pob.overstay',
  },
];

// ---------------------------------------------------------------- support

export const SUPPORT_ZONES = [
  'Base',
  'Das',
  'Zakum',
  'Umm Shaif',
  'Buhaser',
  'Ghasha',
  'Other',
] as const;
export type SupportZone = (typeof SUPPORT_ZONES)[number];

export interface SupportContact {
  readonly id: string;
  readonly site: string;
  readonly zone: SupportZone;
  readonly name: string;
  readonly email: string;
}

export const SUPPORT_CONTACTS: readonly SupportContact[] = [
  ['ABK', 'Das', 'Hessa Al Mansoori', 'h.almansoori@adnoc.ae'],
  ['Abu Dhabi', 'Base', 'Aisha Al Qubaisi', 'a.alqubaisi@adnoc.ae'],
  ['ACPT', 'Zakum', 'Rashid Al Kaabi', 'r.alkaabi@adnoc.ae'],
  ['Belbazem Field', 'Other', 'Jassim Al Muhairi', 'j.almuhairi@adnoc.ae'],
  ['Buhaser Field', 'Buhaser', 'Saif Al Rumaithi', 's.alrumaithi@adnoc.ae'],
  ['Cosmo Field', 'Other', 'Tariq Al Hammadi', 't.alhammadi@adnoc.ae'],
  ['Das Island', 'Das', 'Khalid Al Hosani', 'k.alhosani@adnoc.ae'],
  ['Ghasha Field', 'Ghasha', 'Mubarak Al Qubaisi', 'm.alqubaisi@adnoc.ae'],
  ['Hail Field', 'Other', 'Rashid Al Suwaidi', 'r.alsuwaidi@adnoc.ae'],
  ['Lower Zakum', 'Zakum', 'Ahmed Al Blooshi', 'a.alblooshi@adnoc.ae'],
  ['NASR', 'Umm Shaif', 'Omar Al Shamsi', 'o.alshamsi@adnoc.ae'],
  ['Sarb Field', 'Other', 'Butti Al Falasi', 'b.alfalasi@adnoc.ae'],
  ['Satah Field', 'Other', 'Abdulla Al Zaabi', 'a.alzaabi@adnoc.ae'],
  ['Umm Al Dalkh', 'Other', 'Nasser Al Marzooqi', 'n.almarzooqi@adnoc.ae'],
  ['Umm Al Salsal Field', 'Other', 'Hamdan Al Ameri', 'h.alameri@adnoc.ae'],
  ['Umm Shaif', 'Umm Shaif', 'Noura Al Dhaheri', 'n.aldhaheri@adnoc.ae'],
  ['Upper Zakum', 'Zakum', 'Saeed Al Mazrouei', 's.almazrouei@adnoc.ae'],
  ['Zirku Island', 'Das', 'Mariam Al Suwaidi', 'm.alsuwaidi@adnoc.ae'],
  ['Zirku Platform Z1', 'Das', 'Ibrahim Al Nuaimi', 'i.alnuaimi@adnoc.ae'],
  ['Zirku Platform Z2', 'Das', 'Yousuf Al Ameri', 'y.alameri@adnoc.ae'],
].map(([site = '', zone = '', name = '', email = '']) => ({
  id: `contact-${site.toLowerCase().replace(/\W+/g, '-')}`,
  site,
  zone: zone as SupportZone,
  name,
  email,
}));

export interface SupportQuestion {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface SupportQuestionGroup {
  readonly title: string;
  readonly questions: readonly SupportQuestion[];
}

export const SUPPORT_QUESTIONS: readonly SupportQuestionGroup[] = [
  {
    title: 'Booking',
    questions: [
      {
        id: 'q1',
        question: 'Why can I not book somebody onto a departure that still has seats?',
        answer:
          'Three things stop a booking with seats free: the departure is past its booking cut-off for that mode, the passenger’s HSE Passport has expired or expires before they are due back, or their passenger category is already at its quota on that resource. The booking form says which.',
      },
      {
        id: 'q2',
        question: 'A request came back waitlisted. What happens to it?',
        answer:
          'A waitlisted request keeps its place and holds no seat. It becomes seatable the moment one is released — somebody cancels, or is taken off the manifest — from Quick Add or Manifest Confirmation.',
      },
      {
        id: 'q3',
        question: 'Who approves a booking?',
        answer:
          'The approval chain is decided by the request itself: who the passenger is, where they are going and which workflow applies. The chain and the stage it is waiting at are shown on the booking.',
      },
    ],
  },
  {
    title: 'Dispatch',
    questions: [
      {
        id: 'q4',
        question: 'The manifest will not confirm.',
        answer:
          'Everybody travelling needs a seat before a manifest can be confirmed, and an aircraft cannot be confirmed over its payload. The page names whichever is outstanding.',
      },
      {
        id: 'q5',
        question: 'Why can a flight not be closed?',
        answer:
          'An air dispatch closes on its load sheet. Until the operator’s sheet is attached the close is refused. A ferry or crew boat has no trim sheet and closes without one.',
      },
      {
        id: 'q6',
        question: 'Somebody did not turn up at the gate.',
        answer:
          'Take them off the manifest with a no-show reason. The seat is released and the waiting list can be seated into it; their booking stays open rather than being cancelled.',
      },
    ],
  },
  {
    title: 'People on board',
    questions: [
      {
        id: 'q7',
        question: 'Somebody is offshore and does not appear on POB.',
        answer:
          'They arrived by a route the dispatch process did not see — a vessel, a barge, or a boat that is not ours. Record them on Vessel Check-in, Crew Entry or Location Override, whichever matches how they arrived. Every entry names who made it.',
      },
      {
        id: 'q8',
        question: 'What happens when a muster is declared?',
        answer:
          'The roster freezes at the moment it is declared, so the expected list does not move while people are being counted. Headcounts are recorded at each muster point and names ticked off against the frozen list. A muster cannot be closed while anybody is unaccounted for.',
      },
    ],
  },
  {
    title: 'Access',
    questions: [
      {
        id: 'q9',
        question: 'I cannot sign in.',
        answer:
          'Sign-in goes through ADNOC single sign-on, so a password problem is an ADNOC identity problem and is raised on the IT ticketing portal rather than here.',
      },
      {
        id: 'q10',
        question: 'I can sign in but something is missing.',
        answer:
          'What each role may open is set on the access rights matrix. Ask your focal point to raise an access request naming the module you need.',
      },
    ],
  },
];

export interface SupportGuide {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly string[];
}

export const SUPPORT_GUIDES: readonly SupportGuide[] = [
  {
    id: 'g1',
    title: 'Raise a booking',
    steps: [
      'Open Create Booking.',
      'Find the passenger and check their certificate status.',
      'Pick the journey — unavailable ones say why.',
      'Give the reason for travel and the charge code.',
      'Submit; the approval chain is shown on the booking.',
    ],
  },
  {
    id: 'g2',
    title: 'Work a departure',
    steps: [
      'Find the departure on Manifest Confirmation.',
      'Seat everybody travelling and check the payload.',
      'Confirm the manifest.',
      'On Flight Dispatch, set the gate and close boarding.',
      'Attach the load sheet, then close the dispatch record.',
    ],
  },
  {
    id: 'g3',
    title: 'Record an arrival POB has not seen',
    steps: [
      'Decide how they arrived: aboard a fleet vessel, as vessel crew, or on a boat that is not ours.',
      'Open Vessel Check-in, Crew Entry or Location Override to match.',
      'Find the person by name or Optima number.',
      'Record the location and the time on board.',
    ],
  },
  {
    id: 'g4',
    title: 'Run a muster',
    steps: [
      'Declare the muster on Emergency Muster; the roster freezes.',
      'At each point, record the headcount on the Muster Console.',
      'Tick people off against the frozen list.',
      'Close the event once nobody is unaccounted for.',
    ],
  },
];

export const SUPPORT_TECHNICAL = {
  body: 'Sign-in and password problems, and anything that stops the platform working, are raised on the IT ticketing portal. Tickets are not raised here.',
  /** Not provided yet, so the portal button stays disabled. */
  portalUrl: null as string | null,
  pending: 'The portal address and the helpdesk contact are still to be provided.',
};
