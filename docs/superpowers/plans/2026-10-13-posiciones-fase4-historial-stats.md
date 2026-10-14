# Posiciones · Fase 4 — historial automático y estadísticas por posición y por sistema — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Every published acta records where each player actually played («Ha jugado de»: minutes per exact position, plus his goals, assists and cards per position) and which system the team used. The web shows it: the player's ficha and page, the stats page («Por posición», «Por sistema»), the perfil, the admin's proposal review, the club page and the constellation. Past matches get the same data from a backfill script.

**Architecture:** Pure logic in `functions/src` shared with the web (the Phase 1 pattern: `src/lib/x.ts` re-exports `functions/src/x.ts`).
- `positionsPlayed.ts` post-processes the ledger that `calculateLedger` already builds. It does not change `calculateLedger`.
  - Each stint gets a code: a starter's stint from minute 0 takes his board slot's code. A stint that starts with an exchange «in» inherits the code the outgoing player held at that minute.
  - Each goal, assist and card is assigned to the code of the stint that contains its minute.
- `saveMatchSheet` reads the match's official board, computes this data, and stores it in each participation and on the match (`system`).
- The web aggregates it in `src/lib/positionStats.ts` and renders it in the existing screens, in their own visual language.

**Spec:** `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md`:
- §3 «Historial: positionsPlayed» and «Estadísticas»;
- §4 «Mapa de posiciones · Historial» and the Integración table;
- §5 phase 4.

**Real screens studied (emulator, 2026-10-13):**
- **/stats.** The hero with «La carrera del pichichi». Tabs: Resumen · Jugadores · Análisis del juego · Minutos · Rivales · Comparar · Explorar.
  - Resumen has the KPI grid, then `st-card` sections: «Rendimiento del equipo», «La constelación» (placed by line) and «El reloj de goles».
- **/jugadores/:id.** The hero plus the shirt card, «El juego en detalle», then `st-card` sections: Sus números, Su radar, Su ADN, Su reloj de goles, Su constelación, Sus medallas, Sus últimos encuentros, Temporada a temporada, Sus cambios.
- **/plantilla FichaModal.** The shirt on the left. Tabs «Ficha» and «Temporada 2026/27» with a 4-column number grid. Actions: «Ficha completa», «Cara a cara», «Compartir».
- **/profile «Temporada».** Sections with a yellow bar heading and subtitle: «Tus números», «Gol a gol», «Tu socio en el campo», «Tus cosas en el vestuario».

## Global Constraints
- Phase 3 constraints apply: pnpm, no `any`, Spanish copy, never colour alone, `prefers-reduced-motion`, `git add <files>`, no browsers/WebGL from agents, never touch `.claude/launch.json` or `.impeccable/*`.
- Each new class lives in its own screen's stylesheet:
  - stats `src/styles/stats*.css` or the stylesheet the stats page already imports;
  - jugador: the stylesheet its sections use;
  - squad: the FichaModal stylesheet;
  - perfil: `src/styles/perfil-app.css`;
  - the shared map: `src/styles/posiciones.css` with prefix `pos-`.

  Never restyle existing classes beyond what a task names.
- Data shape (stored by the server, read publicly). Each participation in `matches/{id}.ledger[pid]` gains:
  - `positionsPlayed?: Partial<Record<PosCode, number>>`: minutes, rounded to 2 decimals, only codes with > 0;
  - `positionEvents?: Partial<Record<PosCode, { goals: number; assists: number; yellowCards: number; redCards: number }>>`: only codes with at least one event;
  - `positionsEstimated?: true`: any of his minutes came from his `positions.main` instead of an official board.

  The match gains `system?: string | null`: a `SYSTEM_IDS` id, `"libre"` for a free-mode board, or null without an official board.
  - The keys are added to the `Participation` interface in `functions/src/matchEngine.ts` as optional.
  - `calculateLedger` does not fill them.
  - `contribute()` (season totals) ignores them already, because it only sums numbers.
- **Official board for a match:**
  - Use the match-bound official only. This is the spec: «lineups con matchId + oficial».
  - First try `lineupOfficials/{seasonId}__{matchId}`, and use its `lineupId` when that doc `isOfficial` and has the same `matchId`.
  - Otherwise use the newest `lineups` doc where `seasonId == X`, `isOfficial == true` and `matchId == id`.
  - A season-wide official does not count.
- **Codes:**
  - A starter on the board takes the code of his slot (`boardSlotCodes`).
  - A starter missing from the board, and every starter when there is no board, takes his `positions.main` and marks `positionsEstimated`.
  - A starter without a main gets no code, and his minutes are not attributed.
  - A substitute inherits the code of the player he replaced at that minute; he inherits `estimated` too. If that player had no code, the substitute takes his own main, which is estimated.
- **Copy:**
  - Minutes are written «320′» (U+2032).
  - A position is written «Pivote (MCD)» at least once per view, then the code.
  - «estimado» is said in words, never shown by colour only.
  - Empty states are explicit: «Aún sin minutos con posición» and «Sin pizarra oficial: posición estimada por su preferida».

## Review Focus
1. **Old matches and missing data.** A ledger without the new keys, a player without positions, and a match without a board must all render without crashing. The empty states must be clear, and nothing may show «0′» rows.
2. **Rolling substitutions.** A player who goes off and comes back, a red card (his slot is never refilled), a substitute who enters for a substitute, a card shown on the bench (no code), and an own goal (not counted as a goal) must all be correct.
3. **Totals agree.** For each player, Σ`positionsPlayed` equals his `minutes` (±0.02) whenever every stint has a code. Σ goals and assists by position equal the ledger's goals and assists when every event falls in a coded stint.
4. **Season filter.** Every new view respects the season selector («Todo el historial» or one season). «Por sistema» counts only finished matches with `system`, and says how many had no official board.
5. **Layout.** Phone 390 and desktop 1440 with no overlap. The map's history dots keep ≥ 24 px labels readable.

---

### Task 1: shared formations + board codes + positionsPlayed (pure)
**Files:**
- Create `functions/src/formations.ts`, by moving the whole content of `src/lib/formations.ts`. Change its import to `./positions`.
- Make `src/lib/formations.ts` read `export * from "../../functions/src/formations";`.
- Create `functions/src/boardCodes.ts`.
- Create `functions/src/positionsPlayed.ts`.
- Modify `functions/src/matchEngine.ts`, adding the optional Participation keys from Global Constraints.
- Modify `src/pages/pizarra/v2/encaje.ts`, so that `slotCode` delegates.
- Tests: `src/lib/boardCodes.test.ts` and `src/lib/positionsPlayed.test.ts`, which import `../../functions/src/...` like `migratePositions.test.ts` does.

**Produces:**
```ts
// boardCodes.ts
export interface BoardLike { formation?: unknown; freeMode?: unknown; slots?: { playerId?: string | null; x?: number; y?: number }[] }
export function boardSlotCodes(b: BoardLike): PosCode[]            // 7 codes; port of encaje.slotCode incl. free mode (slotZone bands v>=62 DEF, v>=36 MED, else DEL; nearest POSITIONS point of that line by planeDist2 (u diff, v diff ×1.42)); unknown formation → "2-3-1"
export function boardCodeByPlayer(b: BoardLike): Record<string, PosCode>   // playerId → code of his slot
export function boardSystem(b: BoardLike): string                  // "libre" when freeMode, else the formation id (unknown → "2-3-1")
// positionsPlayed.ts
export interface PositionEvents { goals: number; assists: number; yellowCards: number; redCards: number }
export interface PositionsRow { positionsPlayed: Partial<Record<PosCode, number>>; positionEvents: Partial<Record<PosCode, PositionEvents>>; positionsEstimated: boolean }
export function positionsPlayed(
  ledger: Record<string, Pick<Participation, "started" | "stints" | "exchanges">>,
  events: Pick<MatchEvent, "type" | "playerId" | "assistPlayerId" | "minute" | "elapsedSeconds">[],
  codes: { board: Record<string, PosCode> | null; main: Record<string, PosCode | null> },
): Record<string, PositionsRow>            // only players with ≥1 coded stint
```
- `encaje.slotCode(L, i)` becomes `boardSlotCodes(L)[i] ?? "MC"`. All existing pizarra tests must keep passing unchanged.
- **Event minutes.** Use `elapsedSeconds / 60` when present, else `minute`, which is what `calculateLedger` uses.
  - A stint contains t when `from ≤ t < to`. At t equal to the match's end, the last stint is the one with `to === t`.
  - Goals are `goal`, `goal_penalty` and `goal_freekick`. They are never `own_goal`.
  - Assists are `assistPlayerId` on those goals, plus `assist` events by `playerId`.
  - `yellow_card` adds 1 yellow. `double_yellow` adds 1 yellow and 1 red. `red_card` adds 1 red.
  - An event that falls in no coded stint is not attributed. This covers a card on the bench, for example.
- **Exchanges.** A stint whose `from > 0` (or that does not belong to a starter) is matched to that player's exchange with `direction: "in"` and `minute === from`. Its code is the code of the `with` player's stint that ends at `from`.
  - Process stints in time order, so that chains resolve: a substitute for a substitute.
- **Tests (write first).** They are built from `calculateLedger` on small sheets, so the stints and exchanges are real.
  - A full match with a board.
  - No board, with mains, so it is estimated.
  - A starter not on the board.
  - Sub chain A→B→C.
  - Rolling: A off at 20 for B, A back at 40 for C, so A takes C's code.
  - A red card at 30 with no refill.
  - A card on the bench.
  - A goal plus assist split across two positions.
  - `double_yellow`.
  - `own_goal` ignored.
  - Σminutes equals the ledger's minutes.
  - A player without a main and no board, who gets no row.
  - `boardSlotCodes` for 2-3-1, for 1-3-1-1, and for free mode near LD and near DC.

Commit: `feat(posiciones): ha jugado de — minutos y acciones por posición desde el acta`

### Task 2: saveMatchSheet stores it + backfill script
**Files:**
- `functions/src/index.ts` (saveMatchSheet).
- Create `functions/scripts/backfill-positions-played.mjs`.
- `functions/src/positionsPlayed.ts`, adding a pure `backfillPatch` helper.
- `functions/test/club.integration.mjs`.
- `src/lib/positionsPlayed.test.ts`.

**saveMatchSheet:**
- When `sheet.status === "finished"`, read the official board with the lookup from Global Constraints, using the admin SDK, before the transaction.
- Build `main` from the `players` docs it already fetches (`positions.main` when it `isPosCode`).
- Call `positionsPlayed(ledger.players, sheet.events, {board, main})`. Merge each row into `ledger.players[pid]`, omitting empty maps and `positionsEstimated` when false.
- Set `system: board ? boardSystem(board) : null` on the match doc it writes.
- A board read failure must never block publishing: catch it, log it, and treat it as no board.
- **Integration test.** Add it next to the existing saveMatchSheet assertions (`club.integration.mjs` ~212-333 and 729-769).
  - Create an official board for the match directly (`db.doc("lineups/"+id).set(...)`, then `update({isOfficial:true, matchId})`, as at ~389-396). Also create its `lineupOfficials` doc.
  - Publish an acta with one substitution and one goal.
  - Assert `ledger[pid].positionsPlayed`, `positionEvents` and `match.system`.
  - Republish without a board, and assert `positionsEstimated: true` and `system: null`.

**Backfill script.** It is modelled on `functions/scripts/migrate-positions.mjs`. Read it and copy its guards.
- It defaults to the emulator and dry-run. `--write` applies; `--prod` targets production and is refused when `FIRESTORE_EMULATOR_HOST` is set. It prints the effective target.
- For each finished match it:
  - finds the official board with the same lookup;
  - takes mains from `players/*`;
  - calls the pure `backfillPatch(match, board, mains)`.
- `backfillPatch` returns `{ "ledger.<pid>.positionsPlayed": …, "ledger.<pid>.positionEvents": …, "ledger.<pid>.positionsEstimated": … (FieldValue.delete() when false — represent as null in the pure result and map in the script), system }`, or null when nothing changes. That makes it idempotent.
- It writes with a BulkWriter and a `lastUpdateTime` precondition per doc.
- It prints counts: `con pizarra`, `estimados`, `sin datos`, `sin cambios`, `escritos`, `no confirmados`.
- It exits 1 with «vuelve a lanzarla» when any write is not confirmed. It calls `db.terminate()` at the end.

Commit: `feat(posiciones): el acta guarda dónde jugó cada uno y el sistema; script de relleno`

### Task 3: web aggregation (pure)
**Files:** create `src/lib/positionStats.ts` and `src/lib/positionStats.test.ts`. Modify `src/lib/statsView.ts` (constellation) and its test.

**Produces:**
```ts
export interface PosLine { code: PosCode; minutes: number; matches: number; goals: number; assists: number; yellowCards: number; redCards: number; rating: number | null }
export interface PlayerPositions { lines: PosLine[] /* by minutes desc */; minutes: number; estimatedMatches: number; matches: number; top: PosCode | null }
export function playerPositions(pid: string, games: ClubMatch[]): PlayerPositions
export function playedSummary(p: PlayerPositions, max = 3): string   // «Pivote (MCD) 320′ · MC 140′ · DFC 20′» — first with long name
export interface ClubPosLine { code: PosCode; minutes: number; owner: { id: string; minutes: number } | null; players: number; goals: number; assists: number }
export function clubPositions(games: ClubMatch[]): ClubPosLine[]      // all 13 codes, catalogue order
export interface SystemLine { id: string; label: string; name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; ppg: number }
export function systemRecord(games: ClubMatch[]): { lines: SystemLine[] /* played desc, ppg desc */; withoutBoard: number }
```
- `matches` counts each match once per code where the player had > 0 minutes.
- **Rating ruling.** `rating` is the average of the existing per-match form rating over the matches where that code was his most-played code. Use the same per-match number the pizarra `formRating` uses. Read `src/pages/pizarra/v2/ratings.ts` and reuse its exported per-game helper; if none is exported, export the smallest one. It is null with fewer than 2 such matches.
- Only finished matches with a ledger count. Each `ClubMatch` result comes from `goalsFor` and `goalsAgainst`. `"libre"` gets label «Libre» and name «Sin sistema fijo».
- **Constellation.** A node's spot is the player's `top` code from `playerPositions` when it is known, else his preferida `resolvePositions(p).main`, else his line as today.
  - Map `POSITIONS[code].x/y` onto the sky. Keep today's coordinate space: `y` maps the catalogue's v (0 = rival goal) the way `ZONE_Y` does today, so DC sits near 18 and POR near 90.
  - Nudge coincident nodes apart deterministically.
  - The function signature gains `games` and must stay backward compatible for its callers.
- **Tests.** Old ledgers without keys give empty lines. Estimated matches are counted. Ratings are null below 2 matches. `systemRecord` handles W/D/L, points (3/1/0) and `withoutBoard`. `clubPositions` picks the owner by minutes and breaks ties by name. Constellation nodes follow the codes.

Commit: `feat(estadisticas): agregados por posición y por sistema`

### Task 4: the map's history mode + FichaModal «Posiciones» tab + JugadorPage «Sus posiciones»
**Files:**
- `src/components/posiciones/MapaPosiciones.tsx` and `src/styles/posiciones.css`, plus their test.
- `src/pages/squad/FichaModal.tsx`, its test and its CSS.
- `src/pages/squad/SquadPage.tsx` (pass games), if needed.
- `src/pages/jugador/JugadorPage.tsx` and its CSS.

**MapaPosiciones history mode:**
- New optional prop `played?: Partial<Record<PosCode, number>>`, read-only.
- Each spot with minutes is a filled disc sized by √(minutes / max) between 28 and 52 px at size m, labelled with the code and «320′» under it.
- The preferida keeps its ★ and the también entries their ✓, together with the minutes.
- Spots without minutes stay dim.
- The text summary becomes `playedSummary`.
- New optional `estimated?: boolean`, which adds an «estimado» tag under the pitch, worded «Algunos minutos estimados por su posición preferida».
- Never colour alone.

**FichaModal:**
- A third tab «Posiciones» (keyboard and ARIA as the existing tabs).
- It holds the map at size m with `value` = his positions and `played` from `playerPositions(pid, games)` for the season the modal shows.
- Under it, a compact table: Posición · Min · PJ · G · A, at most 5 rows.
- Empty state: «Aún sin minutos con posición».
- Keep the modal height stable when switching tabs. Check the existing CSS for how «Temporada» does it.

**JugadorPage:**
- A new `st-card` section «Sus posiciones», after «Su ADN».
- On the left, the map in history mode. On the right, the per-position table with Valoración, shown «—» when null, and the line «Más minutos de Pivote (MCD): 320′ en 6 partidos».
- It respects the page's season selector.

Commit: `feat(plantilla): ha jugado de — el mapa con minutos en la ficha y en su página`

### Task 5: stats page «Posiciones» tab
**Files:**
- `src/router.tsx`: add `"positions"` to the stats `view` enum.
- `src/pages/stats/StatsPage.tsx`: tab label «Posiciones», placed after «Minutos».
- `src/pages/stats/Panes.tsx`, or a new `src/pages/stats/Posiciones.tsx`.
- Stats CSS and tests.

**«Por posición»** (`st-card`):
- A big vertical F7 pitch with the 13 spots from `clubPositions`. Each spot shows its code, its total minutes and «el dueño» (the player with most minutes there, first name). The spot size encodes minutes. Never colour alone: the numbers are printed.
- A sortable table under it, or beside it on desktop: Posición · Min · Jugadores · G · A · Dueño.
- Clicking a spot or row highlights it (`aria-pressed`) and lists that code's players with their minutes.

**«Por sistema»** (`st-card`):
- One row per system played: a mini pitch of the system (reuse the pizarra's mini-system drawing if it is importable without pulling the pizarra bundle; otherwise draw the 7 spots from `systemDef` as a small SVG), «2-3-1 · Clásico», PJ, G-E-P as text, GF:GC and pts/partido.
- The best ppg with ≥ 2 played gets a «Mejor sistema» tag in text.
- Footer: «N partidos sin pizarra oficial no cuentan aquí».
- Empty: «Aún no hay partidos con pizarra oficial».

The Resumen constellation uses the new placement from Task 3; pass `games`.

Commit: `feat(estadisticas): pestaña posiciones — por posición y por sistema`

### Task 6: perfil «Dónde has jugado», admin review evidence, club page
**Files:**
- `src/pages/perfil/TabTemporada.tsx` (or the section components it uses), `profileData.ts` / `useProfileData.ts` if games are not already reachable, and `perfil-app.css`.
- `src/pages/admin/views/Plantilla.tsx` (proposal banner) and/or `src/pages/admin/club/FichaWorkspace.tsx`, `plantilla.css`.
- `src/pages/club/ClubPage.tsx` and its CSS.
- Tests next to each.

**Perfil «Temporada».** A new section after «Tus números», in the same section language:
- Heading «DÓNDE HAS JUGADO», subtitle «Minutos por posición esta temporada.»
- The map in history mode at size m, then the one-line `playedSummary`.
- A gentle nudge when his most-played code is neither his preferida nor in también: «Has jugado más de MI que de lo que tienes puesto. ¿Lo añades en Tus posiciones?». It links to the «Tu carta» positions section.
- Only for a linked player.

**Admin.**
- In the proposal banner and in the ficha's positions block, add a line «Ha jugado de: MC 320′ · MCD 140′», or «Sin minutos con posición». This gives the captain evidence before approving.
- The data source is all seasons' games already in admin data; if they are not loaded there, use the club data hook.

**Club page.** A new `cl-sec` «La plantilla por posiciones», placed after «El club en números»:
- A small pitch with, per code, the number of active players whose preferida is that code, and the number who list it in también. For example «MC 3 · +2».
- A line for «Sin posición: N».
- Club page language: headings, spacing.

Commit: `feat(posiciones): dónde has jugado en tu perfil, pruebas para el capitán y la plantilla por posiciones`

### Task 7 (controller)
- Seed an official board for the emulator's played match (a scratch script).
- Run the backfill on the emulator: dry-run, then `--write`, then a re-run that plans 0.
- Shoot at 1440 and 390: /stats?view=positions, /jugadores/preview-player-3, the FichaModal «Posiciones» tab, /profile Temporada, the admin plantilla proposal, /club.
- Run lint, unit tests, rules tests, the functions integration test, the e2e for squad, perfil and admin, and the build.
- Do the whole-branch review.
- Roll out: PR, functions deploy, merge, prod backfill (dry-run then write), smoke test, report.
