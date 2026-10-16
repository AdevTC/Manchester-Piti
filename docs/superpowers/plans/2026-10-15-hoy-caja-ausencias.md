# «Hoy», La caja y Ausencias: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Build the three features in the spec:
- **«Hoy»:** the match-day card for members.
- **Ausencias:** absences by date that pre-answer «No puedo».
- **La caja:** a shared money ledger.

**Spec:** `docs/superpowers/specs/2026-10-15-hoy-caja-ausencias-design.md` (binding; the user's decisions are at its top).

**Execution (speed mode, see memory `speed-over-ceremony`):** waves of two parallel agents whose files never overlap. Tasks 1 and 2 both edit `firestore.rules`, and Tasks 3 and 4 both edit the vestuario page, so neither pair can share a wave.
- **Wave A:** Task 2 (caja model, rules, admin) runs with Task 4 («Hoy»). Task 4 leaves out the absence line for now.
- **Wave B:** Task 1 (ausencias rules and functions) runs with Task 3a (the vestuario «La caja» block).
- **Wave C:** Task 3b runs alone: the vestuario «Mis ausencias» block, the «Ausente» badges in Convocar and the convocatoria list, and «Hoy»'s absence line.
- No per-task review. Task 5 covers one whole-branch review, before/after screenshots, and the controller's deploy.

## Global Constraints
- **Stack and style:** pnpm, TypeScript without `any`, Spanish copy, never colour alone, `prefers-reduced-motion`, ≥ 44 px targets, phone 390 first.
- **Design:** the Celeste base (`src/styles/celeste/`: `hm-kick`, `hm-h2`, `hm-btn`, `hm-ghostbtn`, `st-card`, `st-seg`, `st-empty`) and the `.vx` tokens. New CSS uses a feature prefix (`hoy-`, `aus-`, `cj-`).
- **Git:** `git add <paths>` only. Never touch `.claude/launch.json` or `.impeccable/*`. No new dependencies.
- **Agents:** no browsers, no WebGL. **Never production:** no `--prod`, no deploys.
- **Parallel agents** share one working tree. Each commits only its own paths, and leaves the other agent's failing files alone.
- **Shared code:** pure logic goes in `src/lib/derived/` with tests. Logic both sides need goes in `functions/src`, re-exported by `src/lib`.
- **Collections and functions:** every new collection gets rules in `firestore.rules` plus tests in `test/rules/firestore-rules.test.ts` (`pnpm test:rules`, which needs the emulators). Every new function gets an emulator integration test in `functions/test/*.integration.mjs`; the controller runs these if they aren't running.
- **Money** is integer cents everywhere, formatted with `Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" })`.
- **Reuse:**
  - `useViewer` (member/admin)
  - `kickoffState`
  - `RsvpSwitch` / `PorraCard` / `MvpBallot` (`src/pages/vestuario/shared/`)
  - `scoreboard.ts`, `venue.ts`, `Countdown`
  - `campoSeven` / `useMatchBoard`
  - `weather.ts`
  - `nameFor`
  - `pushLogic.ts` conventions: tags, `pushLog` claims, captain topics

## Review Focus
1. **Members vs fans.** «Hoy» and the vestuario blocks never render or read member data for fans. The SSR home is unchanged for fans, with no layout shift.
2. **Absences never clobber a hand-made answer they didn't create.** That holds for deletes, for date changes of a match, and for a new match published into a range. No push storm: one captain notice per absence.
3. **The money adds up to the cent.** The split's leftover cents, void movements, and balances match across the vestuario and the admin.
4. **Append-only caja.** Rules refuse deletes, edits other than `void` false → true, and non-admin writes.
5. **Timezone.** Match day and absence ranges are Madrid calendar dates, including matches after 22:00 and the DST change.

---

### Task 1: Ausencias: data, rules, functions (Wave B)
**Files:**
- `firestore.rules` (`absences`) and `test/rules/firestore-rules.test.ts`
- new `functions/src/absences.ts`: `onAbsenceWritten` and the pure helpers `matchesInRange` and `absenceAvailabilityPlan`
- `functions/src/push.ts` `pushOnMatch`, or a small new match trigger: apply ranges when a match is published or changes date
- `functions/src/reminders.ts` `pushOnAnswer`: skip `source == "absence"`
- `functions/src/pushLogic.ts`: the captain notice «NOMBRE no puede del 12 al 19 oct (2 partidos)», once per absence
- `functions/src/index.ts` exports
- `functions/test/absences.integration.mjs`
- `src/lib/derived/absences.ts`: re-export the pure helpers for the client

**Behaviour, exactly as in spec §2:**
- **Shape:** `{uid, playerId, name, from, to, note?, createdAt}`, with dates `YYYY-MM-DD` in Madrid time and a range of at most 120 days.
- **Rules:** members read; the owner creates and deletes; captains delete any; no updates.
- **Writes:** availability writes by the backend carry `source: "absence"` and `absenceId`. Client writes are unchanged: `src/pages/vestuario/writes.ts` uses `setDoc` without `source`, so a hand answer replaces it.
- **Rules check:** keep the availability rule's `hasOnly` as it is. Confirm by reading it that client writes still pass.

**Tests:**
- Pure: range maths across the October DST change, and a match at 23:30 Madrid.
- Integration:
  - create sets «no» on in-range upcoming matches only;
  - delete removes only untouched ones;
  - a hand answer survives the delete;
  - a match published into a range gets «no» only if unanswered;
  - exactly one push claim.
- Rules tests.

**Commit:** `feat(ausencias): «no puedo del 12 al 19» responde los partidos de esas fechas`

### Task 2: La caja: model, rules, admin section (Wave A)
**Files:**
- `firestore.rules` (`caja/{seasonId}`, `cajaMovs/{id}`) and rules tests
- new `src/lib/derived/caja.ts`: `balances`, `jarBalance`, `splitCost(totalCents, playerIds) → cargos`, `cuotaCargos`, and `fmtEuros`
- admin:
  - `src/pages/admin/shell/nav.ts`: a «Caja» item in group «club», with icon and aliases «dinero cuotas pagos bote»
  - the router admin route
  - new `src/pages/admin/views/Caja.tsx` plus its CSS
  - `src/pages/admin/data/` hooks to read and write
- the match workspace (`src/pages/admin/partidos/`): a «Coste del partido» shortcut after publish

**Behaviour, as in spec §3:**
- **Movements:** `cajaMovs` docs are `{seasonId, kind, playerId|null, amount, concept, date, matchId?, by, createdAt, void}`.
- **Who plays:** for the match-cost split, the players who played come from the acta (starters plus subs who came in). Reuse block 1's `minutesOf` (> 0, or a starter with legacy `null`). With no acta, use the convocados.
- **Writes:** the admin writes with batched direct writes, validated by the rules.
- **Correcting:** «Anular» sets `void` and asks for confirmation.
- **Settings:** a form for `cuota`, `cuotaPeriod` and `howToPay`.
- **Filters:** by season, kind and player.

**Tests:**
- Pure: split remainders (e.g. 4500 cents over 7 players), void handling, and balance/jar invariants.
- Admin view: actions write the right docs.
- Rules: append-only; `void`-only update; admin-only create; members read.

**Commit:** `feat(caja): la caja del equipo en la sala de control`

### Task 3: Vestuario blocks: «Mis ausencias» and «La caja»
Task 3a is «La caja», in Wave B. Task 3b is «Mis ausencias», the badges, and «Hoy»'s absence line, in Wave C.
**Files:** `src/pages/vestuario/` (new `Ausencias.tsx`, `Caja.tsx`, their placement in the page, `live.ts` readers), `src/styles/vestuario.css` (or new `aus-`/`cj-` sheets imported by the page), Convocar and vestuario convocatoria list badges («Ausente · hasta 19 oct»), tests.

**Mis ausencias:**
- Two date inputs (Madrid), an optional note, and «Añadir». Validation copy says what's wrong.
- The list of your upcoming absences, each with «Quitar».
- Uses Task 1's shape.

**La caja:**
- Your balance, big: «Debes 12,50 €» or «Al día · +3,00 €».
- The jar.
- «Cómo pagar».
- Everyone's balances, owing first, each with an icon and a word.
- Your movements, collapsible.
- Uses Task 2's `src/lib/derived/caja.ts`.

**Tests:** both blocks render for members only, the writes have the right shape, and the formatting is right.

**Commit:** `feat(vestuario): tus ausencias y la caja del equipo`

### Task 4: «Hoy» (Wave A; the absence line comes in Task 3b)
**Files:**
- new `src/lib/derived/hoy.ts`: `hoyModel(matches, viewer, now)` returns `null` or `{phase, match, …}`
- new `src/components/celeste/HoyCard.tsx` with `hoy-` CSS
- the home: mounts it client-side above the hero for members
- the vestuario: replaces the next-match hero during the window

**Behaviour, as in spec §1:**
- **Window:** match day by Madrid date, until `voteClosesAt`.
- **Phases** come from `kickoffState`, reusing the shared pieces listed in Global Constraints.
- **«Sales de titular · DFC»** when the viewer is in the official siete or the convocatoria starters, with the exact position code.
- **Absence:** if the viewer has an absence covering today, the card says «Hoy no juegas: estás ausente», with a link to change the answer.

**Tests:** `hoyModel` across the timeline (00:00, before, pending whistle, live, halftime, ended, acta published with the vote open, vote closed), two matches the same day, fans get `null`, and both hosts render it.

**Commit:** `feat(hoy): el día de partido en una tarjeta, en el inicio y en el vestuario`

### Task 5 (controller)
- Reseed the emulator with absences, caja movements, and a match today.
- Screenshots at 390 and 1440, in day and night:
  - «Hoy» in each phase: simulate with `live-shoot.mjs`;
  - the vestuario blocks;
  - admin Caja;
  - Convocar badges.
- Pixel-diff the untouched pages against main.
- Run lint, unit, build, rules tests, functions integration and e2e.
- Run the whole-branch review.
- Open the PR.
- Deploy rules and functions before the web; the user is asked at deploy time if it's not already clear. Then merge.
