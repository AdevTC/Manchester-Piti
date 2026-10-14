# Bloque 3 — que se sienta en vivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** On match day the whole site feels like one live product:
- A goal is celebrated on whatever page you're on.
- The live island follows the match from «a punto de empezar» to «vota al MVP».
- Every phone shows the same minute.
- You know when you're offline.
- Push covers the whole match and your personal news.
- A renamed member shows the new name everywhere.
- The pizarra's seven and the convocatoria stop being two different sevens.

**Source of truth:** `docs/auditoria/2026-10-14-sync-tiempo-real.md`, findings M2, M3, M4, M6, M7, M8, M9, L2, L3, L10, plus the «make it feel live» table (§c). Ledger parked item: push names without the season shirt name (functions push/seven/door/social).

## Global Constraints
- Blocks 1–2 constraints apply: pnpm, no `any`, Spanish copy, never colour alone, `prefers-reduced-motion` (every new animation has a still fallback), `git add <files>`, no new deps, no browsers/WebGL from agents, **never production**.
- Shared pure logic lives in `functions/src` and is re-exported by `src/lib` when both sides need it.
- Functions changes need emulator integration tests (`functions/test/*.integration.mjs`). The controller deploys at rollout.
- New Firestore fields or collections need rules and rules tests (`test/rules/firestore-rules.test.ts`, `pnpm test:rules`). Keep public reads unchanged unless a task says otherwise.
- Push notices reuse `pushLogic.ts` conventions (tags, `pushLog` claims, topics, URLs with `?tab=`). A notice never sends twice for the same event.

## Review Focus
1. **No double notifications:** across retries, clock resets, corrections and the 5-minute jobs.
2. **Old data:** matches without `clock`, legacy actas, members without nickname, old push subscriptions.
3. **Offline and slow phones:** stale data never celebrates, ticks a wrong minute, or hides that it's stale.
4. **Reduced motion and screen readers:** live changes are announced once (`aria-live` polite), never spammed.
5. **Cost:** no new per-second listeners or polling, and no whole-collection reads for fans.

---

### Task 1: one live store with metadata + retry (L1/L2 foundation)
**Files:** `src/lib/useFirestoreCollection.ts` (shared TanStack registry) and `src/pages/vestuario/live.ts` (`useShared`). Tests.
- Expose snapshot metadata on the shared `["matches"]` (and any shared key) entries: `fromCache` and `hasPendingWrites`. Use `includeMetadataChanges`, filtered so metadata-only changes don't re-render consumers that don't read them.
- Add a `useSyncStatus()` hook that combines `navigator.onLine` events with the `fromCache` of `["matches"]`. It returns `{ online, fresh, since }`, where `since` is the last server snapshot time.
- On a snapshot error, drop the registry entry so the next mount resubscribes, keeping the last good data and `error` (L2). Same for `useShared`.

Tests: metadata exposed; status transitions; resubscribe after error.

Commit: `feat(directo): el estado de la conexión y escuchas que se recuperan`

### Task 2: server time offset (M3)
**Files:**
- `functions/src/live.ts` and `functions/src/liveClock.ts`: callables return `serverNow`.
- `src/hooks/useClock.ts` (or wherever `useClock`/`now` lives).
- A new `src/lib/serverTime.ts`. Tests.

**Behaviour:**
- Estimate `offset = serverNow − midpoint(local request time)` from every callable response.
- Also estimate it once from the `Date` header of `/datos/club.bundle`.
- Keep a smoothed value in memory and sessionStorage.
- `useClock()` returns `Date.now() + offset`.
- Every live minute reading (`clockReading`, `liveMinute`, the island, the board) uses that clock.

Tests: offset maths; consumers use the shared clock.

Commit: `feat(directo): todos los móviles marcan el mismo minuto`

### Task 3: the live island's full lifecycle + offline chip + goal moment everywhere
**Files:** `src/components/celeste/LiveIsland.tsx` and CSS, the GoalBurst / useGoalCelebration from block 1, `useSyncStatus` (Task 1), the match board chip on the match page and on /partidos, and the admin LED (`admin` live header). Tests.

**Island states:**
- «Pendiente del pitido inicial» (pending whistle)
- live minute
- «Descanso»
- «FINAL 2–1 · acta pendiente», kept for 30 min after the whistle
- «Vota al MVP», while the vote is open and the user is a member, linking to `?tab=vestuario`

**Goal moment on any page:** when a fresh goal arrives (block 1's rule), the island shows «¡GOL! NOMBRE 19′ · 2–1» for about 4 s, with a burst only if motion is allowed. It is announced once via `aria-live="polite"`.

**Offline chip** in the island, the match board and the admin LED. Texts: «Reconectando…» while offline, or «Sin conexión · marcador de hace N min» when the server data is older than 60 s during a live match.

**Accessibility:** `aria-live` on the island pill (L10).

Commit: `feat(directo): la isla vive el partido entero y avisa si te quedas sin conexión`

### Task 4: push completeness (M8, M9) + push names by season
**Files:**
- `functions/src/pushLogic.ts`, `push.ts`, `index.ts` (triggers);
- the 5-minute scheduled job (MVP winner);
- `public/push-sw.js`, `src/lib/push.ts`, `usePushDevice.ts`;
- `functions/src/names.ts`: `nameFor` moved, or shared with `src/lib/derived/names.ts`. Use it in push, seven, door and social.

Tests: pushLogic units + integration.

**Clock transitions in `pushOnMatch`:**

| Transition | Notice |
|---|---|
| `first → halftime` | «Descanso · 1–0» |
| `halftime → second` | «Arranca la 2ª parte» |
| `→ ended` | «Final (provisional) · 2–1». The acta-published «Final» stays and replaces it, using the same tag. |

**Other notices:**
- **Goal removed:** «Gol anulado» with the same `goal-<id>` tag, so it replaces the goal notice.
- **MVP winner:** the 5-minute job sends «MVP de la J5: NOMBRE» once when `voteClosesAt` passes and a winner exists. Claim it through `pushLog`.
- **Personal topics:** «Tu ficha ya es tuya» when a claim is approved; «El capitán revisó tus posiciones» when `positionsReview` is written. Send them only to that member's devices; check how personal topics work today.
- **Service worker:** handle `pushsubscriptionchange`, re-subscribing and calling `pushSubscribe` with the saved topics. On app boot, re-assert a lost subscription at most once a day.

All push names use the season shirt name (`nameFor` with the match's season).

Commit: `feat(avisos): el partido entero y tus noticias llegan al móvil`

### Task 5: a rename reaches everything (M7)
**Files:**
- `functions/src/profile.ts` (setNickname) or a new `onDocumentWritten(users/{uid})` trigger;
- `functions/src/index.ts` exports;
- integration test.

When a member's nickname changes, rewrite the denormalised copies in bounded batches:
- `matchPrivate/*/availability/{uid}.name` (collectionGroup query by uid)
- `matches/*/votes/{uid}.voterName`
- `matchPrivate/*/predictions/{uid}.name`
- `porraStandings/*.rows[].name`
- `board/*` by uid
- `trainings/*/votes/{uid}.name`
- `lineups.ownerNickname`
- `accessRequests/{uid}.name`

Check each path in the code and rules. Make it idempotent, skip docs already up to date, and cap the number of writes.

Integration test: rename, then every copy shows the new name.

Commit: `feat(vestuario): tu nuevo apodo llega a todas partes`

### Task 6: one «siete» (M6)
**Files:**
- pizarra `useLineups.publishOfficial` and the official-publish UI (Board / SheetPanels);
- `functions/src/convocatoria.ts` (`setConvocatoria`);
- match page `CampoTab` / `Tabs.tsx`;
- admin Convocar «La pizarra» status;
- `pushLogic.ts` (seven vs convocatoria notices).

Tests.

- **Publishing the official board for a match:** this offers, checked by default, «Usar este siete como convocatoria». It calls `setConvocatoria` with the board's seven as starters and the board's bench as bench. Only one notice goes out: the convocatoria notice is suppressed when the lineup notice already went out for the same seven within 10 min. Use pushLog claims or a shared tag.
- **Match page Campo:** before the acta, it shows the official seven when one exists, with a «Siete oficial de la pizarra» badge. When the convocatoria and the board differ, a note says so.
- **Admin Convocar:** shows «La pizarra coincide» or «La pizarra tiene otro siete», with a «Copiar el de la pizarra» action.

Commit: `feat(convocatoria): un solo siete, de la pizarra a la convocatoria`

### Task 7: live MVP race + acta editor divergence banner (M4) + SSR MVP seed (L3)
**Files:**
- match page Vestuario tab (MVP block);
- vestuario MvpBlock;
- admin `useEditBuffer.ts` / MatchEditor;
- `src/entry-server.tsx` and `publicData.ts` (seed `["mvpResults"]`).

Tests.

- **MVP race:** while the vote is open, the match page and the vestuario show the live vote counts (public `mvpResults`) as a race of the top 3, with a «Quedan 12 h» countdown. When it closes they show the winner reveal. Motion is gentle; reduced-motion users get a static podium.
- **Acta editor banner:** when the buffer is dirty and the server got new live events, show the bar «Han llegado N jugadas nuevas desde que empezaste a editar · Incorporarlas». It merges by event id: live events are append-only with unique ids.
- **SSR:** seed `["mvpResults"]` from the bundle and wait for it in `primePublicData`.

Commit: `feat(directo): la carrera del MVP en vivo y el acta que no se pierde jugadas`

### Task 8 (controller)
- Reseed the emulator and simulate a match day with the admin En juego and the public pages, taking screenshots of:
  - the island states;
  - the goal moment on /stats;
  - the offline chip (DevTools offline is not available, so simulate it with a test hook or by stopping the emulator);
  - the MVP race;
  - the acta banner.
- Run rules tests, the functions integration tests, unit tests, the build and e2e.
- Do the whole-branch review.
- Open the PR, deploy the functions, merge, and smoke-test.
