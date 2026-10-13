# Posiciones · Fase 3 — admin y perfil (editar, proponer, aprobar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Captains edit a player's exact positions in the admin «ficha a ficha»; players propose theirs from «Tu carta» in their profile; captains approve / adjust / reject from the ficha and see pending proposals in «Hoy». The card and texts show the exact preferida. The production migration script is made safe to run.

**Approach (approved by the user, 2026-10-13):** integrate into the LIVE screens, keep their language, verify with screenshots of the real app (emulator). Real screens studied:
- Admin › Plantilla «ficha a ficha»: hero card with shirt, name, «Línea POR · DEF · MED · DEL» segmented control, «Estado» segmented, stats; left list grouped by line with «faltan N»; chips «Sin foto / Faltan datos / Sin cuenta»; gap chips «Pos · Foto · Nac · Alt · Peso».
- Admin › Hoy: «Por hacer» list of cards («Historias de jugadores · por completar … [Completar]»).
- Perfil › «Tu carta» tab (linked): sections with a yellow bar heading + subtitle + bordered panels (A «En la espalda», B «Tu apodo»), «Tu ficha», «Qué significa cada número»…; the card face prints «75 MED» and the LED reads «… CENTROCAMPISTA».
- Public /plantilla FichaModal: «Posición: Pivote» (Phase 1).

**Spec:** `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md` §1 (model, rules, flow), §4. Rules (Phase 1): a member may write only `positionsProposal` ({main, also ≤6, at == request.time}) on his own ficha (or null); admin writes `positions` ({main, also}), `positionsReview` ({status aprobada|ajustada|rechazada, at == request.time, by == uid}) or null, `positionsProposal: null`.

## Global Constraints
- Phase 2 constraints apply (context file `.superpowers/sdd/2026-10-13-posiciones-fase3-admin-perfil/context.md`): pnpm, no `any`, Spanish copy, never colour-only, reduced motion, `git add <files>`, no browsers/WebGL from agents.
- Admin CSS lives in the admin styles (`src/styles/admin*.css`, `src/pages/admin/club/plantilla.css`); perfil CSS in `src/styles/perfil*.css`; a shared component's CSS in `src/styles/posiciones.css` with prefix `pos-`. Never restyle existing classes beyond what a task names; never reuse generated short class names.
- Every admin write of positions also writes `naturalPosition` = line of `positions.main` when main exists (compat; Phase 1 `linePickPayload` rules stay valid).
- Firestore writes use `serverTimestamp()` for `at` (the rules require `== request.time`).

## Review Focus
1. Rules: every write the UI makes passes `firestore.rules` (a member's proposal; admin approve/adjust/reject; admin direct edit) — covered by rules tests or by mirroring the exact payload shape in unit tests against the rule's constraints.
2. A player without positions (most real data) sees a clear empty state («Aún no has dicho dónde juegas») and the admin sees «Sin posición»; nothing crashes on old word data.
3. Proposal lifecycle: pending → approved/adjusted/rejected is visible to the player; a new proposal replaces the old; withdrawing works.
4. Undo/autosave conventions of the admin ficha are respected (no data loss when switching player mid-edit).
5. Phone 390 and desktop 1440 without overlap; ≥44 px targets on the map.

---

### Task 1: pure editing helpers
**Files:** create `src/lib/positionsEdit.ts` (+ test).
- `cyclePosition(set: PositionSet, code: PosCode): PositionSet` — nada → también → preferida → nada; only one preferida (choosing a new preferida demotes the old one to también); `also` stays unique, ≤ MAX_ALSO (when full, a new también is refused — return the set unchanged and let the UI say «Máximo 6»).
- `positionsPayload(set)` → `{ positions: {main, also}, naturalPosition?: line }` (naturalPosition only when main).
- `proposalPayload(set | null, ts)` → `{ positionsProposal: {main, also, at: ts} }` or `{ positionsProposal: null }`.
- `reviewPayload(kind: "aprobada"|"ajustada"|"rechazada", set: PositionSet | null, uid, ts)` → approve/adjust: positionsPayload(set) + `positionsProposal: null` + `positionsReview {status, at: ts, by: uid}`; reject: `positionsProposal: null` + review only.
- `proposalState(doc)` → `"ninguna" | "pendiente" | "aprobada" | "ajustada" | "rechazada"` (pending when a proposal exists; else the last review's status; else ninguna) and `proposalDiff(current, proposal)` → `{added: PosCode[], removed: PosCode[], mainChange?: [from, to]}`.
Tests for every rule incl. the 6 cap and the rules' shape constraints (main not in also, unique, ≤6).
Commit: `feat(posiciones): utilidades para editar, proponer y revisar posiciones`

### Task 2: «Mapa de posiciones» component
**Files:** create `src/components/posiciones/MapaPosiciones.tsx`, `src/styles/posiciones.css` (+ test with Testing Library).
- A vertical F7 mini-pitch (portrait, own goal at the bottom) with the 13 spots at `POSITIONS[code].x/y`; each spot is a real `<button>` showing the code; states: nada (outline, dim), también (outline + «✓»), preferida (filled + «★» and a «PREF» tag) — never colour alone.
- Props: `value: PositionSet`, `onChange?(next)` (absent = read-only), `compare?: PositionSet` (draws the difference: added «+», removed «−», for the captain's review), `size?: "s"|"m"`, `label` (accessible group name).
- Edit: click/Space/Enter cycles via `cyclePosition`; arrows move focus to the nearest spot in that direction; live region announces «MCD · pivote: preferida». Targets ≥ 44 px at size m (phone width ~320 px pitch).
- Under the pitch a one-line legend «★ Preferida · ✓ También» and the textual summary «Pivote (MCD) · también MC, DFC» (used as the read-only fallback for screen readers).
- Respects prefers-reduced-motion; works on dark (perfil) and light/dark admin themes via CSS custom properties set by the host.
Commit: `feat(posiciones): el mapa de posiciones (ver y editar)`

### Task 3: admin ficha edits positions + reviews proposals
**Files:** `src/pages/admin/club/FichaWorkspace.tsx`, `AltaWorkspace.tsx`, `PlantillaList.tsx`, `plantillaLogic.ts`, `plantillaBoard.ts`, `src/pages/admin/views/Plantilla.tsx`, `plantilla.css`, tests (`Plantilla.test.tsx`, `plantillaLogic.test.ts`, `plantillaBoard.test.ts`).
- Replace the «Línea» segmented control with «Posiciones»: the Mapa (size s, editable) + summary; changes save like the line picker today (optimistic + undo toast via the existing deferred-commit pattern), payload `positionsPayload` (and the Phase 1 rule: changing the line through positions keeps naturalPosition in sync).
- Pending proposal: a banner inside the hero card «PABLO propone: Pivote (MCD) · también MC, DFC» with the Mapa in compare mode and three actions: «Aprobar» (reviewPayload aprobada with the proposal), «Ajustar» (loads the proposal into the editor; saving writes ajustada), «Rechazar» (rechazada). Undo where the existing pattern allows.
- Left list: subtitle shows the exact preferida code when known («MCD · faltan 3»); groups stay by line (derived). Gap chip «Pos» = no preferida. New filter chip «Propuestas N» next to «Sin foto / Faltan datos / Sin cuenta». CSV: columns «Preferida», «También».
- Alta: the same Mapa instead of the line picker (optional; default empty).
Commit: `feat(admin): posiciones exactas en la ficha y revisión de propuestas`

### Task 4: «Hoy» shows pending proposals
**Files:** the Hoy «Por hacer» model and view (`src/pages/admin/views/hoy/hoyModel.ts` + its component), tests.
- A «Por hacer» card «Posiciones propuestas · por revisar» with «Pablo, Erik y 2 más» and a «Revisar» button that opens Plantilla on the first player with a pending proposal (existing navigation helpers, e.g. `go({ section: "plantilla", playerId })`). Counts in the «Hoy» badge like other pending items.
Commit: `feat(admin): hoy avisa de propuestas de posición`

### Task 5: perfil «Tus posiciones» + exact code on the card
**Files:** `src/pages/perfil/TabCarta.tsx` (or the section components it uses), `profileData.ts`/`useProfileData.ts` (expose the linked ficha's positions + proposal + review), a write hook next to the existing perfil writes, `card.ts`/card faces/LED text, `src/pages/squad/FichaModal.tsx` («También MC · DFC» under «Posición»), perfil CSS, tests.
- New section after «Tu ficha», same section language: heading «TUS POSICIONES», subtitle «Dónde juegas. El capitán lo confirma.»; the Mapa (size m, editable) seeded with the approved positions (or the pending proposal); a status line by `proposalState` («Aprobadas por el capitán», «Pendiente de que el capitán la vea», «El capitán la ajustó», «El capitán no la aceptó: siguen las de antes»); primary button «Enviar al capitán» (enabled when it differs from the approved set) and «Retirar propuesta» while pending. Writes `proposalPayload` (member rule). Empty state when the player has no positions: «Aún no has dicho dónde juegas».
- Only for a linked player (vinculada); hidden otherwise.
- The card face prints the preferida code («75 MCD») when known, else the line; the LED prints the long name («PIVOTE»); share images keep working (Phase 1 positionText).
- FichaModal: «Posición: Pivote» + a second line «También MC · DFC» when any.
Commit: `feat(perfil): tus posiciones — propón dónde juegas`

### Task 6: migration script safe for production
**Files:** `functions/scripts/migrate-positions.mjs`, `functions/src/positions.ts` (if a helper is needed) + tests.
- Refuse `--prod` when `FIRESTORE_EMULATOR_HOST` is set (clear error), print the effective target; per-doc precondition (`lastUpdateTime` = the read's updateTime) so a concurrent admin write is never overwritten; batches of ≤ 450 writes; dry-run summary counts by outcome.
Commit: `fix(posiciones): la migración no pisa nada y no se confunde de proyecto`

### Task 7 (controller): emulator walkthrough with screenshots (admin edit, proposal from perfil, approve/adjust/reject, Hoy), rules tests, e2e admin/perfil, whole-phase review, report to the user.
