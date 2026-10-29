# MASAR UI Demo — Branding Changes

**Source:** ADNOC "Energy for Life" Visual Guidelines (`EFL_Visual Guidelines_v13_241204 9.pdf`,
labelled V.12, December 2024, DRAFT). Page numbers below refer to that PDF.

**Scope:** applied to the standalone demo (`masar-frontend-icons`) only. The real MASAR frontend
is unchanged.

---

## 1. Logo

| Item | Old | New | Guideline |
|---|---|---|---|
| Logo | MASAR falcon image (from the old LMS design) | Official ADNOC logo, extracted as vector artwork from the PDF | pp. 6–9 |
| Logo colour | — | ADNOC Royal Blue `#0047BA`, used for the logo only | p. 30 |
| On dark backgrounds (sidebar, sign-in panel, landing header) | MASAR image | ADNOC logo with the white cartouche box visible | pp. 6–8 |
| On white backgrounds (landing footer) | MASAR image | ADNOC logo with the cartouche hidden | pp. 6–8 |
| Shape used in headers | Square icon | Landscape logo (wordmark beside the falcon) | p. 9 |
| Browser tab icon (favicon) | `favicon.png` (MASAR image) | `favicon.svg` (ADNOC logo in its cartouche) | pp. 6, 31 |
| Page title | MASAR — Logistics Management | MASAR UI Demo · ADNOC | — |

The logo is the original artwork, not redrawn: proportions are unchanged, and there is no
watermark or caption. Files are in `public/brand/`. The landscape logo on p. 9 is drawn in
`#2851A3` in this draft PDF; its shapes are kept and it uses the documented logo colour `#0047BA`.

## 2. Typography

| Item | Old | New | Guideline |
|---|---|---|---|
| Font | Reddit Sans (loaded from Google Fonts) | ADNOC Sans if installed on the computer, otherwise **Arial** | pp. 11, 14 |
| Google Fonts download | Yes | Removed (no external font requests) | — |
| Body line height | 1.5 | 1.5, unchanged: it already matches "font size + 50%" | p. 16 |
| Landing page headline | Sentence case | CAPITALS, bold (ADNOC Sans is used in capitals for headlines) | p. 15 |
| Screen headings, forms, tables | Sentence case | Unchanged, for readability in business screens | p. 15 (no long text in capitals) |

**Why Arial:** ADNOC Sans is the brand font, but no licensed web font file is available. The PDF
only contains partial embedded copies, which can't be redistributed. The guidelines name Arial as
the system font for applications (p. 14).

## 3. Colours

All values come from the guideline's colour pages: primary colours p. 33, neutrals p. 34,
secondary colours p. 35, proportion p. 42. Royal Blue `#0047BA` is reserved for the logo (p. 30)
and isn't used anywhere in the UI.

### Main interface

| Used for | Old | New | Brand colour name |
|---|---|---|---|
| Buttons, links, selected tabs, focus outline, avatar | `#1A56C4` | `#27348B` | Medium Blue |
| Button hover | `#003D6B` | `#001358` | Dark Blue |
| Light blue highlight (icon tiles, selected rows) | `#E8F0FB` | `#ECEDF5` | Medium Blue tint |
| Sidebar background | `#003D6B` | `#001358` | Dark Blue |
| Sidebar selected item | Solid `#1A56C4` block | Soft white highlight (12%) with a 3 px Bright Teal `#00CFD1` marker on the left | Bright Teal |
| Landing page main button | Blue | White button with Dark Blue text on the Dark Blue header | Dark Blue |
| Administration sidebar | `#1F2A37` | `#262626` | Primary Charcoal |
| Page background | Blue-grey gradient (`#EEF3FF` → `#F4F6FB` → `#EDF1F8`) | Flat `#F1F1EF` | The guidelines' page background |
| Main text | `#111827` | `#262626` | Primary Charcoal |
| Body text | `#374151` | `#262626` | Primary Charcoal |
| Secondary text | `#4B5563` | `#525252` | Charcoal, lighter shade |
| Muted text | `#6B7280` | `#6B6B6B` | Charcoal, lighter shade |
| Borders | `#E5E7EB` | `#DBDCDB` | Light Grey |
| Strong borders | `#D1D5DB` | `#A7A8A9` | Slate Grey |
| Light panels | `#F9FAFB` | `#F7F7F6` | Light Grey tint |
| Modal backdrop | Black, 40% | Dark Blue, 45% | Dark Blue |
| Danger (solid) | `#DC3545` | `#E91C49` | Medium Red |

### Status badges and alerts

Each status uses the dark brand shade as text on a light tint of the bright colour. Every pair
passes WCAG AA contrast.

| Status | Old (text / background / border) | New (text / background / border) | Brand colours |
|---|---|---|---|
| Success | `#047857` / `#ECFDF5` / `#A7F3D0` | `#005743` / `#E0FBEA` / `#99F2B7` | Dark Green on Bright Green tint |
| Info | `#1D4ED8` / `#EFF6FF` / `#BFDBFE` | `#003A51` / `#E0F9F9` / `#99ECED` | Dark Teal on Bright Teal tint |
| Warning | `#B45309` / `#FFFBEB` / `#FDE68A` | `#BD471E` / `#FFF2E0` / `#FFD599` | Dark Orange on Bright Orange tint |
| Danger | `#B91C1C` / `#FEF2F2` / `#FECACA` | `#920033` / `#FFEEF1` / `#FFC2CD` | Dark Red on Bright Red tint |
| Neutral | `#374151` / `#F9FAFB` / `#E5E7EB` | `#262626` / `#F7F7F6` / `#DBDCDB` | Charcoal on Light Grey |
| Accent (visitors, crew types) | Purple | `#27348B` / `#ECEDF5` / `#BEC2DC` | Medium Blue on its tint |

### Charts and indicators

| Used for | Old | New |
|---|---|---|
| Chart series 1–7 | `#1A56C4`, `#16A34A`, `#F59E0B`, `#DC2626`, `#7E22CE`, `#0EA5E9`, `#64748B` | Bright Blue `#0030FF`, Bright Teal `#00CFD1`, Bright Green `#00DE4C`, Bright Yellow `#FFCC02`, Bright Orange `#FF9500`, Bright Red `#FF5070`, Slate Grey `#A7A8A9` |
| Utilisation low / mid / high | `#16A34A` / `#F59E0B` / `#DC2626` | Medium Green `#009D45` / Medium Yellow `#EAAA00` / Medium Red `#E91C49` |
| Kiosk background / panel / accent | `#0B2A5B` / `#123A78` / `#38BDF8` | Dark Blue `#001358` / Medium Blue `#27348B` / Bright Teal `#00CFD1` |
| Flight display highlight | `#FACC15` | Bright Yellow `#FFCC02` |
| Scrollbar track / thumb / hover | `#F1F5F9` / `#94A3B8` / `#64748B` | `#F1F1EF` / Slate Grey `#A7A8A9` / `#6B6B6B` |

The full brand palette is defined once, as `--color-brand-*` tokens in
`src/shared/theme/tokens.css`. Every screen picks up the colours from there, with no page-by-page
overrides.

## 4. Icons

| Item | Old | New | Guideline |
|---|---|---|---|
| Icon set | Line icons (Lucide) | Kept: they already match the guideline style (single line weight, rounded ends) | pp. 45–46 |
| Icon colour | MASAR blue `#1A56C4` | Medium Blue `#27348B` (blue is the main icon colour) | p. 48 |
| Decorative icons (KPI cards, landing page) | Blue icon on a pale blue tile | Medium Blue icon on a Medium Blue tint tile | p. 48 |
| Sidebar icons | White | White, unchanged (on the Dark Blue sidebar) | — |

## 5. Screens with visible branding

- **Landing page:** ADNOC logo, Dark Blue header, capitalised headline, white button, blue
  module icons, and the plain logo in the footer.
- **Sign-in:** ADNOC logo on the Dark Blue panel, Medium Blue button.
- **Sidebar:** ADNOC logo with "MASAR / Logistics Management", Dark Blue background, and a soft
  highlight with a teal marker on the selected item.
- **All screens:** buttons, links, forms, tables, cards, tabs, modals, drawers, alerts and status
  badges in the brand colours, and Arial text.

## 6. Design decisions within the guideline

The guideline asks for blue to lead (p. 42) and allows the secondary colours "to create
hierarchy or depth" (p. 35). Applying it to a working application:

| Decision | Why |
|---|---|
| Medium Blue `#27348B` for filled buttons, links and selected tabs instead of Bright Blue `#0030FF` | At 100% on large areas, Bright Blue is too intense for screens people use all day. Medium Blue is a guideline blue with 10.8:1 contrast on white. |
| Bright Blue kept for charts and the brand palette | Small areas, where the bright colour helps without tiring the eye |
| Bright Teal marker on the selected sidebar item | A solid blue block competed with the content. Teal is a primary brand colour, and on Dark Blue it reads clearly (8.8:1). |
| Warnings in Dark Orange instead of Dark Yellow | The Dark Yellow `#8B6500` looks olive-brown on screen. Dark Orange is clearer as a warning and still passes AA (4.7:1). |
| Status colours as dark shades on light tints | The guideline allows tints where needed (p. 33). The dark shades keep small text readable. |
| Layout, tables, buttons and spacing unchanged | Only colour, logo, font and icon colour change; MASAR's layout is kept |

**Theme preview:** the demo also has a theme bar above the header for comparing eight themes
(ADNOC Classic, Bright Blue Intense, Soft Blue Corporate, Navy and Teal, Teal Corporate, White
Navigation, Navy with Warm Accents, Dark Corporate) at Soft, Balanced and Vibrant intensity. All 24
combinations use only the official palette and shades mixed from it, pass WCAG AA contrast, and keep
the logo unchanged. The default is ADNOC Classic, Balanced. See the README for details.

## 7. From the guidelines but not used

| Guideline item | Reason |
|---|---|
| ADNOC Sans, Martina Plantijn and Greta fonts (pp. 11–15) | No licensed web font files; Arial is used instead (p. 14) |
| Photography (pp. 59–70) | Not needed for business screens; marketing images aren't appropriate |
| Offset and block headline treatments (pp. 23–28) | Marketing layouts, not suitable for an operational application |
| Grid system and logo positions for print and social (pp. 50–58) | MASAR's existing application layout is kept |
| Brand pictograms (pp. 45–47) | The existing operational icons are kept; only their colour follows the guideline |

## 8. Corrections made because the PDF is a draft

| Issue in the PDF | What the demo uses |
|---|---|
| "Primary Black" and "Primary Charcoal" are both labelled with the orange values `#FF9500` (p. 34) | The swatches' actual colours: Black `#000000`, Charcoal `#262626` |
| The landscape logo on p. 9 is drawn in `#2851A3` | The documented logo colour, `#0047BA` (p. 30) |
