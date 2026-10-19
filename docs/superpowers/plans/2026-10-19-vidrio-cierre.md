# «Vidrio» · cierre: everything the artifact promised (2026-10-19)

The user, after the release: «la idea era integrar exactamente las cosas como en el artifact. Incluso las cosas que no
has incluido, que dices que necesitan nuevos datos o funciones, había que incluirlos. Y en diseños y detalles
visuales, varios no son exactamente como prometiste.» So: the boards are the truth (with the round 4.1 user decisions
in BRIEF6), every deferred feature gets built with its data, functions, rules and admin UI.

Inputs (read your area's audit fully; every numbered gap is in scope unless this file says otherwise):
- Audits: `<N>\vidrio-auditoria-inicio.md` (63 gaps), `<N>\vidrio-auditoria-partidos.md` (48 + F1–F12),
  `<N>\vidrio-auditoria-vivo.md` (45). Shots referenced inside them.
- Boards and design: `<S>\canvas\project\V-*.dc.html`, `v-kit.css`, generators `<S>\v4-a|b|c\`, renders
  `<S>\canvas\shots\v41\`, briefs `<S>\canvas\PLAN-V.md`, `BRIEF5.md`, `BRIEF6.md`.
- Build plan and rules: `docs\superpowers\plans\2026-10-19-vidrio-implementacion.md` («User decisions», «Process and
  rules for every phase agent» still bind everyone).
`<S>` = `C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario-Desktop-Development-Manchester-Piti\7c3c14ba-f6f0-49e6-9940-bc1490e6cf7c\scratchpad`
`<N>` = `C:\Users\Usuario\AppData\Roaming\Claude\side-session-notes\local_23bd2771-61b8-48b2-a15c-d837368a8899`

## Decisions (the lead's, so nobody waits)
- Boards win on chrome: nav labels «Inicio · Partidos · Plantilla · Números · Club» (update e2e that assert «El club»
  / «Estadísticas»); the signed-in member gets the avatar («J Jordi») in the top bar instead of the «Vestuario» button
  (the avatar opens the «Tú» sheet; fans get «Entrar»); the phone/tablet tab bar = the boards' 5 labelled items; the
  theme toggle moves into the avatar/«Tú» sheet (fans: keep a small toggle where the board leaves room, else in the
  footer); header search per boards; footer per boards.
- MVP privacy: while a vote is open, nothing public may reveal per-candidate counts. `mvpResults/{id}` holds only
  `{ total, eligible, open: true }` until `voteClosesAt`; then `{ counts, total, eligible, open: false }`. The bundle and
  SSR follow. «N de M votos» is turnout only.
- Cromos/album: use the existing cromos feature's definition (PR #83 era code: find it); if it has no «owned» notion,
  a member owns the cromo of every teammate he has played a match with (derived, no new data).
- Other pages (Plantilla, Números/Estadísticas, Club, the match page, Perfil, Vestuario): bring them into the Vidrio
  material and live behaviour exactly as V-Integracion and V-Vivo show (light field, glass where touched, Mona Sans,
  their live adaptations, the match page landing). Not a full redesign beyond what those boards show.
- No live reactions (user decision). No pulse line on the capsule.

## Data contracts (B1 builds them; B2–B5 code against them — names are fixed)
1. MVP: `mvpResults/{matchId}` as above; `useMvpResults()` entries gain `eligible?: number`, `open?: boolean`. Trigger
   `tallyMvp` writes the open shape; a scheduled function `closeMvpVotes` (every 10 min, scheduler region
   europe-west1 since Cloud Scheduler isn't in Madrid; functions stay in europe-southwest1) publishes counts once
   closed (idempotent). `eligible` = members who played (ledger) or the rule tallyMvp already uses.
2. Who scores at la mesa: `matches/{id}.mesa?: { name: string; since: number }` (public; the scorer's shirt name or
   nickname), written by the backend when la mesa starts the clock or the scorer is assigned. Client:
   `mesaLine(match)` → «Lo anota Jorge desde la mesa».
3. Postponement: `matches/{id}.postponedReason?: string` (≤ 140), `postponedTo?: Timestamp | null`; admin fields in the
   match workspace (Encuentro) + publishSheet/schema + push topic «fechas» («Nueva fecha: …») + .ics update.
4. Push presets: `pushSubscriptions/{id}.preset?: "goles" | "todo" | "nada"`, `vibrate?: boolean`; callable
   `pushSetPreset({ endpoint, preset, vibrate })`; client `setPushPreset(preset, vibrate)` + `usePushPreset()` in
   `src/lib/push*` (find the existing push client); new topic `cards` covered by «todo»; `sendTo` honours preset;
   `public/push-sw.js` honours `vibrate` and notification `actions` (`open` → the match, `solo-goles` → preset goles).
   Goal notification copy: title «¡Gol de Adrián T.C.!», body «Pase de Jordi. Piti 2, Orduña fc 1.», actions «Abrir el
   partido», «Solo goles».
5. Turnos: member marks his own turn done: field `rotaTurns/{id}.done?: { [uid]: number }` with a rule allowing a
   member to set only his own key when he is assigned (or a callable `markTurnDone({ turnId })` if the rules can't
   express it safely). Client `markTurnDone(me, turnId)` in `src/pages/vestuario/writes.ts`.
6. Caja: `cajaClaims/{id}` `{ uid, playerId, concept, amount, at, status: "pendiente"|"confirmado"|"rechazado" }`;
   member creates his own (pendiente), admins update; notice to admins; admin confirm/reject in La caja. Client
   `claimPayment(me, { concept, amount })`, `useMyCajaClaims(uid)`.
7. Standings form: rows gain `form?: ("G"|"E"|"P")[]` (oldest → newest, max 5); admin standings editor gets the 5
   inputs; StandingRow type + mapper.
8. Weather: `matches/{id}.weatherAtKickoff?: { temp, label, sky, cloud, rain }` stamped when the acta is published
   (function); client `useMatchWeatherHourly(match, now)` in `src/lib/weather.ts` (Open-Meteo hourly, kick-off −1 h to
   +2 h, cached like the existing one).
9. Badging: client-only `useScoreBadge()` (navigator.setAppBadge with our goals while live; clear after) — B4.
Rules changes come with emulator rule tests (`pnpm test:rules`); functions with their unit tests (functions/test).

## Branches and ownership (worktrees; the lead merges; never push)
- **B1 backend** `feat/vidrio-datos-nuevos`: functions/**, firestore.rules (+ rules tests), public/push-sw.js, the
  push client lib, writes.ts/live.ts hooks for the contracts, admin UI for postponement / caja claims / standings
  form, types and mappers, bundle/SSR shape. FIRST: commit the client-facing contract (types, hooks, write helpers
  with TODO-free implementations against the rules) as early as possible and tell the lead; then functions.
- **B2 Inicio** `feat/vidrio-inicio-cierre`: src/pages/home/**, src/styles/inicio.css, Inicio parts of the kit only via
  additive commits. All 63 gaps.
- **B3 Partidos** `feat/vidrio-partidos-cierre`: src/pages/partidos/**, src/styles/partidos-vidrio.css. All 48 gaps +
  F-specs on the UI side.
- **B4 live + chrome** `feat/vidrio-vivo-cierre`: src/components/vidrio/** (kit and live), src/components/celeste/
  Chrome.tsx (+ search, bell, avatar «Tú» sheet), src/styles/vidrio/**, RootLayout, e2e chrome assertions. The vivo
  audit's gaps on the float, sheet, PiP, goal moment, transitions between pages (lens → float morph across routes),
  search, bell, «Tú» sheet, «Avisos a medida» UI, lock-screen notification UI side, badge.
- **B5 other pages** `feat/vidrio-paginas`: src/pages/squad/**, src/pages/stats/**, src/pages/club/**,
  src/pages/match/** (landing + live per V-Vivo/V-Integracion), src/pages/perfil/**, src/pages/vestuario/** (not
  writes.ts/live.ts — B1 owns those). The vivo audit's page-adaptation gaps.
Shared files: if you must touch a file another branch owns, keep it minimal, in a separate commit, and say so.
Merge order: B1 (contracts) as soon as ready → the lead tells B2–B5 → they `git merge main` and wire the features.
Until then B2–B5 do every gap that doesn't need new data.

## Verification per branch (definition of done)
Lint, tests, build via heavy.mjs (placeholder VITE_FIREBASE_* env in the shell; never create .env); B1 also
`pnpm test:rules` and functions tests via heavy.mjs; renders only via shoot-phase.mjs / shoot-url.mjs (one Chromium at
a time; the dev server for main is http://localhost:3102 — use your own dev server for your worktree on your port:
B2 3131, B3 3132, B4 3133, B5 3134; emulators demo-piti-design are running; never touch production). Compare with the
boards side by side for every gap you close and list each gap number as closed with its shot. Report: gaps closed
(numbers), anything not closed and why, commits, files.
