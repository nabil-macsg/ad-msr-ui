import { mix } from './color';

/**
 * Official colours of the ADNOC "Energy for Life" Visual Guidelines (pp. 33–35). Every other value
 * in the presets is a derived UI shade, written as `mix(...)` of these. Royal Blue #0047BA is the
 * logo's colour only (p. 30) and is deliberately absent.
 */
export const BRAND = {
  brightBlue: '#0030FF',
  mediumBlue: '#27348B',
  darkBlue: '#001358',
  brightTeal: '#00CFD1',
  mediumTeal: '#008591',
  darkTeal: '#003A51',
  brightGreen: '#00DE4C',
  mediumGreen: '#009D45',
  darkGreen: '#005743',
  brightOrange: '#FF9500',
  mediumOrange: '#FF6B10',
  darkOrange: '#BD471E',
  brightYellow: '#FFCC02',
  darkYellow: '#8B6500',
  brightRed: '#FF5070',
  mediumRed: '#E91C49',
  darkRed: '#920033',
  lightGrey: '#DBDCDB',
  slateGrey: '#A7A8A9',
  charcoal: '#262626',
  black: '#000000',
  white: '#FFFFFF',
  /** The guidelines' page background. */
  paper: '#F1F1EF',
} as const;

export const INTENSITIES = ['soft', 'balanced', 'vibrant'] as const;
export type Intensity = (typeof INTENSITIES)[number];

/** One value, or one per intensity: [soft, balanced, vibrant]. */
export type ByIntensity = string | readonly [string, string, string];

export interface NavSpec {
  readonly bg: ByIntensity;
  readonly active: ByIntensity;
  /** Active text; the most readable of white, dark blue and charcoal when omitted. */
  readonly activeFg?: ByIntensity;
  /** A 3 px marker on the active item's left edge. */
  readonly indicator?: ByIntensity;
  readonly hover?: ByIntensity;
  /** Strong text (group headings); the most readable of white, dark blue and charcoal when omitted. */
  readonly text?: string;
  readonly icon?: ByIntensity;
  readonly sub?: ByIntensity;
  readonly border?: ByIntensity;
}

export interface ThemeSpec {
  readonly key: string;
  readonly name: string;
  readonly summary: string;
  readonly dark?: boolean;
  /** The theme's main hue: tints borders, hovers and highlights. */
  readonly hue: string;
  readonly nav: NavSpec;
  /** Administration's own navigation (module variation, PROMPT §4.2). */
  readonly adminNav: Partial<NavSpec>;
  readonly header: ByIntensity;
  readonly primary: ByIntensity;
  /** Secondary highlight (subtle backgrounds, accent badges); defaults to the primary. */
  readonly accent?: ByIntensity;
  readonly focus?: ByIntensity;
  readonly canvas: ByIntensity;
  readonly card?: ByIntensity;
  readonly tableHead: ByIntensity;
}

const B = BRAND;
const W = B.white;

export const THEMES: readonly ThemeSpec[] = [
  {
    key: 'classic',
    name: 'ADNOC Classic',
    summary: 'Dark navy navigation, bright blue actions, light grey content.',
    hue: B.brightBlue,
    nav: {
      bg: [mix(B.darkBlue, W, 0.07), B.darkBlue, mix(B.darkBlue, B.brightBlue, 0.2)],
      active: [
        mix(B.darkBlue, B.brightBlue, 0.4),
        mix(B.darkBlue, B.brightBlue, 0.75),
        B.brightBlue,
      ],
    },
    adminNav: {
      bg: [mix(B.charcoal, W, 0.08), B.charcoal, mix(B.charcoal, B.black, 0.3)],
      active: [
        mix(B.charcoal, B.brightBlue, 0.35),
        mix(B.charcoal, B.brightBlue, 0.7),
        B.brightBlue,
      ],
    },
    header: W,
    primary: [
      mix(B.brightBlue, B.darkBlue, 0.35),
      mix(B.brightBlue, B.darkBlue, 0.12),
      B.brightBlue,
    ],
    canvas: ['#F7F7F6', B.paper, mix(B.paper, B.brightBlue, 0.035)],
    tableHead: ['#F7F7F6', mix(W, B.brightBlue, 0.04), mix(W, B.brightBlue, 0.08)],
  },
  {
    key: 'bright-blue',
    name: 'Bright Blue Intense',
    summary: 'Bright blue navigation with dark blue selection; the strongest brand presence.',
    hue: B.brightBlue,
    nav: {
      bg: [
        mix(B.brightBlue, B.mediumBlue, 0.55),
        mix(B.brightBlue, B.darkBlue, 0.12),
        B.brightBlue,
      ],
      active: [mix(B.darkBlue, B.mediumBlue, 0.4), B.darkBlue, B.darkBlue],
      hover: [mix(B.mediumBlue, W, 0.12), mix(B.brightBlue, W, 0.14), mix(B.brightBlue, W, 0.18)],
    },
    adminNav: {
      bg: [mix(B.mediumBlue, W, 0.08), B.mediumBlue, mix(B.mediumBlue, B.darkBlue, 0.3)],
      active: [mix(B.darkBlue, B.black, 0.1), B.darkBlue, B.brightBlue],
    },
    header: W,
    primary: [mix(B.brightBlue, B.darkBlue, 0.3), mix(B.brightBlue, B.darkBlue, 0.1), B.brightBlue],
    canvas: [mix(W, B.brightBlue, 0.02), mix(W, B.brightBlue, 0.035), mix(W, B.brightBlue, 0.06)],
    tableHead: [mix(W, B.brightBlue, 0.04), mix(W, B.brightBlue, 0.07), mix(W, B.brightBlue, 0.11)],
  },
  {
    key: 'soft-blue',
    name: 'Soft Blue Corporate',
    summary: 'Light blue navigation with navy text; low intensity for long sessions.',
    hue: B.mediumBlue,
    nav: {
      bg: [mix(W, B.brightBlue, 0.03), mix(W, B.brightBlue, 0.06), mix(W, B.brightBlue, 0.1)],
      text: B.darkBlue,
      active: [mix(W, B.brightBlue, 0.12), mix(W, B.brightBlue, 0.16), B.mediumBlue],
      activeFg: [B.darkBlue, B.darkBlue, W],
      indicator: [B.mediumBlue, B.brightBlue, 'transparent'],
      icon: [mix(B.mediumBlue, W, 0.1), B.mediumBlue, B.mediumBlue],
      border: [
        mix(B.lightGrey, B.brightBlue, 0.08),
        mix(B.lightGrey, B.brightBlue, 0.15),
        mix(B.lightGrey, B.brightBlue, 0.25),
      ],
    },
    adminNav: {
      bg: [mix(W, B.charcoal, 0.03), mix(W, B.charcoal, 0.05), mix(W, B.charcoal, 0.08)],
      text: B.charcoal,
      active: [mix(W, B.charcoal, 0.1), mix(W, B.charcoal, 0.13), B.charcoal],
      activeFg: [B.charcoal, B.charcoal, W],
      indicator: [B.charcoal, B.mediumBlue, 'transparent'],
      icon: [B.charcoal, B.charcoal, B.charcoal],
      border: B.lightGrey,
    },
    header: W,
    primary: [mix(B.mediumBlue, W, 0.12), B.mediumBlue, mix(B.mediumBlue, B.brightBlue, 0.35)],
    canvas: ['#F8F9FB', '#F3F5FA', '#ECEFF8'],
    tableHead: [
      mix(W, B.brightBlue, 0.025),
      mix(W, B.brightBlue, 0.045),
      mix(W, B.brightBlue, 0.07),
    ],
  },
  {
    key: 'navy-teal',
    name: 'Navy and Teal',
    summary: 'Dark navy navigation, teal selection and medium teal actions.',
    hue: B.mediumTeal,
    nav: {
      bg: [mix(B.darkBlue, W, 0.07), B.darkBlue, mix(B.darkBlue, B.darkTeal, 0.35)],
      active: [
        mix(B.darkBlue, B.brightTeal, 0.18),
        mix(B.darkBlue, B.brightTeal, 0.28),
        B.brightTeal,
      ],
      indicator: [B.brightTeal, B.brightTeal, 'transparent'],
      icon: [mix(B.brightTeal, W, 0.45), mix(B.brightTeal, W, 0.25), B.brightTeal],
    },
    adminNav: {
      bg: [mix(B.darkTeal, W, 0.07), B.darkTeal, mix(B.darkTeal, B.black, 0.25)],
      active: [
        mix(B.darkTeal, B.brightTeal, 0.22),
        mix(B.darkTeal, B.brightTeal, 0.32),
        B.brightTeal,
      ],
      indicator: [B.brightTeal, B.brightTeal, 'transparent'],
    },
    header: W,
    primary: [mix(B.mediumTeal, B.darkTeal, 0.4), mix(B.mediumTeal, B.darkTeal, 0.2), B.mediumTeal],
    focus: B.mediumTeal,
    canvas: ['#F7F7F6', B.paper, mix(B.paper, B.brightTeal, 0.06)],
    tableHead: ['#F7F7F6', mix(W, B.brightTeal, 0.06), mix(W, B.brightTeal, 0.12)],
  },
  {
    key: 'teal',
    name: 'Teal Corporate',
    summary: 'Dark teal navigation and teal actions, with ADNOC blue in support.',
    hue: B.mediumTeal,
    nav: {
      bg: [mix(B.darkTeal, W, 0.07), B.darkTeal, mix(B.darkTeal, B.mediumTeal, 0.3)],
      active: [mix(B.darkTeal, B.mediumTeal, 0.55), B.mediumTeal, B.brightTeal],
      hover: [
        mix(B.darkTeal, B.mediumTeal, 0.25),
        mix(B.darkTeal, B.mediumTeal, 0.32),
        mix(B.darkTeal, B.mediumTeal, 0.45),
      ],
    },
    adminNav: {
      bg: [mix(B.darkBlue, W, 0.07), B.darkBlue, mix(B.darkBlue, B.black, 0.2)],
      active: [mix(B.darkBlue, B.mediumTeal, 0.45), B.mediumTeal, B.brightTeal],
    },
    header: [W, mix(W, B.brightTeal, 0.04), mix(W, B.brightTeal, 0.08)],
    primary: [mix(B.mediumTeal, B.darkTeal, 0.4), mix(B.mediumTeal, B.darkTeal, 0.2), B.mediumTeal],
    accent: B.mediumBlue,
    focus: B.mediumTeal,
    canvas: ['#F7F8F8', mix(W, B.darkTeal, 0.05), mix(W, B.brightTeal, 0.09)],
    tableHead: [mix(W, B.brightTeal, 0.04), mix(W, B.brightTeal, 0.08), mix(W, B.brightTeal, 0.14)],
  },
  {
    key: 'white-nav',
    name: 'White Navigation',
    summary: 'White navigation with dark text and bright blue accents; minimal enterprise style.',
    hue: B.brightBlue,
    nav: {
      bg: [W, W, mix(W, B.brightBlue, 0.025)],
      text: B.charcoal,
      active: [mix(W, B.brightBlue, 0.06), mix(W, B.brightBlue, 0.09), B.brightBlue],
      activeFg: [mix(B.brightBlue, B.darkBlue, 0.35), mix(B.brightBlue, B.darkBlue, 0.15), W],
      indicator: [B.brightBlue, B.brightBlue, 'transparent'],
      icon: [B.charcoal, mix(B.charcoal, B.brightBlue, 0.35), B.brightBlue],
      border: B.lightGrey,
    },
    adminNav: {
      bg: [mix(W, B.charcoal, 0.025), mix(W, B.charcoal, 0.04), mix(W, B.charcoal, 0.06)],
      text: B.charcoal,
      active: [mix(W, B.charcoal, 0.08), mix(W, B.charcoal, 0.11), B.charcoal],
      activeFg: [B.charcoal, B.charcoal, W],
      indicator: [B.charcoal, B.brightBlue, 'transparent'],
      icon: B.charcoal,
      border: B.lightGrey,
    },
    header: W,
    primary: [mix(B.brightBlue, B.darkBlue, 0.3), mix(B.brightBlue, B.darkBlue, 0.1), B.brightBlue],
    canvas: ['#F7F7F6', '#F3F3F2', B.paper],
    tableHead: ['#FAFAF9', '#F5F5F4', mix(W, B.brightBlue, 0.05)],
  },
  {
    key: 'navy-warm',
    name: 'Navy with Warm Accents',
    summary: 'Dark navy navigation with an orange selection marker and blue actions.',
    hue: B.mediumBlue,
    nav: {
      bg: [mix(B.darkBlue, W, 0.07), B.darkBlue, mix(B.darkBlue, B.mediumBlue, 0.3)],
      active: [mix(B.darkBlue, W, 0.12), mix(B.darkBlue, B.mediumOrange, 0.2), B.mediumOrange],
      activeFg: [W, W, B.darkBlue],
      indicator: [B.mediumOrange, B.mediumOrange, 'transparent'],
      icon: [mix(B.brightOrange, W, 0.5), mix(B.brightOrange, W, 0.3), B.brightOrange],
    },
    adminNav: {
      bg: [mix(B.charcoal, W, 0.08), B.charcoal, mix(B.charcoal, B.black, 0.3)],
      active: [mix(B.charcoal, W, 0.12), mix(B.charcoal, B.mediumOrange, 0.22), B.mediumOrange],
      activeFg: [W, W, B.charcoal],
      indicator: [B.mediumOrange, B.mediumOrange, 'transparent'],
    },
    header: W,
    primary: [B.mediumBlue, mix(B.mediumBlue, B.brightBlue, 0.4), B.brightBlue],
    accent: B.darkOrange,
    canvas: ['#F7F7F6', B.paper, mix(B.paper, B.brightOrange, 0.04)],
    tableHead: ['#F7F7F6', mix(W, B.brightOrange, 0.05), mix(W, B.brightOrange, 0.1)],
  },
  {
    key: 'dark',
    name: 'Dark Corporate',
    summary: 'A full dark theme: navy navigation, charcoal surfaces, teal focus and selection.',
    dark: true,
    hue: B.brightBlue,
    nav: {
      bg: [mix(B.darkBlue, B.charcoal, 0.45), B.darkBlue, mix(B.darkBlue, B.brightBlue, 0.15)],
      active: [
        mix(B.darkBlue, B.brightTeal, 0.18),
        mix(B.darkBlue, B.brightTeal, 0.26),
        B.brightTeal,
      ],
      indicator: [B.brightTeal, B.brightTeal, 'transparent'],
      icon: [mix(B.brightTeal, W, 0.5), mix(B.brightTeal, W, 0.3), B.brightTeal],
    },
    adminNav: {
      bg: [
        mix(B.charcoal, B.black, 0.2),
        mix(B.charcoal, B.black, 0.4),
        mix(B.charcoal, B.black, 0.55),
      ],
      active: [
        mix(B.charcoal, B.brightTeal, 0.18),
        mix(B.charcoal, B.brightTeal, 0.26),
        B.brightTeal,
      ],
      indicator: [B.brightTeal, B.brightTeal, 'transparent'],
    },
    header: [mix(B.charcoal, W, 0.08), mix(B.charcoal, W, 0.05), mix(B.charcoal, B.darkBlue, 0.35)],
    primary: [
      mix(B.brightBlue, B.darkBlue, 0.25),
      mix(B.brightBlue, B.darkBlue, 0.1),
      B.brightBlue,
    ],
    focus: B.brightTeal,
    canvas: [
      mix(B.charcoal, B.black, 0.15),
      mix(B.charcoal, B.black, 0.3),
      mix(B.charcoal, B.darkBlue, 0.45),
    ],
    card: [mix(B.charcoal, W, 0.04), B.charcoal, mix(B.charcoal, B.darkBlue, 0.25)],
    tableHead: [
      mix(B.charcoal, W, 0.07),
      mix(B.charcoal, W, 0.06),
      mix(B.charcoal, B.darkBlue, 0.4),
    ],
  },
];

export const DEFAULT_THEME = 'classic';
export const DEFAULT_INTENSITY: Intensity = 'balanced';
