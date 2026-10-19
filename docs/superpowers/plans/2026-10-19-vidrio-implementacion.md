# «Vidrio»: implementation plan (Inicio, Partidos, live system, shared chrome) · 2026-10-19

Approved by the user: «build «Vidrio» on the real website in phases and push it to main once it's verified».
Design source of truth (read the boards, not just this file):
- Plan: `<S>\canvas\PLAN-V.md`; briefs `<S>\canvas\BRIEF5.md`, `<S>\canvas\BRIEF6.md` (round 4.1 changes).
- Boards (`.dc.html`, open the source for exact values): `<S>\canvas\project\v-kit.css`, `V-Sistema.dc.html`,
  `V-Inicio{390,820,1440,1920}.dc.html`, `V-Partidos{390,820,1440,1920}.dc.html`, `V-Vivo.dc.html`,
  `V-Integracion.dc.html`; their generators `<S>\v4-a\`, `<S>\v4-b\`, `<S>\v4-c\` (kit.js = refraction, drag, swap,
  grow; data41.mjs; logic41.js; draw.js = ribbon/minimap/signature drawing).
- Renders: `<S>\canvas\shots\v41\*.png` (latest), `<S>\canvas\shots\v4\*.png`.
- Canvas: https://claude.ai/artifact/F2girfhTrE6Yrq53tdBYkm (page «Ronda 4 · Vidrio»).
`<S>` = `C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Desktop-Development-Manchester-Piti\7c3c14ba-f6f0-49e6-9940-bc1490e6cf7c\scratchpad`

## User decisions to honour (from the reviews)
- Liquid Glass only on things you touch/move (capsule, floating score, lens, ornaments, sheets, controls); reading
  content sits on the light field. Font Mona Sans (variable, wdth 75–125) for headings and UI; Geist Mono only for
  the clock. Gold only for our goal and the MVP.
- No pulse line on the capsule. Liveness = small live dot on «Partidos» + the floating score.
- Desktop floating score: detached under the top bar (16 px), no neck, draggable, snaps to anchors, remembers its spot
  per page (localStorage), double-click/Home returns it. Phone: above the tab bar, drags along the bottom edge.
- «Sacar el marcador»: Document Picture-in-Picture where available (Chromium desktop), else an in-page draggable,
  resizable glass window; both remember position.
- Transitions: exit first (160 ms by region) → shared objects morph (View Transitions, `view-transition-name`) →
  enter from the direction of travel (220 ms, 30 ms stagger). Never two states fully visible together. Reduced
  motion: 120 ms crossfade. Browsers without View Transitions: instant swap.
- Inicio = places Hoy / Temporada / Club / Tú (Tú only for a signed-in member linked to a player). 1440: one stage
  per place with the shelf. 1920: cockpit, three zones always visible (Temporada left, Hoy centre, Club + Tú right);
  the shelf focuses/grows a zone, never hides one. Phone/tablet: stage head + selected place below.
- Partidos = ribbon of light (minimap of the whole season + focused window of 6–10 segments), big lens with
  Previa / Directo / Acta, vistas Jornadas / Tabla / Números, «¿Y si…?» on the upcoming segments with presets,
  cartel de la jornada, filters, rival search, season selector. No list of matches.
- Lots of data: summaries show N rows + «N más · Ver todo…», which grows the same panel into the stage's main window
  (View Transition) with its own scroll, filters where useful, and «Cerrar». Table in focus mode (leader … us ±3 …).
  Everything stays inside the viewport stage on desktop (zones scroll inside themselves with a bottom fade).
- No live reactions. No MVP running tally (firestore rules). No new Firestore data in this build (the «Avisos a
  medida» idea is deferred; say so in the final report).
- A match nobody started on la mesa past its window is «Pendiente del acta» (matchday phase `pendiente`): no score.
- Keep: SSR of `/` and `/partidos` (api/render.js) with real first paint; `?view=tabla` on Partidos; WCAG 2.1 AA;
  44 px targets; reduced motion and reduced transparency; Spanish copy; `endSentence` for sentences ending in a name.

## Architecture and contracts

### P1 kit (branch `feat/vidrio-kit`) — owns `src/components/vidrio/**`, `src/styles/vidrio/**`, fonts, Chrome restyle
- Font: add `@fontsource-variable/mona-sans` (5.3.0, checked: nothing in the repo covers it); `@font-face` in
  `src/styles/fonts.css` (latin + latin-ext wdth/wght axes as fontsource ships them); add its latin woff2 to
  `CRITICAL_FONTS` in vite.config.ts. Tokens: `--vd-*` in `src/styles/vidrio/tokens.css` (colours, radii, type scale,
  durations) for dark and `[data-theme="light"]`.
- `<VidrioSky light={LightKey|"noon"} weather? reduced? />`: the light field. First paint = layered CSS gradients
  (server-safe); a client-only canvas adds ~40 bokeh discs once (no rAF loop); grain + vignette; `gold` flood class for
  the goal moment. Light from `lightOf`/`sunPosition` (src/lib/derived/sun.ts).
- Glass: `.vd-glass` (blur+saturate, rim, specular via `--vd-lx/--vd-ly` set by a pointer hook), `.vd-glass--lens`
  adds refraction: `<VidrioDefs />` renders the SVG `feDisplacementMap` filter once; enabled only where supported
  (Chromium: feature-detect `backdrop-filter: url(#…)`), else blur. `prefers-reduced-transparency` → solid navy 92 %.
- Shared chrome restyle (ALL pages): `CelesteHeader` becomes the glass capsule nav, `CelesteDock` the glass tab bar.
  KEEP their props, DOM contract and names used by tests/e2e: `.vx-top`, `.vx-nav a`, `nav[aria-label="Navegación
  principal"]`, `nav[aria-label="Navegación móvil"]`, link «Entrar al vestuario», «El club», SearchGate, NoticesGate,
  ThemeToggle. Add `live` prop/state → `.vd-livedot` with sr text «, en directo» on «Partidos». Check every page
  that uses the chrome still looks right (home, partidos, stats, club, plantilla, jugador, match, vestuario, perfil,
  pizarra, acceso, state panels).
- Components (all with tests for their logic):
  - `<Shelf places=[{id,label,hint,badge?}] value onChange />` glass segmented control with a sliding bead
    (radiogroup semantics: role="tablist" with aria-controls, arrow keys).
  - `<Lens>` glass container; `<MomentumRibbon items duration now />` (data from `pulseTrack`-like ticks).
  - `<SeeAll summary count label onOpen />` + `<GrowWindow open title filters onClose>`; `useGrow()` wraps
    `document.startViewTransition` with a shared `view-transition-name`.
  - `swap(direction, update)` helper (`src/components/vidrio/transitions.ts`): the exit→morph→enter choreography via
    View Transitions with `view-transition-class` per region; CSS in `src/styles/vidrio/transitions.css`; reduced
    motion and unsupported fallbacks.
  - `<FloatingScore match now onOpen onPip />` + `useDraggable(ref, {anchors, storageKey, axis})` (pure snapping
    math in `src/components/vidrio/anchors.ts`, unit-tested).
  - `<PipWindow>`: `openScorePip(render)` using `documentPictureInPicture.requestWindow` when present (copies the
    kit stylesheets into the PiP document), else an in-page draggable/resizable glass window.
  - Live docking API (used by P3/P4/P5): `useLiveDock(ref, mode)` where a page declares «my lens shows the match»
    (`mode: "lens"`) or «dock the float on this element» (`mode: "anchor"`); exported store `liveDock` the floating
    score reads (replaces `useIslaHero`). Server render: no-op.
  - Goal moment: `useGoalMoment(moment)` returning the timed classes (inhale, spring, gold flood, glint, digit roll,
    name width) — durations from PLAN-V; reduced motion = number change + gold rim.
- No page changes in P1 except the chrome restyle and font. Lint/test/build green.

### P2 data (branch `feat/vidrio-datos`) — owns new pure modules in `src/lib/derived/vidrio/**` with tests
- `tableFocus(rows, usTeam, around=3)` → rows with `gap` markers and «N equipos más arriba/abajo».
- `simulateTable(rows, fixtures, picks, preset)` («¿Y si…?»): picks per remaining jornada (G/E/P), presets
  `nada | ritmo | victorias | empates`; returns projected rows (us and the rival we play move), our points, position,
  `comoMucho`, `comoPoco`; other teams' remaining matches untouched (documented).
- `seasonStrip(matches, seasonId, now, weatherByMatch?)` → per jornada: id, number, date, light key at kick-off
  (via sun), state (`jugado|directo|hoy|proximo|aplazado|suspendido|pendiente`), result letter G/E/P (+A aplazado),
  score, months boundaries, gaps (weeks without match), «hoy» index; `windowAround(index, size)` paging.
- `playsLog(match, nameOf, rival)` → all settled events as rows {minute, half, kind: gol|tarjeta|cambio|ocasion|
  parada|otro, ours, title, sub}, filters, halves; uses `eventSentence`/`eventMetaOf`.
- `matchSignature(match)` → ring geometry data from real events (as in v4-b draw.js) for played and live matches.
- `seasonLeaders(matches, seasonId, players)` full scorer/assist lists (reuse `leaders` in src/lib/home.ts).
- `viewerKind(viewer, player)` → `aficion | socio | jugador`.
- `placeHints(...)` short live hints for the shelf (Hoy «2–1, minuto 23», Temporada «4º si acaba así», Club
  «Huberoski cumple el 27», Tú «2 cosas pendientes»).
- `cartelOf(match, …)` data for the generated poster.
- Long-season fixture for tests and previews: `src/lib/derived/vidrio/fixtures.ts` (14 teams, 26 jornadas, J17 live,
  38 plays) — test data only.

### P3 Inicio (branch `feat/vidrio-inicio`, after P1+P2 merged) — owns `src/pages/home/**`, `src/styles/inicio*.css`
Replace the «La luz del partido» home with the V-Inicio boards: places, shelf, stage/cockpit, lens with momentum,
el siete on a glass pitch with real shirt stills (`useShirtStills`), plays ornament with «Ver todo», Temporada (table
focus + «¿Y si…» link to Partidos, form, leaders, season strip), Club (birthdays, vitrina, plantilla door, «Ponte la
del Piti» keeps its labels «Tu nombre»/«Dorsal» and the subscribe-calendar menu), Tú (RSVP, porra, turnos, caja,
encuestas, logros/cromos, avisos) only for jugador. Fans get the vestuario invitation. Phases antes/directo/
pendiente/final/acta/después/aplazado/semana/pretemporada all handled (copy from the boards; reuse inicioModel
copy rules where still valid). Place in the URL hash (`#temporada`), SSR paints Hoy. Retire the replaced pieces
(InicioHero, ClubScoreboard, SunScrub, primera fila on home) only if nothing else imports them.
Update e2e/home.preview.spec.ts and navigation spec assertions that depended on «Marcador del campo», keeping the
same user journeys (headline, link to the match, «Pide entrar al vestuario», shirt maker, calendar subscribe).

### P4 Partidos (branch `feat/vidrio-partidos`, after P1+P2 merged) — owns `src/pages/partidos/**`, `src/styles/partidos*.css`
Ribbon (minimap + window), lens with tabs per state, vistas (Jornadas/Tabla/Números, `?view=tabla` kept and SSR'd),
«¿Y si…?», cartel (canvas → image, «Compartir» via Web Share, «Guardar la imagen»), filters, rival search (searchbox
«Buscar rival», jumps to the jornada), season selector (combobox «Temporada»), «Pendiente del acta» state. h1
«Partidos». Retire LightCalendar/palomeras3d use here. Update e2e (navigation + rankings specs: the «Pichichi
compartido» summary now lives in Números/Jornadas summary; keep a visible text «Pichichi compartido» with both names).

### P5 live (branch `feat/vidrio-vivo`, after P1+P2 merged) — owns `src/components/celeste/LiveIsland*`,
`src/components/celeste/isla/**`, `src/components/vidrio/live/**`, RootLayout mount, match page landing
Replace the island with the floating score system on every page: states previa/«¿Vas hoy?»/«Hoy anotas tú»/pendiente
del pitido/live/descanso/final/acta/vota MVP/sin conexión (reuse `islandOf`/`islaVista`/moments logic where it
fits), sheet on tap (last plays, en el campo, «Abrir el partido» with View Transition into the match page
scoreboard, «Sacar el marcador», «Ocultar hasta el próximo gol»), goal moment, polite live region (never the ticking
minute), docking via `liveDock` (Inicio: lens, Partidos: tonight's segment, others: floating). Client-only (never in
the server render). Retire `isla/*`, `isla.css`, and `palomeras3d` once P3/P4 no longer import them (coordinate:
P5 deletes only what has no importers after merging P3/P4; otherwise leave a note).

## Process and rules for every phase agent
- Work in your own git worktree/branch (isolation: worktree). Commit there; the lead merges into main. Never push.
- CRLF repo; scripts that patch files split/join on CRLF. Stage specific files; no `--no-verify`.
- Resources (the user's PC crashed twice): heavy commands only through `node <S>\tools\heavy.mjs <worktree> <cmd>`
  (lint, test with `--maxWorkers=4`, build); browser renders only through `<S>\tools\shoot-url.mjs` (shared lock,
  one Chromium at a time; env LOGIN/ORIGIN/WAIT/VH/NOBANNER/REDUCED/NOJS as documented in the script header).
  Never launch Playwright/Chromium any other way. You may run ONE vite dev server for your worktree in the
  background on your port (P3 3121, P4 3122, P5 3123, P1 3124, P2 none) with
  `VITE_USE_FIREBASE_EMULATOR=1` and placeholder Firebase env vars set in the shell (never create `.env`); stop it
  when done. Emulators (auth+firestore, project `demo-piti-design`) are run by the lead; seed with
  `node <S>\seed-elegida.mjs <fase>` (fases: antes, directo1, descanso, directo2, final, acta, despues, aplazado,
  pretemporada). Sign in via the dev buttons «Google de prueba · Solo emulador» (Jordi, jugador/admin) and «Fichaje de
  prueba · Solo emulador» (Huberoski, anotador). Do not point anything at production.
- Definition of done per phase: lint clean, tests green (add tests for new logic and components), build OK, your
  pages rendered at 390/820/1440/1920 (and the phases that matter) and compared side by side with the boards,
  reduced motion checked, no sideways scroll, no overlaps, SSR of `/` and `/partidos` still renders (for P3/P4:
  `node <S>\tools\ssr-check.mjs <worktree>` after `pnpm build` — note it fetches the public bundle read-only).
- Report: what you built, files, commits, what you verified (with shot paths), what's left or deferred.
