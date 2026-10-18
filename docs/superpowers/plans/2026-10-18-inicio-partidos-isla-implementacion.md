# Inicio, Partidos and the live island · implementation plan

Date: 2026-10-18. Design approved by the user: the «Elegida» page of the Design canvas «Inicio, Partidos e isla en
vivo · bocetos» (https://claude.ai/artifact/F2girfhTrE6Yrq53tdBYkm): round 2's **D «La luz del partido»** as the base,
with **E's «primera fila»** and **F's island**. The artboards are the look to port, class for class where it makes
sense; their sources (plain JS/HTML that generated them) are the reference implementation of every visual detail:

- Scratchpad root `S` = `C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Desktop-Development-Manchester-Piti\7c3c14ba-f6f0-49e6-9940-bc1490e6cf7c\scratchpad`
- Artboards: `S\canvas\project\EL-*.dc.html` (Inicio390/820/1440, InicioEstados, Momentos, Partidos390/820/1440,
  PartidosEstados, PrimeraFila(+Estados), Isla(+Estados, +Comportamiento)); renders in `S\canvas\shots\{D,E,F,G}\`.
- Sources: `S\d2-src\` (engine.js = the three.js ground, many views on one context; sky.js, sun.js, rig.js,
  still2d.js = the 2D still painter; el-hero.js = the phase/step model `elModel`, `EL_STEPS`; el-inicio.tpl.html;
  common.css), `S\g-src\` (Partidos: partidos.tpl.html, partidos.css, partidos.js; its engine.js has the
  `syncFigs` fix: `f.g.position.set(f.pos.x, 0, f.pos.z)`), `S\e2-src\el\` (fila.js/css/html = the front row),
  `S\f2-src\` (el-core.js = island model, el-isla.mjs = island markup/CSS).
- Briefs: `S\canvas\BRIEF3.md` (every state), `S\canvas\BRIEF2.md` (data, inventory, craft rules).

## Non-negotiables

- **The PC must never be overloaded** (it powered off twice on 2026-10-18 under parallel load). Every heavy command
  (pnpm install, tests, lint, type-check, build, any Chromium) goes through `node S\tools\heavy.mjs <cwd> <cmd…>`
  (one at a time across all agents, low priority, 12 threads) and screenshots through
  `node S\tools\shoot-url.mjs <outDir> <url>[@width[@dark|light[@selector+…]]]` (same lock). Vitest: always
  `--maxWorkers=6`; during work run only the test files you touch. Never run Playwright/e2e or emulators yourself.
  One dev server per agent at most, on your assigned port, stopped when you finish.
- Spanish-first copy in the club's voice; glossary of PRODUCT.md (acta, convocatoria, el siete, ficha…).
- WCAG 2.1 AA in night and day themes, 44 px targets, status never by colour alone, `prefers-reduced-motion`
  honoured (static or crossfade), polite live regions that announce changes once (never a ticking minute).
- Data rules (firestore.rules): RSVP answers/counts (`matchPrivate/{id}/availability`) are member-only, so fans see
  convocados + the published seven, never answers or counts; the porra is own-only until kickoff; MVP shows no
  running tally while the vote is open (winner after `voteClosesAt`); the nota is 1–5 («Nota del vestuario: 4,2 ·
  6 votos»); reactions are per crónica moment, public once the acta is published.
- Server render: `/` and `/partidos` are rendered by `api/render.js` (Lighthouse mobile 98–99). First paint is
  HTML/CSS only (text, score, countdown, a CSS sky); WebGL is a lazy chunk mounted after load, only when visible,
  paused offscreen/hidden, DPR ≤ 1.5, one context per page, Save-Data/no-WebGL/reduced → the designed still.
  Member data never renders on the server (the `useHydrated` + `useViewer` pattern of `HomeHoy`).
- TypeScript strict, no `any`, Zod at boundaries as the codebase does, Oxlint clean, tests next to the code.
- Repo files are CRLF (`core.autocrlf=true`): edit with the editor tool, not scripts that write LF.

## Contract (shared by every workstream)

### `src/lib/derived/sun.ts` (W1)
```ts
export interface SunPosition { elevation: number; azimuth: number } // degrees; azimuth from north, clockwise
export const PALOMERAS = { lat: 40.39, lon: -3.66 } as const;
export function sunPosition(ms: number, lat?: number, lon?: number): SunPosition;      // NOAA algorithm
export function sunTimes(ms: number, lat?: number, lon?: number): { sunrise: number; sunset: number }; // that Madrid day
export type LightKey = "dia" | "tarde" | "dorada" | "ocaso" | "noche";
export function lightOf(elevation: number): LightKey; // >25 dia · 10–25 tarde · 2–10 dorada · −4–2 ocaso · < −4 noche
export function floodlightsOn(elevation: number, live: boolean): boolean; // live and elevation < 3, or elevation < −4
```
Tested against known values (Madrid 18 Oct 2026: sunset ≈ 19:20–19:25 CEST; noon elevation ≈ 40°).

### `src/lib/weather.ts` (W1)
`MatchWeather` gains `cloud: number | null` (0–100, Open-Meteo hourly `cloud_cover`); `readForecast` reads it.

### `src/lib/derived/matchday.ts` (W1)
```ts
export type MatchdayPhase = "pretemporada" | "semana" | "antes" | "pitido" | "directo1" | "descanso" | "directo2"
  | "final" | "acta" | "despues" | "aplazado";
export interface MatchdayModel {
  phase: MatchdayPhase;
  /** The match the page is about: today's / the live one / the one in final·acta·después / the next one. */
  match: ClubMatch | null;
  /** The next match to count down to when it isn't `match` (después, aplazado). */
  next: ClubMatch | null;
  /** The last finished match of the season. */
  last: ClubMatch | null;
  kickoff: number | null;                 // ms of `match`
  minute: number | null;                  // shownMinute while live
  added: number | null;                   // added-time label («+2») when the clock carries it
  score: { gf: number; ga: number } | null; // scoreOf(match) from directo1 on
  jornada: number | null;
}
export function matchdayOf(matches: readonly ClubMatch[], seasonId: string, now: number): MatchdayModel;
export type ViewerRole = "aficionado" | "titular" | "suplente" | "noconvocado" | "ausente" | "anotador";
export function viewerRoleOf(match: ClubMatch | null, viewer: { member: boolean; playerId: string | null },
  ctx: { scorer: boolean; absentToday: boolean; seven: readonly string[] }): ViewerRole;
```
Rules (use `kickoffState`, `matchPhase`, `currentHalf`, `seasonPulse`, the Madrid date helpers; never re-derive):
live first half → `directo1`, halftime → `descanso`, second half → `directo2`; `pending_whistle` → `pitido`; a
match today (Madrid date) before kickoff → `antes`; ended/awaiting acta → `final`; acta published and MVP vote open
→ `acta`; vote closed and the next match isn't today → `despues` while the last match is ≤ 4 days old, else `semana`
(next scheduled) ; the nearest fixture postponed/cancelled → `aplazado`; no fixtures in the season →
`pretemporada`. Viewer: anotador > ausente > titular (in `seven`) > suplente (called) > noconvocado; aficionado when
not a member.

### `src/lib/derived/frontRow.ts` (W1)
```ts
export type SeatState = "voy" | "duda" | "novoy" | "sinresponder" | "convocado" | "noconvocado" | "ausente"
  | "campo" | "banquillo" | "expulsado" | "lesionado" | "jugo" | "nojugo";
export interface SeatMarker { kind: "gol" | "amarilla" | "roja" | "entra" | "sale" | "lesion" | "mvp" | "anota"; minute?: number }
export interface Seat {
  playerId: string; dorsal: string; name: string; state: SeatState;
  starter: boolean; position: string | null; mine: boolean; markers: SeatMarker[];
  minutes?: number; goals?: number; logros?: string[]; mvpCandidate?: boolean;
}
export type FrontRowMode = "plantilla" | "convocatoria" | "banquillo" | "jugaron";
export interface FrontRow {
  mode: FrontRowMode; seats: Seat[];
  /** null for fans: answers and counts are member-only. */
  counts: { vienen: number; duda: number; no: number; sinResponder: number; ausentes: number } | null;
  sevenPublished: boolean;
}
export function frontRowOf(input: {
  match: ClubMatch | null; phase: MatchdayPhase;
  squad: readonly { id: string; name: string; dorsal: string; position: string | null }[];
  seven: readonly string[];                     // campoSeven / match.lineup
  answers: readonly { playerId: string | null; response: "yes" | "no" | "maybe" }[] | null; // null for fans
  absentIds: readonly string[]; viewerPlayerId: string | null; scorerIds: readonly string[];
  mvpVoteOpen: boolean; now: number;
}): FrontRow;
```
Bench and markers during the match come from `lineupNow`/`lineupWalk` and the settled events; minutes, goals and
logros after the final from the ledger and `derived/achievements`.

### `src/lib/derived/moments.ts` and `useMatchMoment` (W3)
```ts
export type MomentKind = "gol" | "golrival" | "amarilla" | "roja" | "cambio" | "palo" | "parada" | "penalti"
  | "lesion" | "arranque" | "descanso" | "reanudacion" | "final";
export interface MatchMoment { id: string; kind: MomentKind; ours: boolean; minute: number | null;
  title: string; sub: string; said: string }
export function momentOf(e: MatchEvent, match: ClubMatch, nameOf: (id: string) => string): MatchMoment | null;
// src/components/celeste/isla/useMatchMoment.ts
export function useMatchMoment(match: ClubMatch | undefined, now: number,
  opts?: { hold?: number; celebrate?: boolean }): MatchMoment | null; // fresh events only (generalises isFreshGoal)
```

### Island signals (W3)
`src/components/celeste/isla/heroSignal.ts`: `useIslaHero(ref: RefObject<Element | null>)`: while the element is
in view, `document.documentElement.dataset.islaHero = "1"` (the island hides); pages call it on their hero.

### `src/components/palomeras3d/` (W2)
```ts
export interface PalomerasFigure { id: string; num: string; name: string; x: number; y: number; // pitch % (x across, y from our goal)
  tag?: "tu" | "gol" | "mvp" | "amarilla" | "roja"; leaving?: boolean; huddle?: boolean }
export interface PalomerasState {
  at: number;                         // ms shown: drives the sun (sunPosition) and the sky
  weather?: { sky: Sky; cloud?: number | null; rain?: number | null } | null;
  floodlights: "off" | "glow" | "on";
  board?: string;                     // perimeter boards' live message (sponsors otherwise)
  sponsors?: readonly string[];
  figures?: readonly PalomerasFigure[];
  away?: boolean;                     // neutral visiting ground (no crest)
}
export type PalomerasRig = "hero390" | "hero820" | "hero1440" | "slice" | "sliceWide" | "window";
export interface PalomerasHandle { goal(ours: boolean, scorerId?: string): void; ignite(): void;
  mvp(id: string): void; pointer(nx: number, ny: number): void }
// <Palomeras rig state reduced? className onReady? ref /> : renders the still (SSR-safe CSS sky + 2D painter on the
// client) and swaps to WebGL when visible; broadcast name plates as DOM over the canvas (decorative, aria-hidden).
// <PalomerasSlices views={{ rig, state, w, h }[]} /> : one context drawing several slices (Partidos).
export function skyCss(at: number, weather?: PalomerasState["weather"]): string; // SSR first-paint gradient
```

## Workstreams

Each agent works in its own git worktree (branch from `main` with this plan), commits small logical commits with
Spanish messages like the history, does NOT push, merge, deploy or touch production. Report: branch, commits, what is
done and verified (commands + output summary), what is not, what the integrator must do.

### Wave A (in parallel)
- **W1 · Datos del día de partido** (effort medium). Owns: `src/lib/derived/{sun,matchday,frontRow}.ts` + tests,
  `src/lib/weather.ts` (+ test). Nothing visual.
- **W2 · Palomeras 3D** (effort high). Owns: `src/components/palomeras3d/**` (engine port to TS from `S\d2-src` +
  `S\g-src\engine.js` fixes, still painter, React wrappers, tests for pure parts). Verify visually with a dev-only
  harness that is NOT committed (e.g. `harness/palomeras.html` + `.tsx` at the worktree root), dev server on port
  3201, shots via shoot-url. It may duplicate a tiny sun calculation privately if W1's file isn't there yet, but the
  public API takes `at` (ms) and must use `src/lib/derived/sun.ts` once merged (the integrator wires it).
- **W3 · La isla** (effort high). Owns: `src/components/celeste/LiveIsland.tsx` (rewrite, may split into
  `src/components/celeste/isla/**`), `src/lib/derived/island.ts` (new states: previa, rsvp, anotador, event states
  from moments), `src/lib/derived/moments.ts`, `src/components/celeste/isla/{useMatchMoment,heroSignal}.ts`,
  `src/styles/isla.css` (new) and removing the island rules from `src/styles/partidos.css` (only those rules; that
  file is shared by 10 modules). Phone: full-width 46 px strip fixed at the top under the safe area; tablet
  (700–1099): bar above the dock; desktop (≥1100): draggable PiP snapping to corners, resting as the bug, unfolding
  for ~9 s per play, pinned sizes normal/grande, dismiss + recover, corner/size in localStorage (try/catch).
  Keep: hidden on its own match page, la mesa, admin, pizarra; `html[data-isle]` reservation; vote dismissal;
  View Transition into the match page board (`view-transition-name`). Tests: LiveIsland.test.tsx updated + new.
  Harness on port 3202 with mock matches (not committed).

### Wave B (in parallel, after Wave A is merged into main)
- **W4 · Inicio** (effort high). Owns `src/pages/home/**` and a new `src/styles/inicio.css` (retire home.css /
  home-match.css usage from the page; leave the files if other modules import them). Hero (Palomeras + headline,
  club scoreboard object, «Arrastra el sol», boards strip), the slot for the front row (W6's component), «Tu partido»
  per viewer/phase, phase blocks, «La temporada», «Lo que viene» (sky chips via sun.ts), «En el club», «Ponte la
  del Piti» (keep `PonteLaCamiseta`), the fans' vestuario invitation, day/night. Calls `useIslaHero` on the hero.
- **W5 · Partidos** (effort high). Owns `src/pages/partidos/**` and a new `src/styles/partidos-luz.css`.
  «El calendario de luz» (PalomerasSlices), the J-now plinth, summary, calendar rows (sky chip, kit, home/away,
  Cómo llegar, Al calendario, socio compact RSVP), filters/search/season/vista tabla, states.
- **W6 · La primera fila** (effort high). Owns `src/components/celeste/primeraFila/**` (+ CSS) : the component
  `<PrimeraFila row={FrontRow} phase viewer onRsvp onVote … />` with every state of `EL-PrimeraFila`, member
  controls (RSVP via the existing vestuario writes, MVP vote via the existing vote write), «clac» sound opt-in.

## Verification (integrator)
Per wave: merge branches into `main`; `heavy.mjs` → `pnpm lint`, `pnpm test -- --maxWorkers=6`, `pnpm build`.
Before pushing: local emulators (namespace `demo-piti-design`, seeded scenario), shoot-url at 360/390/820/1024/
1280/1440, dark and light, reduced motion, the phases antes/directo/descanso/final/acta/después and viewers fan/
titular/anotador; e2e `home.preview` and `navigation.preview` updated and run once; then push and
`git update-ref refs/remotes/origin/main main`.
