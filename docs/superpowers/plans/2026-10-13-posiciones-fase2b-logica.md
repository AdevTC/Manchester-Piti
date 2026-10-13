# Posiciones · Fase 2b — la lógica de la pizarra por encaje exacto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Everything in the pizarra that reasons about «natural position» uses the same encaje as the cromo marks: química and diamonds, «Auto-colocar», «Sugerir siete», cambios por tandas, familiaridad, «Jugar de» (by exact code), the player ficha and the texts. Plus: replace the duplicate system 2-1-2-1a with 1-3-1-1 «Escalera».

**Architecture:** One logic grade in `v2/encaje.ts` that every consumer calls, consistent with what the cromo shows:
`logicGrade(L, sq, id, i): FitGrade | null` — exact data (main/also) → `fitAt`; line-only → 3 on his line (= «natural», as today), 0 off it (POR line in POR = 3); no data → null («unknown = fits», never rewarded, never penalised — as today). Helpers: `inPlace(g) = g === null ? false : g >= 2`, `adapted(g) = g === 1`, `out(g) = g === 0`.
Line-only squads must behave EXACTLY as today in every consumer (all of today's tests that use line-only fixtures keep passing unchanged unless a task says otherwise).

**Spec:** `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md` §3. Phase 2a plan for context: `docs/superpowers/plans/2026-10-13-posiciones-fase2a-pizarra.md`.

## Global Constraints
- Same as Phase 2a (`.superpowers/sdd/2026-10-13-posiciones-fase2a-pizarra/context.md` describes them): pnpm, no `any`, Spanish copy, never colour-only, `.pzp-*` CSS only in pizarra-app.css, no browsers/WebGL, `git add <files>`.
- Copy: Spanish position names from `POSITIONS[code].name` (lower-case in sentences); codes always paired with the name at least once per view.
- Firestore: `lineups.playerPositions` stays a map ≤ 60 entries of short strings (rules unchanged); values may now be a PosCode or a legacy Zone.

## Review Focus
1. Line-only squads: química number, diamonds, Auto-colocar, Sugerir siete, cambios and familiarity produce the same results as before this phase.
2. «Jugar de» overrides saved before this phase (zones) still load and behave as before.
3. A player with exact data never gets a contradictory message between cromo mark, química text, ficha and «Fuera de posición».
4. Keeper rules: only a declared keeper (POR main/also, or POR line) counts as in place in goal; Auto-colocar/Sugerir never put an outfield player in goal while a keeper is available.
5. Performance: assignment-based placement runs only on user action (button), not on every render.

---

### Task 1: 1-3-1-1 «Escalera» replaces 2-1-2-1a
**Files:** `src/lib/formations.ts`, `src/lib/formations.test.ts`, any test pinning 15 ids/order (`boardLogic.test.ts` stepSystem, Panels tests), fit tuning.
- Remove `2-1-2-1a`; add `1-3-1-1` «Escalera», carácter ofensivo, casillas LIB · MI MC MD · MCO · DC (keeper [50,95]), at the same place in the catalogue order. Copy: about «Un líbero, tres medios y un mediapunta detrás del punta.», fuertes «Superioridad en el medio y un enganche que conecta con el punta.», débiles «Un solo defensa: las bandas a la espalda de los interiores sufren.», needs «Un líbero rápido e interiores que bajen.».
- Spots must pass `fit.test.ts` (zig-zag the central column like 3-1-1-1 if needed; keep MI left of MD).
- `isFormationName`/lineupDoc: an unknown id still falls back to 2-3-1 (covers any stray `2-1-2-1a`).
Commit: `feat(pizarra): 1-3-1-1 «Escalera» en lugar del 2-1-2-1a duplicado`

### Task 2: logicGrade + química, diamonds, «siete listo»
**Files:** `v2/encaje.ts` (+test), `v2/quimica.ts` (+test), `v2/chemPlayer.ts` (+test), `v2/model.ts` (`isFull`), the Química panel copy (SheetPanels.tsx QuimicaPanel «Todos en su sitio natural»).
- Add `logicGrade`, `inPlace`, `adapted`, `out` (see Architecture). Unit tests incl. line-only parity with today's `natural/fits`.
- quimica.ts: a link's +1 «both natural» → both `inPlace`; the share of naturals (weight 28) → `inPlace` count + 0.5 × `adapted` count over placed; «natural keeper» (12) → keeper `inPlace`. Line totals unchanged.
- chemPlayer.ts: +1 for natural zone → `inPlace`; the cap at 1 for out-of-position → only `out`; adapted: no +1, no cap.
- isFull: keeper slot `inPlace` (or null = unknown keeper as today).
- Química panel text: «Todos en su sitio» when all placed are inPlace; else «6 en su sitio · Pablo adaptado de interior izquierdo» / «… · Erik fuera de su sitio (de punta en interior derecho)» (max 2 names, then «y N más»). Line-only squads keep the old text «Todos en su sitio natural.» when it applies.
Commit: `feat(pizarra): la química y los rombos cuentan por encaje exacto`

### Task 3: Auto-colocar and «Sugerir siete» by encaje
**Files:** `v2/ops.ts` (`autoPlace`), `v2/pack.ts` (`suggestSeven`), `v2/encaje.ts` (export the assignment helper if needed), tests (`boardLogic.test.ts`, pack tests).
- autoPlace: same pool as today; place by an exact max-weight assignment with weight = `100·[inPlace] + 10·(logicGrade ?? 1) + rt/100` (form only breaks ties); keeper slot restricted as in bestEncaje; pinned players stay.
- suggestSeven («Por forma»): choose and place 7 from the same candidates as today maximising Σ(rt + 25·[inPlace] + 10·[adapted] − 40·[out]) with the keeper rule; overrides kept only for players who stay (as today).
- Line-only squads: results must equal today's on the existing fixtures (Review Focus 1) — if an existing test changes, explain why in the report; prefer keeping the old algorithm path for squads without exact data (hasFitData false) to guarantee parity.
Commit: `feat(pizarra): auto-colocar y sugerir siete buscan el mejor encaje`

### Task 4: cambios, familiaridad, reparto
**Files:** `v2/cambios.ts` (generateWaves, replan), `v2/familiarity.ts`, `v2/bench.ts` (reparto), tests.
- cambios: the substitute for a slot is chosen by `logicGrade` of the candidate at the slot's code (inPlace > adapted > out), then by today's criteria; the out-of-position cost uses `out` (and half for adapted).
- familiarity: count appearances per exact slot code from official lineups (`slotCode` of the stored board), marks «++» (5+) / «+» (2+) by code, falling back to the line count when the player has no exact data; «!» = never there and `out`.
- reparto (bench.ts): «a rested player into a slot of his zone» → prefer `inPlace`, then `adapted`.
Commit: `feat(pizarra): cambios, familiaridad y reparto por encaje exacto`

### Task 5: «Jugar de» by exact code
**Files:** `src/lib/schemas.ts` (`lineupPositionsSchema` values: PosCode | Zone), `pizarra/formations.ts` (`Lineup.playerPositions: Record<string, PosCode | Zone>`), `v2/ops.ts` (`setPlaysAs`), `v2/fan.ts` («Jugar de» sub-fan), `v2/model.ts` (`natOf`), `v2/encaje.ts` (`fitAt`/`logicGrade` with a code override), view texts, tests (`boardLogic.test.ts` fan/setPlaysAs, lineupDoc tests).
- The sub-fan offers the slot's line codes first (the codes of the current system's slots in that line, deduped), then «Otra posición…» listing all 13 grouped by line — each item «MCD · Pivote».
- Override semantics: a code override = the captain says he plays there → grade 2 at that code, logic `inPlace` there; at other codes compare as fitGrade with main = override. Choosing the player's preferida (or his line for line-only players) clears the override (as today).
- Legacy zone overrides load and behave as before.
Commit: `feat(pizarra): «jugar de» por posición exacta`

### Task 6: the player's ficha and the texts
**Files:** `v2/ficha.ts` (+test), `v2/moveTo.ts`, `v2/charla.ts`, Board.tsx announcement strings that print `slotLabel` (free mode zone) → `slotCode`, `v2/compare.ts` («En su posición n/7» → inPlace count via logicGrade), `v2/record.ts` (`sevenFromStarters` places starters by exact encaje when data exists).
- Ficha facts: «Pivote (MCD) · también MC» as the position line; «Juega de interior izquierdo · adaptado» (or «· en su sitio», «· fuera de su sitio»); line-only players keep «MED natural».
- moveTo targets list each slot as «MI · interior izquierdo» with the fit word.
Commit: `feat(pizarra): la ficha y los textos hablan de posiciones exactas`

### Task 7 (controller): screenshots with exact data and with line-only data; whole-branch review; report to the user.
