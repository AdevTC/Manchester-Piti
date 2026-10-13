# Posiciones · Fase 2a — la pizarra habla por posición exacta (visible) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Inside the LIVE pizarra «FUT» (no new layout), show exact positions and how well each player fits: the cromo prints the slot's exact code, a fit mark sits on its corner, slots light by fit for the player in the hand, the Sistema panel says «n/7 en su sitio» per system with what's missing, and bench rows show the player's preferida + también.

**Architecture:** Pure logic first (`v2/encaje.ts`: slot code, fit at a slot, best assignment of a squad onto a system) on top of `src/lib/positions.ts` (`fitGrade`, `resolvePositions`, `POSITIONS`) and `src/lib/formations.ts` (`systemDef`). Cromo gains its resolved positions. The view layer (`view.ts`, `bench.ts`, `Panels.tsx`) only reads those helpers. Chemistry, auto-place, «Sugerir siete», cambios and familiarity keep their LINE logic in this phase (Fase 2b moves them to grades).

**Spec:** `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md` (§3 Encaje, §4 Pizarra row). Approved direction (2026-10-13, user): integrate into the existing pizarra, keep its FUT language, no new screens; verify with screenshots of the real app.

## Global Constraints
- Same as Phase 1 (`docs/superpowers/plans/2026-10-13-posiciones-fase1-base.md` → Global Constraints) — pnpm, no `any`, Spanish copy, never colour-only, reduced motion, `git add <files>`, no browsers/WebGL from agents.
- Generated `src/styles/pizarra.css` owns short class names (`.cb`, `.sy`, `.ac`, `.best`…): new classes go in `src/styles/pizarra-app.css` with the prefix `pzp-` and must not restyle existing classes beyond what a task names.
- Fit marks (text + shape, never colour alone): grade 3 preferida → no mark (the cromo just prints its code); 2 también → «✓»; 1 adaptado → «~»; 0 fuera → «!»; null (no data) → no mark. Accessible names: «en su posición», «también juega aquí», «adaptado», «fuera de su posición».
- Keep every existing behaviour (drag, hand, swaps, química links, charla, presentación, print, cartel) unchanged except what a task names.

## Review Focus
1. Players with NO positions data (most real players today) must look exactly as now except the code text (slot code instead of line) — no fit mark, no «0/7».
2. Free mode (Libre): slot code = nearest catalogue position; nothing crashes when a slot sits off-pitch.
3. Goalkeeper slot: only declared POR counts; an outfield player in goal shows «!».
4. Phone 390 and 1440: the new text never overlaps (fit mark inside the cromo box; tile text wraps in ≤2 lines).
5. Per-board «Jugar de» overrides (zone values) still work: an override to the slot's line counts as «también».

---

### Task 1: `encaje.ts` — slot code, fit at a slot, best assignment (pure)

**Files:** Create `src/pages/pizarra/v2/encaje.ts`, `src/pages/pizarra/v2/encaje.test.ts`. Modify `src/pages/pizarra/v2/model.ts` (Cromo gains `ps?: ResolvedPositions`), `src/pages/pizarra/v2/ratings.ts` (fill `ps` from the player doc via `resolvePositions`), `src/pages/pizarra/usePizarraPlayers.ts` and `src/pages/perfil/profileData.ts` (carry `positions` through to the squad input type so `ratings` can resolve it).

**Interfaces (Produces):**
```ts
export function slotCode(L: Lineup, i: number): PosCode            // fixed system: FORM label; free mode: nearest POSITIONS point to (slot.x, slot.y) by planeDist2
export function fitAt(L: Lineup, sq: Squad, id: string, i: number): FitGrade | null
  // override L.playerPositions[id] (a Zone today): if set → 2 when it equals lineOf(slotCode) else 0 (goal: override "POR" in slot 0 → 2)
  // else fitGrade(cromo.ps ?? {main:null, also:[], line: cromo.pos ?? null}, slotCode)
export interface Encaje { inPlace: number; grades: (FitGrade | null)[]; ids: (string | null)[]; missing: PosCode[] }
export function bestEncaje(system: FormationName, candidates: string[], sq: Squad): Encaje
  // assign ≤7 candidates to the system's 7 slots maximising Σgrade (null counts as 1), keeper slot only to grade≥2 for POR;
  // inPlace = slots with grade ≥ 2; missing = codes of slots with grade < 2 (or empty), in slot order, deduped.
  // Exact optimum: 7 slots × ≤ 20 candidates → DP over slots with a bitmask of used candidates is too big; use the
  // Hungarian algorithm (n ≤ 20) or a max-weight bipartite matching — write it small and tested.
export function encajeCandidates(L: Lineup, sq: Squad): string[]
  // who is available for the board: on the pitch + bench, minus bajas and cv === "no"
```
**Tests (write first):** slotCode for 2-3-1 (["POR","DFC","DFC","MI","MC","MD","DC"]) and a free slot near LD; fitAt with ps preferida/también/adaptado/fuera/null and with a zone override; bestEncaje on a fixture squad (two keepers, a natural LD, two MCs, a DC…) giving the exact inPlace and missing for 2-3-1 and 2-1-3; keeper never assigned to an outfield-only player when a keeper exists; no-data squad → grades all null and inPlace 0, missing [] (unknown is not «missing»).
Commit: `feat(pizarra): encaje — slot codes, fit at a slot and the best seven per system`

### Task 2: the cromo on the pitch and the hand

**Files:** `src/pages/pizarra/v2/view.ts`, `Board.tsx` (cromo markup only), `src/styles/pizarra-app.css`, tests next to existing view/board tests (`Board.test.tsx` or a new `view.test.ts`).
- `zoneTxt` → the slot's exact code (`slotCode(L,i)`); when the player is out of place keep the existing «nat›slot» pattern but with codes when known (preferida code › slot code).
- New card field `fit: FitGrade | null` and its mark rendered inside the cromo (corner opposite the rating), with `aria-label` per the constraint table; aria text of the cromo gains the fit words.
- `oop` (existing class + aria) becomes `fitAt(...) === 0`; with no data it stays false (as now).
- Hand mode: every target slot (occupied cromos already have `tgt`; also the empty-slot «+ CODE» markers) gets `pzp-g3|g2|g1|g0` for the held player's fit there; the existing `best` stays for the top grade. Bench-in-hand («Entra por él») uses the bench player's fit at each slot.
- Empty slot markers print the slot code (already) — no change besides the hand tint.
Tests: view output for a fixture board: zoneTxt codes, fit values, oop only on grade 0, aria words; hand classes per slot.
Commit: `feat(pizarra): the cromo prints the exact position and how well he fits`

### Task 3: Sistema — «¿Nos encaja?» on every tile + the system's ficha

**Files:** `src/pages/pizarra/v2/Panels.tsx` (`SystemTab`, `MiniSystem`), its caller in `Board.tsx` (pass candidates), `pizarra-app.css`, `Panels.test.tsx`.
- Each tile: under «Clásico», a line «6/7 en su sitio» (only when at least one candidate has positions data; else nothing); the mini-pitch dots take `pzp-g*` by the best assignment's grades (keeper stays gold).
- Above the grid, a compact strip for the CURRENT system: «2-3-1 · Clásico», `about`, «Fuertes: …», «Débiles: …», and when missing is non-empty «Falta: un extremo derecho, un pivote» (Spanish names from POSITIONS, singular, «y» before the last).
- A small toggle «Ordenar por encaje» (persist in localStorage `mp_pizarra_v2_sysorder`, try/catch) that sorts tiles by inPlace desc (stable), default off (catalogue order).
- Tile `aria-label`: «Sistema 2-3-1 Clásico, 6 de 7 en su sitio».
Tests: Panels test renders tiles with the count for a fixture squad, the strip text, sort toggle order, and no count for a no-data squad.
Commit: `feat(pizarra): sistema — ¿nos encaja? por sistema y su ficha`

### Task 4: bench rows show preferida + también

**Files:** `src/pages/pizarra/v2/bench.ts`, the bench row/cromo markup (`Panels.tsx`/`SheetPanels.tsx`/`Cromos.tsx` — wherever `pos` from `benchRows` is printed), `pizarra-app.css`, `bench.test.ts`.
- Row badge prints the preferida code (`ps.main`) when known, else the line (as now), else «—».
- Under the stats line, «También MC · DFC» (only when `also` non-empty; max 3 codes then «+N»).
- The bench line filter (`zf`) keeps working by line; add position codes as filter options? NO — out of scope (2b).
- In hand mode the bench row `best` uses the held SLOT's code: grade ≥ 2 → best.
Tests: bench rows for players with/without positions; hand best by grade.
Commit: `feat(pizarra): el banquillo enseña la preferida y dónde más juega`

### Task 5 (controller): seed + screenshots + review
- Seed the local emulator with positions for the preview squad (scratch script, emulator only).
- Shoot the real app (`app-shoot-route.mjs`) at 1440 and 390: pitch filled, hand mode, Sistema panel, bench; check overlaps; final whole-branch review; show the user.
