# Bloque 4 — la ficha del partido 2.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** The match page (`/matches/$id`) becomes the definitive place for a match:
- Campo draws the real positions and system played (Phase 4 data).
- The previa has a rival dossier.
- The analysis panel speaks the house language.
- RSVP / porra / MVP / live actions are one shared set of components across the match page, the vestuario and the admin.
- The match poster looks Celeste.
- The tabs are keyboard-complete.

**Source of truth:** `docs/auditoria/2026-10-14-integracion-y-huecos.md` — C3, C7, C8, C12 (feedback), C13, C14, feature idea 12 (rival dossier). Parked items from block 3: the Campo bench chips and the published-acta goal lines still print the stored minute (use `eventMinute`).

## Global Constraints
- Blocks 1–3 constraints apply: pnpm, no `any`, Spanish copy, never colour alone, reduced motion, `git add <files>`, no new deps, no browsers/WebGL from agents, never production.
- Keep the match page's Celeste language: `st-card`, `hm-kick`, `hm-h2`, `fc-*`, `pt-*`. New CSS goes into the stylesheet the match page already imports (or `ficha.css`), with an `fc-` prefix.
- Members-only data stays member-gated (lineups, availability, predictions). Fans see what they see today.
- Reuse block 1 helpers: `nameFor`, `minutesOf`, `jornada*`, `resultLetter` G·E·P, `eventMinute`. Reuse block 2's `PlayerLink`.

## Review Focus
1. **Old matches:** no ledger, no `positionsPlayed`, no `system`, no events, legacy actas. Each falls back to today's view with clear copy, never broken.
2. **Fans vs members:** the right content for each, no permission errors.
3. **Shared components:** the vestuario and the match page behave identically after the extraction (RSVP / porra / MVP writes unchanged).
4. **Phone 390:** pitch, dossier, panels and tabs without overlap; ≥ 44 px targets.
5. **Keyboard:** the tabs follow the ARIA tabs pattern (arrows, Home/End), and the pizarra / FichaModal keep their behaviour.

---

### Task 1: Campo with the real positions and system (C3) + display minutes everywhere
**Files:**
- `src/pages/match/Tabs.tsx` (CampoTab)
- `src/lib/ficha.ts` (F7_SPOTS fallback)
- `src/pages/match/campoSeven.ts`
- `src/components/posiciones/` (reuse the geometry; `POSITIONS[code].x/y` in `src/lib/positions.ts`)
- the match page CSS
- tests

**After the acta, for a match with `positionsPlayed`:**
- Place each starter at his most-played code's point, using `POSITIONS` x/y mapped onto the existing pitch.
- Chain subs inherit a slot: a sub who played a different code than the starter he replaced gets his own dot, styled as a substitute (e.g. a ring).
- Show a chip with the system played («2-3-1 · Clásico», or «Libre»), plus «Posiciones de la pizarra oficial».
- When estimated, say «Posiciones estimadas por su preferida».
- Without positions data, keep today's orientative 1-3-2-1 with its existing «Posiciones orientativas» copy.

**Before the acta:** block 3's official-seven view stays as is. Show the system of the official board when known (members).

**Minutes:** the bench chips and the published-acta goal lines (crónica / acta summary) use `eventMinute` (parked from block 3).

**Tests:** placement by code, estimated copy, fallback, system chip.

**Commit:** `feat(partido): el campo dibuja dónde jugó cada uno y el sistema`

### Task 2: the rival dossier in the previa (idea 12)
**Files:**
- `src/pages/match/Tabs.tsx` (PreviaTab, HeadToHead)
- `src/pages/stats/Rivales` logic (`src/lib/statsView.ts` / `clubAnalytics` rival functions)
- pizarra `v2/RivalPanel.tsx` data (member-only notes)
- tests

**«El rival» section in the previa (and in the crónica as context):**
- **Public facts:**
  - record vs this rival (PJ · G-E-P · GF:GC);
  - last 3 meetings with links;
  - our scorers against them;
  - the biggest win.
- **Members only:** the pizarra RivalPanel notes for this rival, if any. Read them from the official board or the rival data where they live today; check how RivalPanel stores them.

One shared pure function `rivalDossier(matches, rivalName)` feeds both the previa and `stats/Rivales`. Rival-name matching normalised (accents, case) as the stats page already does.

**Tests.**

**Commit:** `feat(partido): la previa trae el dosier del rival`

### Task 3: one set of member actions — RSVP, porra, MVP (C7)
**Files:**
- `src/pages/vestuario/Hero.tsx` and `TeamBlocks.tsx` (Porra, MvpBlock)
- `src/pages/match/Tabs.tsx` (VestuarioTab)
- new shared components in `src/components/celeste/` or `src/pages/vestuario/shared/`: `RsvpSwitch`, `PorraCard`, `MvpBallot` (+ the MVP race from block 3, already shared — keep it)
- tests

**Extraction:**
- Extract the RSVP switch, the porra card (with the scoring rule visible on both) and the MVP ballot into shared components with one prop API.
- The vestuario and the match tab render them, each keeping its layout wrapper.
- Writes stay identical: same hooks (`useWrite` / `useAvailability` / predictions / votes).
- Copy is unified, e.g. the porra scoring rule appears in both places.

**Tests:** each component's behaviour once, and both hosts render it.

**Commit:** `refactor(vestuario): una sola convocatoria, porra y voto MVP en el vestuario y en el partido`

### Task 4: one live-action catalogue for Banda and En juego (C7)
**Files:**
- `src/pages/match/Banda.tsx` (public «Mesa de partido»: 13 actions)
- `src/pages/admin/live/liveModel.ts` (En juego wizard)
- new `src/lib/liveActions.ts`: the catalogue of action types, labels, icons and which need a player / assist / team, plus a pure builder `buildLiveEvent(action, choices, minute)`
- tests

**Behaviour:**
- Both UIs read the catalogue.
- Capability gaps close: Banda gets cards and subs if the admin has them; the admin gets ocasión / córner / palo if Banda has them. Keep each UI's interaction style: Banda quick taps, admin wizard.
- Writes still go through `liveEvent`, with the same payloads.

**Tests:** catalogue parity, and the builder output equals today's payloads for every existing action.

**Commit:** `refactor(directo): un solo catálogo de jugadas para la banda y la sala de control`

### Task 5: the analysis panel in house style (C8)
**Files:**
- `src/components/celeste/TechnicalStats.tsx` and `technical-stats.css` (formatted, readable code)
- its hosts: `MatchPage` (5th tab «Estadísticas») and `JugadorPage` (top of page)
- tests

**Reformat** to the project's style (no minified JSX), using `st-card` / `st-seg`.

**Hide or show:**
- Hide it when the match has no analysis events.
- On the jugador page, move it below the fold, after «Sus números», and hide it when he has no analysis actions.

**Copy:**
- «Piti y rival» → «El Piti y el rival».
- «Cobertura parcial» explained in one short line.
- Names via `PlayerLink`.

**Keep the data and numbers identical; tests.**

**Commit:** `feat(partido): el análisis del juego habla como el resto de la web`

### Task 6: Celeste match poster (C13) + tabs keyboard pattern (C14)
**Files:**
- `src/lib/matchPoster.ts`: redraw with the cartel renderer's look (`pizarra/v2/cartel.ts`, perfil `shareDraw.ts`). Use the Anybody/Geist faces with explicit `document.fonts.load(...)` before drawing, the result in G·E·P, scorers by `nameFor`, and the system played if known.
- The match page tabs (`MatchPage.tsx`): roving tabindex plus ArrowLeft/Right/Home/End, matching perfil / FichaModal (see their implementations).
- Tests: the poster's pure layout values and the font loading call (mock `document.fonts`); keyboard navigation.

**Commit:** `feat(partido): cartel Celeste y pestañas con teclado`

### Task 7 (controller)
- Reseed (including `seed-history.mjs` for positions/systems) and shoot `/matches/hist-1` at 1440 and 390:
  - every tab;
  - Campo with positions;
  - the previa with the dossier (for an upcoming match against a rival with history);
  - the vestuario after the extraction;
  - the poster image (save it from the share button through a test hook, or render the canvas to a PNG in the page).
- lint, unit, build, e2e.
- Whole-branch review, PR, merge.
