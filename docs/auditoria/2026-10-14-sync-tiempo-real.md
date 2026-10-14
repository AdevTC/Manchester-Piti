# Manchester Piti — data sync & realtime audit

Read-only audit of `main` @ bd459d8 (2026-10-14). No files changed, nothing run against Firebase.

## Summary

The base is solid. Almost every screen reads Firestore through realtime listeners. The four public
collections (`matches`, `players`, `seasons`, `clubContent`) share one ref-counted `onSnapshot` per key
(`src/lib/useFirestoreCollection.ts`). Live match events are written into `matches/{id}.events`, so the
single `matches` listener carries a goal to the home page, Partidos, the match page, the LiveIsland, the
pizarra and the admin within about a second. There is no polling, and very few one-shot reads remain.

The problems are in the seams between modules:

1. A shared-listener key collision. Two hooks read the same doc with different mappers. On match day
   this breaks «anotadores» (scorers) and shows scorer uids in place of the meeting note.
2. The season selector on Partidos goes out of sync with the URL and snaps back.
3. Time and state disagree across surfaces. A v2 match whose clock is never started stays «scheduled»
   forever. Push says «¡Empieza!» while the web still shows a countdown at zero.
4. The same stats are derived in different places with different rules: minutes, position ratings and
   «current season» vs «selected season».
5. Nothing tells the user the data is cached or offline. Live surfaces keep ticking over a frozen score.

---

## (a) Route → data sources

Legend: **RT** = realtime `onSnapshot`. **RT-shared** = ref-counted in a registry, kept warm 60 s after the
last reader leaves. **1x** = one-shot. **SSR** = server-rendered HTML built from the data bundle. **SW** =
service-worker cache.

Shared foundation, mounted on every route:

| Layer | Source | Mode |
|---|---|---|
| `main.tsx` | `/datos/club.bundle` → `loadBundle` (matches, players, seasons, mvpResults, clubContent). CDN `max-age=300, swr=86400`; SW `StaleWhileRevalidate` | 1x accelerator into the IndexedDB cache |
| `main.tsx` (SSR pages) | `primePublicData` waits ≤4 s for the first snapshot of matches/players/seasons/content before hydrating | RT-shared |
| `AuthContext` | `users/{uid}` | RT (raw) |
| `TeamContext` | `teamMembers/{uid}`, `accessRequests/{uid}` | RT (raw) |
| `SeasonProvider` | `seasons` (key `["seasons"]`) + `localStorage.selected_season_id` + `?season` (SeasonUrlSync) | RT-shared |
| `LiveIsland` (all non-admin routes) | `useClubData()` → `matches` + `players` | RT-shared; `useClock(15 s)` |
| Firestore SDK | `persistentLocalCache` + multi-tab | warm cache, latency compensation |

| Route | Reads | Mode / notes |
|---|---|---|
| `/` Home | `useClubData` (matches, players), seasons, `useClubContent` (clubContent/main, own unshared listener), `useMatchClock` | RT. **SSR** (CDN 60 s + SWR 24 h). No mvpResults in SSR seed |
| `/partidos` | `useClubData`, seasons, `useClock(60 s)` page / `15 s` board / `1 s` countdown | RT. SSR |
| `/matches/$matchId` | `useClubData`; members: `useMatchScorers` (`doc:matchPrivate/{id}`); tabs: `useAvailability`, `useMeetingNote` (`doc:matchPrivate/{id}` again), `useMyPrediction`, `useMatchPredictions`, `useMvpResults`, `useMyMvpVote`; `useWeather` | RT; weather via TanStack 1x (1 h). Not SSR |
| `/stats` | `useClubData`, seasons, `useMvpResults` | RT. SSR (no MVP data server-side) |
| `/plantilla` | `useClubData`, seasons; `now` frozen at mount (`useState(Date.now)`) | RT. SSR |
| `/jugadores/$playerId` | `useClubData`, seasons, `useMvpResults` | RT. `detailQueries.ts` (1x loaders) are **dead code** |
| `/club` | `useClubContent`, `useClubData`, seasons | RT. SSR |
| `/vestuario` | `useClubData`, seasons, `useAvailability(next)`, `useMeetingNote(next)`, `useMvpResults`, `usePorraStandings`, `useOpenTrainings` (re-query per 10 min bucket), `useTrainingVotes`, `useBoard(8)`, `useMyClaim`, `usePlayerLinks`, `usePendingClaims`, `useHasPosted`; captains: `useDoorRequests`, `useInvites`, `useTeamMembers`, `useClubPeople` | RT-shared (vestuario `useShared` registry, separate from the TanStack one) |
| `/pizarra` | `usePizarraPlayers` (players), `usePizarraStats` (matches), `useClubData`, `useMvpResults`, `useLineups(season)` (`["lineups",season]`), `useReactions` (`lineups/{id}/reactions`, admins also `users` as `["pizarraPeople"]`), `useConvocatoria` → `useAvailability`, `useVozStore` (`lineups/{id}/voz`); `publishOfficial` uses `getDocs` (1x) inside a txn; `clearReactions`/`vozStore` 1x `getDocs` for deletes | RT-shared; own `useMatchClock` in `v2/useMatchDay.ts` (name collides with `hooks/useMatchClock`) |
| `/profile` | `useProfileData`: `useClubData`, seasons, `useMvpResults`, `useMyClaim`, `useMembership` (`doc:teamMembers/{uid}`, a second listener on the TeamContext doc), `useNicknameOf`, `usePlayerLinks`, `useLineups(currentSeason)`, `usePorraStandings`, `useAvailability(next)`, `useDoorRequests`, `usePendingClaims`; **1x** `useSeasonAnswers` (`getDoc` per match `matchPrivate/*/availability/{uid}`, staleTime 5 min; only the next match is overlaid live) | Mostly RT; past RSVP answers 1x |
| `/admin/*` shell | `useAdminData`: `useClubData`, seasons (incl. archived), `matchDrafts` (`["matchDrafts"]`), `usePendingClaims`, `useClubPeople` (`users`), `useDoorRequests`, `useAvailability(next)`, `useMeetingNote(next)`, `useMvpResults`, `useClubContent`, content drafts (localStorage per captain), `whistleStore` (localStorage, now only read) | RT; `useMatchClock(merged)` |
| `/admin` Hoy, `/admin/en-juego/$id` | `useAdmin()` + `liveEvent`/`controlMatchClock` callables | RT; callables resolve, then the snapshot updates the UI |
| `/admin/partidos/$id` | `useMatchNote` (`doc:matchPrivate/{id}`), `Scorers` → `useMatchScorers` (**same key**), `useMatchMvp`; save via `saveMatchSheet` | RT; edit buffer adopts server changes only while clean |
| `/admin/convocar` | `useAdmin`, `useMatchRsvp` (availability), `useReminders` (`convocatoriaReminders/{id}`, raw onSnapshot) | RT; local overlay until `convocatoriaAt` echoes |
| `/admin/fichas` | `useAdmin`, `useClaimsLog` (`playerClaims`, raw unshared), `useMembersVia` (`teamMembers`, raw unshared, a 2nd listener vs vestuario `useTeamMembers`) | RT |
| `/admin/plantilla` | `useAdmin`; optimistic `setQueryData` on `["players"]` (`useAdminMutations`) | RT + optimistic patch |
| `/admin/temporadas` | `useAdmin`, `useMvpTally`, `useArchivedCounts` (`getCountFromServer`, 1x) | RT + 1x counts |
| `/admin/capitanes` | `useAdmin` (people) | RT |
| `/admin/contenido` | `useLiveClubContent` + device-local drafts | RT; drafts not shared between captains |
| `/invitacion/$code` | `inviteInfo` callable (TanStack 1x, 60 s), `doorShirts` callable (1x, 30 s, invalidated on welcome), TeamContext live | 1x + RT door state |

Server side: `functions/src/bundle.ts` builds the bundle, memoized for 30 s per instance. `api/render.js`
renders `/`, `/partidos`, `/stats`, `/club` and `/plantilla` with CDN `max-age=60, swr=86400`. Triggers:
`pushOnMatch`, `pushOnLineup`, `tallyMvp`, `pushOnAnswer`. Every 5 min: `pushKickoff`, `pushReminders`
and `flushSevens`. No trigger feeds the client except through Firestore docs.

---

## (b) Findings

### HIGH

#### H1. Shared-listener key collision on `doc:matchPrivate/{id}`: scorers and the meeting note corrupt each other
- **Evidence:** `src/pages/vestuario/live.ts:107-109` (`useMeetingNote` → key `doc:matchPrivate/${id}`, maps `meetingNote` → string). `src/pages/vestuario/live.ts:342` (`useMatchScorers` → **same key**, maps `scorerUids` → string[]). The registry calls `start` only for the first reader (`live.ts:44`, `entry.stop ??= start(...)`), so the first hook mounted decides the shape for everyone.
- **Where they meet:**
  - `/vestuario` (`VestuarioPage.tsx:73`, meeting note of the next match), then the user taps that match (`MatchPage.tsx:79-80`) within 60 s. `scorers.data` is the note string, `"...".includes(uid)` is false, and a designated scorer gets **no Banda / clock control on match day**.
  - `/matches/$id`: `MatchPage` subscribes first. When the user opens the «Vestuario» tab, `Tabs.tsx:421` receives `string[]`, and `Tabs.tsx:497-499` renders the array (empty chip, or the scorers' uids as text). Going back to `/vestuario` shows the same in `Hero.tsx:156`.
  - Admin: `useAdminData.ts:166` (next match) and `Partidos.tsx:268` open the note first, then `MatchEditor.tsx:298` → `Scorers.tsx:9,14,20` gets a string. Checkmarks never show. Adding spreads the note's characters (`[...selected, uid]`), which the server rejects. Removing throws `selected.filter is not a function`.
- **Symptom:** designated scorers can't score. The admin can't manage scorers for the next match. Uids leak into the UI.
- **Fix:** key by path **and** projection (`doc:${path}#meetingNote` / `#scorerUids`). Better: one `useMatchPrivate(id)` that maps the whole doc `{ meetingNote, scorerUids }` and two thin selectors over it. Add a dev assertion in `useShared` that the same key is never started with a different `start`/`map`, plus a test that mounts both hooks on one id.

#### H2. Partidos season `<select>` snaps back after the first change (context/URL desync)
- **Evidence:** `PartidosPage.tsx:331` calls `setSelectedSeasonId` directly. `SeasonUrlSync.tsx:36-37` treats the URL as the source of truth and re-adopts `?season`. The first change works because there is no `?season` yet and the effect seeds it. The second change hits `urlSeason !== selectedSeasonId` and reverts to the URL value. `MatchCenter.tsx` (dead code) documents exactly this pitfall.
- **Symptom:** on /partidos you can switch season once. Every later pick, including «Todas», jumps back.
- **Fix:** navigate like the Stats selector does: `navigate({ to: ".", search: (p) => ({ ...p, season: id }) })`. Longer term, make `setSelectedSeasonId` itself navigate, or keep it private to `SeasonUrlSync`, so no page can desync.

#### H3. v2 matches whose clock never starts never go live, and the surfaces and push disagree about it
- **Evidence:** `saveMatchSheet` always stores `clock: readyClock()` (`functions/src/index.ts:256`). `matchPhase` returns `"scheduled"` for any `clock.phase === "ready"` regardless of time (`functions/src/matchEngine.ts:350-353`). The home page handles this with «Pendiente del pitido inicial» (`MatchHero.tsx:70`). `MatchPage.tsx:195,249` and `PartidosPage.tsx` (board, `<Countdown>` at :143) show a **00:00:00:00 countdown** and «ESTA SEMANA» indefinitely. `pushKickoff` (`functions/src/push.ts:145-160`) sends «¡Empieza el partido! Sigue el marcador en directo» from the **scheduled date**, without checking the clock.
- **Symptom:** members get «¡Empieza!» and open a page with a frozen zero countdown, no LiveIsland and no «EN DIRECTO». If nobody starts the clock, the match stays «next» on Home, Partidos, Perfil and the pizarra until the acta is published, and `nextFixture` keeps returning it. If the clock starts 20 minutes late, the push was early. If it never starts, the push was wrong.
- **Fix:** a single `kickoffState(match, now)` helper in `matchEngine` that returns `"pending_whistle"` when `date <= now` with a ready clock. Use it in Home, Partidos, MatchPage and the island (copy: «A punto de empezar / pendiente del pitido»). Send the `start` push from `pushOnMatch` on the `clock.phase` `ready → first` transition, and keep the scheduled job only for legacy non-clock matches. Optionally, after `date + duration + 2 h` with a ready clock, treat the match as `awaiting_result` so it stops being «next».

### MEDIUM

#### M1. A stale cached snapshot fires a false «¡GOL!» on load
- **Evidence:** `GoalBurst.tsx:17-19` fires when `goals > seen` after the first render. The first render can come from the IndexedDB cache or from a bundle up to 5 min old (or 24 h with SWR) (`bundle.ts:42-43`, `vite.config.ts` `piti-data` SWR). The server snapshot then raises the count. The `Flip` digits on the island and the board also animate.
- **Symptom:** opening a live match after being away plays confetti and «¡GOL!» for a goal scored long ago.
- **Fix:** expose `metadata.fromCache` from the bridge (`subscribeShared` with `includeMetadataChanges`) and arm GoalBurst only after the first non-cache snapshot. Alternatively, fire only for goal events whose `elapsedSeconds` is within about 2 min of the live clock.

#### M2. No «offline / cached» signal; live surfaces tick over frozen data
- **Evidence:** no use of `fromCache`, `hasPendingWrites` or `onSnapshotsInSync` anywhere in `src`. The minute is computed from the device clock (`liveMinute`, `MatchClockDisplay`), so it keeps advancing while the score is frozen. Only the pizarra has `useOnline` (`pizarra/v2/online.ts`).
- **Symptom:** on a weak touchline connection the island, ficha and home show «EN DIRECTO 38′ · 1–0» while the real score is 2–1. Nothing tells the user.
- **Fix:** a global `useSyncStatus()` built on `navigator.onLine` plus the `fromCache` of the `["matches"]` snapshot. Show «Sin conexión · marcador de hace X min» in the island, the match board and the admin LED. Promote `useOnline` from the pizarra to a shared hook.

#### M3. Device-clock skew changes the live minute per phone
- **Evidence:** `clock.firstStartedAt` and the other clock fields are server `Date.now()` (`functions/src/liveClock.ts`). Clients compute `clockReading(clock, Date.now())` (`matchClock.ts:14-19`, `partidos.ts:104-110`). Events are stamped with server minutes (`live.ts`).
- **Symptom:** a phone 90 s off shows 17′ while the log says «19′ · Gol». Scorers on two phones see different minutes.
- **Fix:** estimate the server offset once. Use the `Date` header of `/datos/club.bundle`, or return `serverNow` from `controlMatchClock` and `liveEvent`. Use `Date.now() + offset` in `useClock`.

#### M4. Admin acta editor: silent divergence while dirty during a live match
- **Evidence:** `useEditBuffer.ts:38-39` adopts server changes only when the buffer is clean. During the match the default tab is `acta` (`Partidos.tsx:283`). Every `liveEvent` bumps `revision` (`functions/src/live.ts:86`). `saveMatchSheet` then refuses with «Otro administrador ha actualizado este partido. Recarga» (`functions/src/index.ts:158-162`). There is no «changed on the server» banner, unlike Contenido (`ContentDrawer.tsx:137-140`).
- **Symptom:** a captain fixing the acta while a scorer writes live stops seeing new events and only learns of the conflict when the save fails.
- **Fix:** show a «Han llegado N jugadas nuevas desde que empezaste a editar · Incorporarlas» bar whenever `serverSig !== state.src && dirty`. Merge by event id: live events are append-only with unique `live-*` ids.

#### M5. Derived stats disagree between pages
- **Minutes:** `/stats` and `/jugadores` count only ledger-tracked minutes (`clubAnalytics.ts:113-122`, `statsView.ts:196`). The pizarra cromos, the perfil card «MIN» and the admin cromos assume **full duration** when an old acta has no ledger (`pizarra/v2/ratings.ts:84,137`, `g.minutes ?? (g.played ? d : 0)`). The same player gets different minutes wherever a season includes legacy actas («all» on the pizarra, older seasons).
- **Position «Valoración»:** `/jugadores` passes `mvpOf` (`JugadorPage.tsx:77-84,371`). The `/plantilla` ficha (`FichaModal.tsx:52`), perfil «Dónde has jugado» (`useProfileData.ts:210`), stats positions (`stats/Posiciones.tsx:94`) and admin plantilla (`admin/views/Plantilla.tsx:146`, which also passes merged **drafts**) don't. The same player at the same position shows different ratings.
- **«Season»:** the Partidos hero, Home, Vestuario, Perfil and Admin use a «current season» derived from the next fixture (`vestuario.ts currentSeasonId`, `useAdminData` seasonId). Stats, Jugador, the pizarra and the Partidos *list* use the selected season. Plantilla mixes both (`SquadPage.tsx:43-44`). «Next match» also differs: admin includes drafts (`mergeMatches`), the pizarra is limited to the selected season.
- **Fix:** one `src/lib/derived/` module that owns `minutesOf(row|match)`, `positionLines(pid, games, { mvps })` with MVPs always on, and `useCurrentSeason()`. Every page calls these. Add cross-page parity tests: same fixture in, same number out, for perfil card vs stats vs jugador vs pizarra.

#### M6. Two «sevens»: the pizarra official board and the convocatoria are separate sources of truth
- **Evidence:** the official seven lives in `lineups` (`isOfficial`, `lineupOfficials`) and pushes «Ya está el siete» (`pushLogic.ts:137`, linking to `/pizarra`). The convocatoria's `starters` lives on `matches/{id}` and pushes «Ya está la convocatoria» (`pushLogic.ts:164`). The two are synced only by a manual button (`Board.tsx:2818`, `convocatoriaFromBoard`). The match page `CampoTab` shows `match.starters` only (`Tabs.tsx:223-235`). `saveMatchSheet` reads positions from the official board.
- **Symptom:** members can get two different «el siete» notices for the same match. The match page can show a different seven from the pizarra.
- **Fix:** publishing the official board for a match offers (or performs) the convocatoria sync in the same flow, through a `setConvocatoria` call. The match page shows a «Siete oficial de la pizarra» badge when they differ, and the pizarra flags when the convocatoria disagrees.

#### M7. Nicknames are denormalised and never back-filled
- **Evidence:** `setNickname` (`functions/src/profile.ts:12-35`) updates only `users`, `nicknames` and a pending claim. The old handle stays in `availability.name`, `votes.voterName`, `predictions.name`, `porraStandings.rows[].name`, `board.name`, `trainings/*/votes.name`, `lineups.ownerNickname` and `accessRequests.name`.
- **Symptom:** after a rename, the vestuario RSVP list, porra table, tablón, pizarra «de @…» and captain lists keep showing the old name. The member's own perfil shows the new one.
- **Fix:** render names by `uid` through one shared live `users` map, which is already listened to for admins, or through a small public `members/{uid}` projection. Alternatively, add an `onDocumentWritten(users/{uid})` trigger that rewrites the name in those collections (bounded: one club).

#### M8. Push subscriptions die silently
- **Evidence:** `public/push-sw.js` has no `pushsubscriptionchange` handler. The topics live in `localStorage` (`lib/push.ts:33-66`). The server deletes the doc on 404/410 (`functions/src/push.ts:77-78`). Nothing re-asserts the subscription on app start. Only the perfil notices a dead subscription (`usePushDevice.ts`).
- **Symptom:** after a browser rotates keys or a 410, a member who never revisits /profile stops getting goal and convocatoria notices with no sign of it.
- **Fix:** handle `pushsubscriptionchange` in the SW (re-subscribe, then call `pushSubscribe` with the saved topics via `postMessage` or IndexedDB). On app boot, when the saved topics are non-empty, compare `getSubscription()` with `localStorage` and silently re-call `pushSubscribe`, at most once a day.

#### M9. Push coverage gaps around the live match
- **Evidence:** `noticesFor` (`pushLogic.ts:62-108`) covers goals, the final at **acta publication**, MVP opening and date changes. Missing:
  - Final whistle at clock `ended`. Today the «final» push waits for the acta, which can be hours later.
  - Goal undone or annulled. The «¡GOL!» notice stays on phones.
  - Red cards and the half-time / second-half transitions.
  - MVP winner when `voteClosesAt` passes.
  - Personal notices: ficha claim approved, positions reviewed.
- **Fix:** extend `pushOnMatch` with `clock.phase` transitions (`first`, `halftime`, `second`, `ended` → «Final (provisional) 2–1»). Send «Gol anulado» with the same `goal-${id}` tag so it replaces the notice. Add an «MVP de la jornada» step to the 5-minute job, and personal-topic notices from the `players` and `playerClaims` triggers.

#### M10. Optimistic admin patches can roll back over newer realtime data
- **Evidence:** `useAdminMutations.ts:95-103,117-127` snapshots `prev` in `onMutate` and restores it in `onError`. A realtime snapshot that arrives in between is overwritten. `mergeById` also writes raw payloads (sentinels, nulls) into the validated cache slot. The Firestore SDK already applies latency compensation with the persistent cache.
- **Symptom:** after a rejected write (rules, sanction validation), the player list can briefly show stale data from another captain's edit. Rare, but confusing.
- **Fix:** drop the TanStack optimistic layer for Firestore-backed keys. Local writes already fire `onSnapshot` with `hasPendingWrites`, and a refused write rolls back by itself. Keep the toast-level «guardando…» from `hasPendingWrites` instead.

### LOW

- **L1. Three listener registries plus raw listeners.** `useFirestoreCollection` (TanStack), the vestuario `useShared` (`useSyncExternalStore`) and raw `onSnapshot` in `clubLive.ts:37-48`, `reminders.ts:22`, `useClubContent` (`publicData.ts:24-30`, one listener per consumer) and the contexts. Duplicates: whole-collection `users` (`["pizarraPeople"]` in `useReactions.ts:68-70` vs `query:users`), `teamMembers` (`useMembersVia` vs `useTeamMembers`), `teamMembers/{uid}` (TeamContext vs `useMembership`). Fix: one `liveStore` with typed keys (path + mapper id) used by all; H1 cannot happen with typed keys.
- **L2. Dead listeners never retry.** On a snapshot error the entry keeps its dead `unsub` until every reader leaves and 60 s pass (`useFirestoreCollection.ts:81-86`, `live.ts:44-56`). `handleSnapshotError` also sets `[]`, which looks like «no data». Fix: on error, drop the registry entry so the next mount resubscribes, keep the last good data and surface `error`.
- **L3. SSR/bundle seeding lacks `mvpResults`.** It is in the bundle but not set by `entry-server.tsx:39-43`, and `primePublicData` does not wait for it (`publicData.ts:38`). MVP badges pop in after hydration on /stats and /plantilla. The SSR HTML can be up to 24 h stale (SWR) for 4 s on rarely-visited pages. Fix: seed `["mvpResults"]` and add it to the prime keys. Consider `swr=600` for HTML on match days.
- **L4. Clocks disagree by surface.** Island 15 s (`LiveIsland.tsx:16`), Partidos page 60 s (`PartidosPage.tsx:177`), board 15 s, MatchPage exact boundaries (`useMatchClock`), pizarra its own `useMatchClock` (`useMatchDay.ts`). `liveMinute` is 0-based with a clock and 1-based without (`partidos.ts:104-110`). The island and board progress bars use `duration ?? 50` while `liveUntil` uses `max(60, …)`, so legacy matches sit at «50′» for 10 min. `isCompleted` uses `Date.now()` internally instead of the caller's `now`. `SquadPage` freezes `now` at mount (`SquadPage.tsx:42`). Fix: one `useNow()` context that ticks once per second while anything is live and once per minute otherwise, plus one minute convention.
- **L5. `CampoTab` recomputes the ledger every second even for finished matches** (`Tabs.tsx:228-230`). Use `useClock(live ? 1000 : 0)`.
- **L6. Time windows enforced by rules but not by the UI clock.** The porra closes at kickoff via the rules (`firestore.rules` `upcoming()`), while the vestuario ticks every 60 s and the match tab every 30 s, so a late write is refused with a generic error. Captain invites: the `expiresAt > now` filter is captured at subscribe time (`live.ts:298-303`) and `useCaptainDoor.ts:83` does not filter expired invites.
- **L7. Profile «tus convocatorias» for non-next matches are one-shot** with a 5 min staleTime (`useProfileData.ts:108-123`). An answer given from a match page for a later match shows late. Fix: a collection-group listener on `availability` where `uid == me`, or overlay `useAvailability` for every upcoming match.
- **L8. Dead data paths.** `lib/detailQueries.ts`, `pages/MatchCenter.tsx`, `pages/Landing.tsx` (`getDocs` 1x) and `pages/Vestuario.tsx` are not routed. `whistleStore` is never written now, only read. Remove them so nobody copies their patterns.
- **L9. Admin `mergeMatches` lets draft `events` override published live events** when the clock is `ended`, or for legacy `liveEndedAt` matches (`adminLogic.ts:61`, which protects only running phases). EnJuego and Hoy can show a stale draft log after the whistle.
- **L10. Accessibility of live changes.** The island pill has no `aria-live`. The admin toasts (`pages/admin/ui/toasts`) and public `sonner` are two separate toast systems with no cross-page announcements.

---

## (c) «Make it feel live» opportunities

| # | Opportunity | Effort |
|---|---|---|
| 1 | **Global goal moment.** When `["matches"]` brings a new scoring event from a server snapshot (not from cache), show a GoalBurst/toast on *any* page through the LiveIsland («¡GOL! ERIK 19′ · 2–1»), with haptics and reduced-motion fallback. Reuses `lastEvent` and the `pushLogic.liveScore` rules. | S |
| 2 | **Island lifecycle.** «A punto de empezar» (pending whistle, H3) → live → «Descanso» → «FINAL 2–1 · acta pendiente» kept for about 30 min → «Vota al MVP» CTA while the vote is open. Today it simply vanishes at the whistle. | S |
| 3 | **Sync/offline chip** (M2) in the island, match board and admin LED: «En directo», «Reconectando…», «Sin conexión · hace 3 min». | S |
| 4 | **Server-time offset** (M3) so every phone shows the same minute. | S |
| 5 | **Live porra.** During the match, show the provisional porra standings from the live score (pure function over the predictions already readable after kickoff plus `scoreOf`). | M |
| 6 | **Provisional stats.** /stats and /jugadores show a «+1 en directo» ghost row (goals and assists from live events, `matchSnapshot` minutes) until the acta is published. | M |
| 7 | **Presence («están viendo»).** A lightweight `presence/{matchId}/viewers/{uid}` heartbeat or RTDB `onDisconnect`. Use it for «12 viendo el partido» on the match page, «Adrián está editando el acta» in admin (closes M4) and «Erik tiene la pizarra abierta». | M |
| 8 | **Live MVP race** on the match page while voting is open (counts are already public in `mvpResults`), and the winner reveal plus push at `voteClosesAt` (M9). | S |
| 9 | **One live store** (L1/H1): typed keys, metadata (`fromCache`, `pendingWrites`), retry on error, one registry. Makes 1–3 trivial and stops the class of bug in H1. | M |
| 10 | **Unified «season» and «now» contexts** (M5/L4): `useCurrentSeason()` and `useNow()` shared by every page, so Home, Partidos, Plantilla, Perfil and Pizarra always agree on what «this season» and «the next match» mean. | M |
| 11 | **Push completeness** (M8/M9): SW resubscribe, clock-driven start, half-time and final, «Gol anulado», MVP winner, personal «ficha aprobada» and «posiciones revisadas». | M |
| 12 | **Nickname by uid** (M7), so a rename shows everywhere at once. | M |
| 13 | **«Siete» single flow** (M6): publishing the official board also syncs the convocatoria and sends one notice, and the match page shows it. | L |
