# La mesa · implementation plan

Date: 2026-10-17. Design: the v2 row of the canvas «La mesa · partido en vivo (Copy)»
(https://claude.ai/artifact/Jt9fXoRgguUqmAaazfTKSm), the «Noche de banda» direction, implemented as drawn.
Behaviour: `docs/superpowers/specs/2026-10-17-mesa-en-vivo-design.md`'s predecessor
`2026-10-16-mesa-en-vivo-design.md`, with these user decisions on top:
- the goal push stays immediate (no 8 s delay); copy that said «aviso en 8 s» says «ya en la web»;
- Final's G uses the site's real G·E·P badge (`pt-res`);
- screens whose content can outgrow a short phone scroll above a fixed dock, so nothing is ever cramped.

The artboard sources (the look to port, class for class) live in
`C:\Users\Usuario\AppData\Roaming\Claude\side-session-notes\local_23bd2771-61b8-48b2-a15c-d837368a8899\mesa-bocetos\*V2.dc.html`.

## Contract (shared by every workstream; committed before the agents start)

### Events (`functions/src/matchEngine.ts` EVENT_LABELS, `functions/src/liveRules.ts`)
- New types: `opponent_foul` «Falta del rival», `opponent_woodwork` «Al palo, rival», `opponent_offside`
  «Fuera de juego del rival», `opponent_yellow` «Amarilla al rival», `opponent_red` «Roja al rival»,
  `opponent_penalty_missed` «Penalti fallado por el rival», `injury` «Tocado».
- Reused types: `foul` (hace falta), `foul_received` (le hacen falta), `save` (parada, goalkeeper),
  `penalty_received` (penalti a favor, optional fouled player), `penalty_committed` (penalti en contra,
  optional player), `goal_penalty` (penalty scored = one goal event), `penalty_missed`, `penalty_saved`
  (our keeper saves theirs), `woodwork`, `chance`, `corner`, `opponent_*`.
- A goal without `playerId` is «Lo apunto luego» (pending scorer), as today.
- `MESA_TYPES` (liveRules.ts) is the single live catalogue; `LIVE_TYPES` = `MESA_TYPES`.
- Event fields added: `byUid`, `editedByUid`, `editedAt` (ms), `dupOf` (id of the earlier event it may
  duplicate), `dupOk` (true once someone said «Son dos»), `queued` (true when it was tapped offline).

### Score
Every score count (client `scoreOf`, push `liveScore`, ledger) ignores events with `dupOf` set and
`dupOk` not true. Publishing is refused while any such event exists.

### Callables
- `liveEvent`
  - `add`: as today plus `tappedElapsed?` (seconds of play when tapped) and `period?`. When
    `tappedElapsed` is present the server validates it against the clock's play window for that period
    instead of the current reading and skips the `clockRevision` check. Stamps `byUid`. Sets `dupOf`
    when another event with the same type and the same player (or both without player) by a different
    `byUid` and no `dupOk` lies within 30 s of play.
  - `edit`: `{ matchId, eventId, patch: { type?, playerId?, assistPlayerId?, inPlayerId?, elapsedSeconds?, dupOk? } }`,
    any event, any scorer. Stamps `editedByUid`, `editedAt`.
  - `delete`: `{ matchId, eventId }`, any event, any scorer.
  - `undo` stays (the lower-third «Deshacer»).
- `controlMatchClock`: new actions `pause`, `resume` (a hold inside a half: `clock.heldAt`, closed into
  `clock.pauses` on resume; holds don't count towards minutes) and `added` with `value` 0–15 (sets
  `clock.added[period]`, a label only).
- `publishLive` (new): `{ matchId, assists?: Record<eventId, playerId | ''> }`. Admin or a scorer of
  that match. Requires the clock ended and no pending duplicate. Applies the assists, then runs the same
  publish pipeline as `saveMatchSheet` (ledger, positions, MVP) with status `finished` from the live
  record. Reopening a published acta stays admin-only.

### Presence
`matchPrivate/{matchId}/presence/{uid}` = `{ name, at }`, written by the scorer's own client every 30 s
while la mesa is open. Rules: read for team members; create/update only own uid and only if admin or in
`scorerUids`.

### Client
- Route `/matches/$matchId/mesa` → `src/pages/mesa/Mesa.tsx`, search `?vista=cronica` for «Lo que va
  pasando». The phase picks the screen: ready → Antes, first/second → En juego (offline is the same screen
  with its offline state), halftime → Descanso, ended → Final.
- `src/pages/mesa/`: `tokens.css` (Noche de banda tokens and shared objects), `types.ts` (the view
  contract), `model.ts`, `useMesa.ts` (match, scorers, presence, queue, wake lock, vibration),
  `queue.ts` (persistent offline queue, localStorage + BroadcastChannel, ordered upload, never blocked
  by a pending earlier play).

## Workstreams (parallel, each in its own worktree; file ownership never overlaps)
1. **Server** — `functions/src/**`, `firestore.rules`, `functions/test/**`, `test/rules/**`.
2. **Mesa core** — `src/pages/mesa/{Mesa,useMesa,queue,model}.ts(x)`, En juego, Sin cobertura, the
   route in `src/router.tsx`, `src/lib/clubApi.ts` helpers.
3. **Mesa screens** — `src/pages/mesa/screens/{Antes,Cronica,Descanso,Final}*`.
4. **Fans and integration** — `src/pages/match/**` except Banda removal, `src/lib/eventMeta.ts` (one
   label and icon map for every type), island, Hoy, vestuario, stats columns.
5. **Cut-over** (after 1–4 merge) — remove Banda, QuickMatchEntry and the admin En juego pads, point
   the admin and pizarra entry points at la mesa, the pizarra's subs as one operation, e2e.
