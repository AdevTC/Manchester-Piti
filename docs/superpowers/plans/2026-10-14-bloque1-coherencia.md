# Bloque 1 — coherencia y errores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Fix the bugs found in the audit, and give every concept one source so the pages stop contradicting each other: listener collision, the season selector, the match that never starts, the false «¡GOL!», the jornada, the result letters, minutes, names, ratings, exact positions in Convocar, El club in the dock, the match tab in the URL, stale «nuevo» badges and admin typography.

**Source of truth:**
- Audit reports in `docs/auditoria/`. Finding ids (H1, N1…) refer to `2026-10-14-sync-tiempo-real.md` and `2026-10-14-integracion-y-huecos.md`. Read the finding before each task; it has the evidence file:line.
- User decisions (2026-10-14) in `docs/auditoria/2026-10-14-auditoria-web.md`. Result letters are **G · E · P** everywhere.

## Global Constraints
- pnpm, TypeScript without `any`, Spanish copy, never colour alone, `prefers-reduced-motion`, `git add <files>` only. Never touch `.claude/launch.json` or `.impeccable/*`. No new dependencies.
- No browsers or WebGL from agents. **Never run anything against production**, and no `--prod`.
- Each shared derivation lives in `src/lib/derived/` (new folder, one file per concept, each with tests). Server code that needs the same rule imports it from `functions/src` (the posiciones pattern: `src/lib/x.ts` re-exports `functions/src/x.ts`) when the functions use it.
- Keep each page's look. Change only what the task names.
- Verification per task: `pnpm lint`, `pnpm test`, `pnpm exec tsc -b`. Functions tasks also need `cd functions && npm run build`. Their integration tests need the emulators; the controller runs them if they're down.

## Review Focus
1. Same input, same output across pages. Parity tests cover jornada, result letter, minutes, name and rating, with one fixture rendered or derived through each consumer.
2. Nothing old breaks:
   - legacy actas without a ledger;
   - matches without a clock;
   - cancelled or draft matches;
   - the «all seasons» selection.
3. Match day: a scorer can score, the clock and push agree, and no false celebration plays on load.
4. URLs: a deep link opens the right match tab or season, and back and forward work.
5. Phone 390: the dock still fits with the club added, and nothing overlaps.

---

### Task 1: H1 — one live doc per path, mapped per reader
**Files:** `src/pages/vestuario/live.ts` and its test.
- Replace the two `useLiveDoc` calls on `matchPrivate/{id}` with one `useMatchPrivate(id)`. It maps the whole doc to `{ meetingNote: string, scorerUids: string[] }`.
- Keep `useMeetingNote` and `useMatchScorers` as thin selectors over it, with the same return shapes as today.
- Make the registry key include a mapper id: `useLiveDoc(path, mapId, map, empty)`, key `doc:${path}#${mapId}`. Add a dev-only assertion: the same key started twice with different mapper ids → `console.error`.
- Test: mount both hooks on the same id, in either order. Each must get its own shape.

Commit: `fix(vestuario): la quedada y los anotadores ya no comparten escucha`

### Task 2: H2/N1 — the /partidos season selector navigates
**Files:** `src/pages/partidos/PartidosPage.tsx` and a test.
- Change the season the same way Stats does, with `navigate({ to: ".", search: (p) => ({ ...p, season: id }) })`.
- Make `setSelectedSeasonId` unreachable from pages, or document that it must not be called from pages. Prefer moving the setter behind `SeasonUrlSync` / a `useSetSeason()` that navigates. Check every caller with grep.
- Test: two consecutive changes, including «Todas», both stick.
- Label «all seasons» as «Todo el historial» on every page (C6 label only; ordering stays).

Commit: `fix(partidos): el selector de temporada ya no vuelve atrás`

### Task 3: H3 — «pendiente del pitido» everywhere, and push follows the clock
**Files:**
- `functions/src/matchEngine.ts`: add `kickoffState(match, now)` returning `"scheduled" | "pending_whistle" | "live" | "halftime" | "ended" | "awaiting_result"`.
- Its consumers: `src/lib/partidos.ts`, `home/MatchHero.tsx`, `match/MatchPage.tsx`, `partidos/PartidosPage.tsx`, `components/celeste/LiveIsland.tsx` (or where it lives).
- `functions/src/push.ts` and `functions/src/pushLogic.ts`, plus tests.

**States:**
- `pending_whistle` = date ≤ now and the clock is `ready`.
- `awaiting_result` = a ready clock after date + duration + 2 h. The match is no longer «next» anywhere: `nextFixture` and its equivalents skip it.

**Copy and display:**
- Pending, on every surface: «Pendiente del pitido inicial». Show no zero countdown.
- Awaiting result: «Pendiente del acta».

**Push:**
- Send the «¡Empieza el partido!» push when `pushOnMatch` sees `clock.phase` go `ready → first`.
- `pushKickoff` keeps sending only for legacy matches without `clock`.
- Tests: pushLogic transitions, and `kickoffState` over the timeline.

Commit: `fix(partidos): un partido sin pitido no se queda en 00:00 y el aviso sale con el reloj`

### Task 4: M1 — no celebration for old goals
**Files:** `GoalBurst.tsx` (and any `Flip` score animation on the island and board), tests.
- Celebrate only goal events whose time is within 120 s of the live clock reading (`clockReading`/`liveMinute`), or that arrive after the component has been mounted for at least one server round (track the ids seen at mount and celebrate only new ids whose time is recent).
- Never celebrate on first render.
- Test: mounting with a goal already in the data → no burst. Adding a fresh goal → burst. Adding an old goal (from a late sync) → no burst.

Commit: `fix(directo): sin «¡GOL!» falsos al abrir el partido`

### Task 5: one jornada, one result letter, one minute format
**Files:** create `src/lib/derived/jornada.ts`, `result.ts`, `minutes.ts` (+ tests); replace the copies listed in C1 (`lib/partidos.ts:52,72`, `admin/data/adminLogic.ts:63-69`, `pizarra/v2/useBoardData.ts:55-70`), C2 (7 copies: `lib/home.ts:12`, `lib/partidos.ts:8`, `home/Sections.tsx:7`, `admin/kit/result.ts:2`, `adminLogic.ts:391`, `seasonsLogic.ts:120`, `JugadorPage.tsx:34`, `stats/Charts.tsx:10`, `pizarra/v2/boards.ts:122`, `perfil/card.ts:85` — grep for more), C4 (`JugadorPage.tsx:134,188` and any raw minutes print); `DESIGN.md` (result letters rule → G·E·P); push copy if it prints a jornada.
- `jornadaOf(matches, matchId)` / `jornadas(matches, seasonId)`: published (not draft), not cancelled, ordered by date, numbered per season; with «all seasons» the number is still the match's number within its own season. Admin drafts get no number («sin jornada» / «borrador») until published.
- `resultLetter(gf, ga)` → "G" | "E" | "P"; `RESULT_WORD` {G: "victoria", E: "empate", P: "derrota"}; legends say «G victoria · E empate · P derrota».
- `fmtMinutes(n)` → integer + «′» (Math.round); nowhere prints decimals.
- Parity test: one fixture season (incl. a cancelled match and a draft) → same J numbers via public, admin and pizarra helpers.
Commit: `refactor(coherencia): una jornada, una letra de resultado (G·E·P) y minutos enteros`

### Task 6: one player name, one minutes rule, one rating rule
**Files:** create `src/lib/derived/names.ts` and `src/lib/derived/minutesOf.ts`, with tests. Callers per C5 (`clubData.playerName`, `squad.ts:97`, `statsView.ts:16`, `stats/Panes.tsx:363`, `detailQueries.ts:51`, admin `EnJuego.tsx:30` and `Hoy.tsx:81`, MatchPage, Partidos, LiveIsland, Tabs). Callers per M5: `clubAnalytics.ts:113-122`, `statsView.ts:196`, `pizarra/v2/ratings.ts:84,137`, and every `playerPositions` caller.

**Name:**
- `nameFor(player, seasonId?)` is the only name API: the season's shirt name, then shirtName, then first + last, then «Jugador».
- Match pages pass `match.seasonId`. Keep `playerName` as a deprecated alias that calls `nameFor`, or replace it everywhere.

**Minutes:**
- `minutesOf(match, pid)`: ledger minutes when the ledger has a row for the player.
- Legacy acta with no ledger at all: the duration if he started, else 0.
- Every page (stats, jugador, perfil card, pizarra, admin cromos) uses it.

**Rating:**
- Every `playerPositions` caller passes `mvpOf` built from `useMvpResults`, through a shared `mvpOfFrom(results)` helper.
- The admin passes published matches only, not drafts.

**Tests:** parity on a fixture through stats, jugador, perfil card and pizarra give the same minutes; and the same rating for the same player and code.

Commit: `refactor(coherencia): un nombre, una regla de minutos y una valoración por puesto`

### Task 7: Convocar by exact position + admin typography
**Files:** `src/pages/admin/views/Convocar.tsx` (and its helpers and test). Find the condensed display face used for headings in the admin («Sin responder», «Rival y fecha», «Pitado el final»…) in the admin CSS, with the selectors, and use the admin's standard heading style. Check the screenshots in the audit for the look.
- Rows print the exact preferida code with its long name on hover or for screen readers: «DFC · en el siete», or the line when the player only has a line, as today. Use `positionText` / `resolvePositions` from `src/lib/positions.ts`.
- The siete strip shows each player's code under the shirt.
- Headings are no longer in the condensed face. Keep sizes and hierarchy.

Commit: `fix(admin): convocar con posición exacta y títulos con la letra de la casa`

### Task 8: El club in the phone dock + match tab in the URL + router leftovers
**Files:** `components/celeste/Chrome.tsx` (DOCK) and its CSS, `router.tsx` (match route `validateSearch` `{ tab }`; remove `plantillaSearchSchema` and the legacy `statsSearchSchema.tab` if unused, after grep), `match/MatchPage.tsx` (tab from the URL with `replace` navigation), `functions/src/pushLogic.ts` (push URLs open the right tab: MVP → `?tab=vestuario`, minutes → `?tab=campo`), and the vestuario MVP and Porra blocks (links to the match with the tab). Tests.

**Dock:**
- Six items: Inicio · Partidos · Vestuario · Estadísticas · Plantilla · Club, with a `club` icon from the existing celeste icons, or a crest/shield if one exists.
- Labels hide at ≤ 380 px as today. Check that the 390 px layout fits (≥ 44 px targets).
- /club lights its item.

**Match tab:**
- The tab is in the URL. Back and forward move between tabs.
- An unknown tab falls back to «crónica».

Commit: `feat(navegacion): el club en el dock y cada pestaña del partido con su enlace`

### Task 9: stale «nuevo» badges
**Files:** every `st-new` / `isNew` / «nuevo» badge (34, per C11), and a tiny `src/lib/derived/isNew.ts`.
- Replace the hard-coded badges with `isNew(releasedAt)`. It shows the badge for 21 days after the feature's release date, given per badge as an ISO date in a single `NEW_FEATURES` map. Features older than 21 days lose the badge today.
- Test the helper with a fixed `now`.

Commit: `chore(diseño): las insignias «nuevo» caducan solas`

### Task 10 (controller)
- Reseed the emulator.
- Shoot at 1440 and 390: home, partidos (including two season changes), match tabs from the URL, stats, jugador, admin convocar, the dock on every page.
- Run lint, the unit tests, the build, the functions integration tests and the e2e (navigation, squad, perfil, admin-crud, pizarra).
- Do the whole-branch review.
- Open the PR, deploy the functions (pushOnMatch, pushKickoff), merge and smoke-test.
