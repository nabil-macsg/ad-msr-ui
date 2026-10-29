# MASAR UI Demo (ADNOC branded)

A standalone copy of the MASAR React frontend for design review. It runs entirely in the browser on
mock data: no MASAR backend, database, authentication service or API is used. It is **not** the
MASAR application and nothing here is meant to be merged into `masar-frontend`.

## Run it

Requires Node 24 or later.

```bash
npm install
npm run dev        # http://localhost:5180
```

Other scripts: `npm run build` (type check + production build into `dist/`), `npm run preview`
(serves the build on http://localhost:5181), `npm run lint`, `npm run typecheck`, `npm test`.

The demo uses its own port, so it can run next to the real MASAR frontend (5173).

## Logging in

Open http://localhost:5180: the landing page shows **AD-MSR Demo** and **Continue**, which opens
`/login`. The demo has one account, defined in `src/app/auth/demo-account.ts` (ask the demo owner
for it; it is not listed here). It opens every module as the demo Super Admin.

Every route except `/` and `/login` is behind the login (`src/app/auth/ProtectedRoute.tsx`),
including unknown addresses. A protected address opened without logging in goes to
`/login?returnTo=…` and opens after login. The login lasts for the browser tab (sessionStorage;
no password is stored): refreshing keeps it, closing the tab ends it, and **Log out** (sidebar or
user menu) ends it and returns to `/login`. Demo data and the chosen theme are kept.

**This is a navigation gate, not security.** The account and the whole app ship in the
JavaScript bundle, so anyone who can load the site can read them.

## Hosting

The demo asks not to be indexed: `public/robots.txt` (`Disallow: /`, served at `/robots.txt`),
a `robots` meta tag in `index.html`, and an `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
header on `npm run dev` and `npm run preview`. When deploying `dist/`, have the web server send the
same `X-Robots-Tag` header.

These only ask search engines not to index the site; they do not stop anyone opening the URL.
If the demo is hosted where others can reach it, put access protection in front of it at the web
server, such as HTTP Basic Authentication or an identity-aware access gateway.

## Mock data

Every `/api/…` request the screens make is answered in the browser by `src/mock`, so the real MASAR
screens and API client run unchanged.

- `src/mock/install.ts` intercepts `fetch` for `/api/…` (installed in `src/main.tsx`).
- `src/mock/core/` – router, in-memory store, the shared list query (search, filters, sort,
  paging), generic master create/edit/deactivate/delete with version checks, audit trail.
- `src/mock/services/` – one service per area: session, platform (users, roles, access matrix,
  audit log, home, search, notifications, support), places (locations, routes, installations,
  organisations, POB masters), resources (resource categories and types, aircraft models, Fleet,
  quotas), engines (approval engine, reason codes, business rules, notification engine),
  scheduling, and the representative module screens.
- `src/mock/data/` – typed seed data, built mostly from MASAR's own demo seed files
  (`src/mock/data/seeds/*.json`, copied from `masar-backend/db/seeds/demo`). Ids are stable.
- `src/mock/demo-auth.ts` – the static demo users and the tab's demo session.

Changes you make (create, edit, deactivate, delete, status changes) are kept in this browser's
localStorage under `masar-demo:data:v1`. To start again with the seed data, clear site data for
`localhost:5180` (or run `localStorage.clear()` in the browser console) and reload.

Booking, Dispatch, POB, Helideck and Reporting aren't built in MASAR yet. Their dashboards
(`/booking`, `/booking/my-bookings`, `/dispatch`, `/pob/dashboard`, `/helideck`,
`/reports/executive-summary`) are representative demo screens (`src/demo/`) with searchable,
filterable, sortable, paged lists; bookings can change status. Other pages of those modules show
MASAR's "not built yet" page inside the normal layout.

The Fleet master reflects the approved refinement: Air (fixed wing, rotary wing) and Water/Marine
resources, category derived from the resource type, type-owned seat map/payload/baggage, seat
capacity as the only unit-level value, availability, helideck compatibility for rotary wing only,
and no seat-quota section (quotas belong to the Quotas master).

## Branding

Applied from **ADNOC "Energy for Life" Visual Guidelines** (`EFL_Visual Guidelines_v13_241204
9.pdf`, labelled V.12, December 2024, **DRAFT**), the only reference supplied.

- **Logo** – extracted as vector paths from the PDF (pp. 6 and 9), no watermark or captions:
  `public/brand/adnoc-logo*.svg`, plus `favicon.svg`. The cartouche-visible variant is used on dark
  fields (sidebar, login panel, landing page), the cartouche-hidden one on white (landing
  footer), as pp. 6–8 direct. The portrait logos keep the PDF's colour, ADNOC Royal Blue `#0047BA`.
  The landscape logo on p. 9 is drawn in `#2851A3` in the draft; its shapes are kept and it takes
  the documented logo colour `#0047BA` (p. 30).
- **Colour** – `src/shared/theme/tokens.css` holds the full palette (pp. 33–35) as
  `--color-brand-*` tokens and maps it onto MASAR's tokens: Medium Blue `#27348B` for buttons,
  links and focus (Bright Blue `#0030FF` is too intense on large areas and stays in charts); Dark
  Blue `#001358` navigation with a Bright Teal marker on the selected item (Charcoal `#262626` for
  Administration); Charcoal text; Light Grey / Slate Grey borders; the guidelines' `#F1F1EF` page
  background; status colours as dark brand shades on light tints of the bright colours (all pairs
  pass WCAG AA); the six bright colours for charts. Royal Blue `#0047BA` is used for the logo only.
- **Type** – ADNOC Sans is the brand typeface but no licensed web font is available (the PDF only
  embeds subsets, which aren't redistributable). The font stack is `'ADNOC Sans', Arial, …`: Arial
  is the guidelines' system typeface for applications (p. 14); anyone with ADNOC Sans installed
  sees it. Body leading stays 1.5× (p. 16). Headlines in capitals are used on the landing page
  only.
- **Icons** – MASAR's line icons (Lucide: single weight, rounded terminals) match the pictogram
  style on pp. 45–48 and are kept; decorative icons are Medium Blue on a light blue tile.

See `BRANDING_CHANGES.md` for the full old → new list.

## Theme preview

A dark bar above the header compares eight colour themes at three intensities (24 combinations):

| Theme | Navigation | Selected item | Actions |
|---|---|---|---|
| ADNOC Classic (default) | Dark Blue | Bright Blue | Bright Blue |
| Bright Blue Intense | Bright Blue | Dark Blue | Bright Blue |
| Soft Blue Corporate | Light blue, navy text | Blue tint, blue marker | Medium Blue |
| Navy and Teal | Dark Blue | Teal, teal marker | Medium Teal |
| Teal Corporate | Dark Teal | Medium / Bright Teal | Medium Teal |
| White Navigation | White, dark text | Blue tint, blue marker | Bright Blue |
| Navy with Warm Accents | Dark Blue | Orange marker | Medium / Bright Blue |
| Dark Corporate | Dark Blue on charcoal surfaces | Teal | Bright Blue |

**Soft / Balanced / Vibrant** generate different colour tokens (lighter or stronger navigation,
selection, actions, backgrounds and table headers), not an opacity filter. Administration keeps its
own navigation colours in every theme.

- Every combination is built from the official palette (`src/app/theme/theme-presets.ts`; derived
  shades are written as `mix(...)` of official colours) by `src/app/theme/theme-tokens.ts`, and
  applied as CSS variables in one `<style>` element, so switching is instant and keeps the page,
  route and form state.
- Text colours are computed for contrast; a unit test checks every combination meets WCAG AA
  (4.5:1, 7:1 for main text). Where a brand colour can't carry text at 4.5:1 (Medium Teal with
  white text is 4.41:1), it is deepened slightly towards Dark Teal/Dark Blue.
- The choice is kept in this browser (`masar-demo:theme`); **Reset to default** returns to ADNOC
  Classic, Balanced. Royal Blue `#0047BA` is never used, and the logo doesn't change.

## Known limitations

- Demo data only; it resets per browser. Exports download CSV whatever format is chosen.
- Scheduling derives journeys from the seed routes and fleet, so routes or fleet units added during
  the demo don't appear in scheduling.
- Matrix edits are saved but don't change what the demo users can do (their rights are fixed).
- No live updates (the realtime socket is switched off), no file storage, no emails.
- ADNOC Sans, Martina Plantijn and Greta are not available as web fonts (see Type above).
- The guidelines PDF is a draft: its Primary Black and Primary Charcoal swatches are labelled with
  the orange values; the demo uses the swatches' actual fills (`#000000`, `#262626`).
- Map tiles on map screens come from OpenStreetMap when those screens are opened.
