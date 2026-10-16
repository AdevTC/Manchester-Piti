# La mesa: live match management, design

Date: 2026-10-16. Approved visual design: the Design canvas «La mesa · partido en vivo»
(https://claude.ai/artifact/9GSjpBG49VWf1ewuyGHgr6). It has eight artboards: En juego (a clickable
prototype), Antes del pitido, Lo que va pasando, Sin cobertura, Descanso, Final, and Lo que ve la
afición on phone and on desktop. The canvas is the visual source of truth. This document is the
behavioural one.

## Intent

During a match, one person (an admin, or an «anotador» assigned to that match) holds a phone on the
touchline and records everything that happens. The site has to make that fast, error-proof and
pleasant, keep two scorers perfectly in sync, survive a dead signal, and feed every other screen that
shows match data (the match page, the live island, home, the vestuario, stats, the acta).

Today the work is split across four overlapping surfaces:
- the «Mesa de partido» panel embedded in the public match page (`src/pages/match/Banda.tsx`, with
  its two modes, «Banquillo rápido» = `QuickMatchEntry` and «Con detalle»);
- the admin's «En juego» (`/admin/en-juego/$matchId`, `src/pages/admin/views/EnJuego.tsx`);
- the pizarra's Cambios (`src/pages/pizarra/v2/useCambios.tsx`).

They show 14 equal-weight buttons, offer only a one-step undo, never record who did what, and lose
plays when the signal drops. **La mesa replaces all of them with one screen and one data path.**

## Goals

1. **One full-screen scoring screen («La mesa»)** on its own route, phone-first, used by admins and
   anotadores. It is reached from the match page («Abrir la mesa», shown only to people who can
   score), the admin (Hoy / Partidos, where «Abrir En juego» is today) and the pizarra.
2. **Record everything relevant, in at most two taps.** Details (assist, how a goal came) can be added
   afterwards.
3. **Two scorers in perfect sync.** They see the same plays, the same clock and each other's presence.
   Possible duplicates are caught. Any play can be fixed or deleted, and every change shows its author.
4. **Offline-proof.** Scoring never waits for the network. Plays queue on the phone (surviving a closed
   tab), upload by themselves in order, and keep the minute at which they were tapped.
5. **Full permissions for the anotador on their match:** score, fix, delete, pause, end halves, close,
   reopen and publish the acta. Everything is logged under the person who did it.
6. **Perfect integration.** Every screen that shows match data reads the same events, including the
   new types: the match page (mobile and desktop), the live island, home, the vestuario, the acta, the
   player page and stats.

## Event catalogue

All events live in the match's existing `events` array and go through the existing `liveEvent`
callable path. «Ours» events carry `playerId`. Rival events carry no player.

| Event | Ours / rival | Notes |
|---|---|---|
| Gol | ours | `playerId`; optional `assistPlayerId`; optional `goalKind`: jugada, penalti, falta, autogol del rival |
| Gol (pendiente de goleador) | ours | «Lo apunto luego»: counts on the scoreboard, and the scorer is filled in later; the acta flags it |
| Autogol del rival | ours | counts for us |
| Gol del rival | rival | |
| Al palo | both | ours carries a player |
| Ocasión | both | ours carries a player |
| Parada | ours (goalkeeper only) | |
| Falta hecha / Le hacen falta | ours | carries a player |
| Falta del rival | rival | |
| Córner | both | already exists |
| Penalti a favor / en contra | both | with result: gol, fallado, parado (penalti parado already exists) |
| Fuera de juego del rival | rival | |
| Amarilla / Roja | both | a second yellow becomes a red, as today |
| Cambio | ours | `inPlayerId` / out player; unlimited rolling subs; the player who came off can come back |
| Tocado (lesión) | ours | a note on the player; does not remove them from the pitch |

Shots and offsides as our own separate plays are out. So are rival player names.

## How the match runs

- **Clock:** the existing server clock (`functions/src/matchClock.ts`) with three additions:
  - **Pause / resume inside a half.** Paused time doesn't count towards minutes played.
  - **Stoppage time («añadido»):** a per-half number the scorers raise and lower with a «− +N′ +»
    stepper. **It is only a label** shown to everyone. It never changes the clock or the minutes, and
    it never ends a half.
  - **Ending a half stays manual.** At the configured half length (25′ today) the screen suggests «Fin
    1ª parte», but nothing happens until someone taps it.
- **Minutes played** come from the clock and the substitutions, as now, including multiple stints per
  player.
- **Halftime:** only subs and cards are accepted, as now.

## Two scorers

- Every event records `byUid`, and `editedByUid` and `editedAt` when it changes. «Lo que va pasando»
  shows them («David · corregido por Pablo»). `matchAudit` keeps the full trail.
- **Fix or delete any play** from the record (swipe: Corregir · Borrar), not just your own or the last
  one. Corregir lets you change the player, the type, the minute and the details. The lower-third
  «Deshacer» deletes the play just entered.
- **Presence:** la mesa shows who else has it open («2 anotando · al día», «David también está
  apuntando · ahora»). A heartbeat of about 30 s is enough.
- **Possible duplicates:** when two scorers record the same type for the same player (or the same
  rival type) within about 30 s of each other, both phones show «¿Es la misma jugada?», with «Es el
  mismo» (delete the later one) and «Son dos» (keep both, and stop asking). Until someone resolves it,
  the later event is marked pending and is shown, and counted, as a single play.
- **Concurrency:** the existing transactional callable and `revision` checks stay. Integration tests
  must cover:
  - two phones scoring at the same time;
  - one phone offline that reconnects with a queue;
  - both phones editing the same play.

## Offline

- Plays go into a persistent queue on the device (it survives closing the tab or app, and is shared
  across tabs). Each queued play carries its idempotent `requestId` and **the elapsed match time at the
  moment it was tapped**.
- The queue uploads by itself, in order, when the connection returns. A play is never blocked by a
  previous pending one.
- The server accepts the tapped time for queued plays, validating it against the clock (it must fall
  inside the half's play window), so offline plays keep the right minute.
- **The screen stays the normal in-game screen.** The scoreboard gets an amber edge and a strip («N
  jugadas guardadas en el móvil. Se suben solas al volver la señal.»). A «Sin red» chip sits in the
  header, players with plays not yet uploaded carry a «sin subir» tag, and the last-play line shows «en
  el móvil». Nothing is hidden.
- The clock keeps ticking locally from the last known server state.

## On the pitch

- The screen stays awake (Wake Lock) while la mesa is open during a match, and re-acquires the lock
  when the page becomes visible again.
- A short vibration on every recorded play, where supported.
- Targets of at least 44 px, built for one thumb.
- The design reads in full sun with the existing night theme.
- Reduced motion is respected throughout: static end states and no flashes.

## The screens (see the canvas for the look)

- **Antes del pitido:**
  - the seven from the official pizarra board, or convocatoria (with «Cambiar»);
  - the bench;
  - who is scoring;
  - «la pantalla no se apagará»;
  - «Pitar el inicio» (the gold CTA), and optionally «Avisar al vestuario».
- **En juego:**
  - Header: back, both full team names, a live line, and the presence and sync chip.
  - **LED scoreboard:** crest plus a short code for each side, `PITI · 2–1 · ATL`, in fixed columns so
    nothing can overlap. The rival code comes from the rival's name and can be overridden per rival.
    Below it: the half, the clock and the stoppage-time label. The progress bar runs to the half
    length. «¡GOOOL!» flashes on our goal.
  - Clock row: Pausa/Seguir, the stoppage-time stepper, and Fin de parte.
  - **The pitch card:**
    - the 7 on the pitch as shirts in formation, each with name, minutes, and stickers for goals and
      cards;
    - the **Banquillo** strip below the touchline, fitting 5 across and scrolling sideways beyond that,
      with a count and a «N sin jugar» hint, and per player «sin jugar» or «fuera N′».
  - Tap a player for an action sheet: big Gol, then Al palo, Ocasión, Parada (goalkeeper only), Tocado,
    Hace falta, Le hacen falta, Cambio, Amarilla, Roja.
  - Tap someone on the bench for «¿Por quién?».
  - Rival row: Gol, Falta, Palo, Córner, and «···» for Ocasión, Amarilla, Roja, Penalti en contra,
    Penalti a favor and Fuera de juego.
  - Bottom dock: the last-play line (linking to the record) and the gold «GOL del Piti» CTA, which
    opens «¿Quién marcó?» with the on-pitch players, «Autogol suyo» and «Lo apunto luego».
  - Every save shows the lower-third strap, with «Deshacer», and for goals assist chips for one-tap
    assists.
- **Lo que va pasando:** a compact scoreboard, filters, the presence line, the duplicate card, and every
  play with its author and edits, split by half.
- **Sin cobertura:** as described under Offline.
- **Descanso:**
  - an amber «DESCANSO» on the LED, with a ticker of the half;
  - first-half stats as mirrored bars (ocasiones, palos, paradas, faltas);
  - «Quién ha jugado», a timeline per player showing stints on and off, with players who haven't played
    in amber;
  - «Preparar el siete de la 2ª» and «Arrancar la 2ª parte».
- **Final:**
  - a gold LED, the result word («Victoria / Empate / Derrota»), and a stamp with the league effect when
    standings exist;
  - goals with their assist, and inline «¿Le dio el pase alguien?» chips for goals without one;
  - a preview of what publishing triggers (stats, ranking, logros, Vota al MVP);
  - «Publicar el acta» (the CTA), «Reabrir el partido» and «Ver las N jugadas».
  - Publishing uses the same pipeline as `saveMatchSheet`, now allowed for the match's anotadores (see
    Decisions).
  - **«Reabrir el partido»** (user decision): an anotador can only reopen before the acta is published,
    by undoing the final whistle. Reopening a published acta, which recalculates stats, ranking and
    logros and resets the MVP vote, stays admin-only.

## Integration with the rest of the site

- **Match page, phone and desktop** (canvas «Lo que ve la afición»): the embedded scoring panel goes,
  replaced by an «Abrir la mesa» button for scorers. The hero and the tabs keep today's structure. On
  desktop the scoreboard card takes the phone card's look (the lit sky-blue card, crests with names
  underneath, the large digit tiles, the «last play» line), and the date and kit chips plus the action
  buttons sit under the title, so nothing overlaps.
  - **Directo:** shows the new types with filters (Todo · Goles · Ocasiones y palos · Faltas y tarjetas
    · Cambios), split by half.
  - On desktop, a side column shows «El partido en números» (mirrored bars) and «Ahora en el campo».
  - **Pulso** adds faltas, paradas and palos.
  - **Campo** gets the new stickers.
- The live island, home («Hoy»), and the vestuario's match blocks keep working from the same events.
  New types appear wherever a «last play» line exists.
- **Stats:** the new per-player types (palos, ocasiones, paradas, faltas hechas y recibidas) flow into
  the ledger built at publish time. They show on the jugador page and in Estadísticas where a column or
  stat fits; placement is the builder's call, following the existing stats design.
- **Push:** no new notification types. The existing ones (pitido, goles, gol anulado, descanso, 2ª
  parte, final) keep working, and fouls, chances and the like never push.
- **Old surfaces:** they are removed once la mesa covers them. That covers `Banda`, `QuickMatchEntry`
  and its recovery, and the En juego pads; the admin entry points link to la mesa. `LIVE_ACTIONS`
  becomes the single catalogue (today `QUICK_ACTIONS` is a separate list).
- **The pizarra's Cambios planner stays** (user decision): waves, «Repartir minutos», «Rotar portero».
  - Its live «hacer el cambio» uses the same event path as la mesa, including the offline queue and
    authorship. Planned waves are sent as one operation, never a loop that can leave a half-applied
    result.
  - La mesa shows the next planned sub from the official board («Toca: entra Hugo por Pablo») as a
    one-tap action above the bench.

## Non-goals

- Shots and offsides as our own plays, and rival player names.
- Video, heat maps, positional tracking.
- New push notification types.
- Automatic end of halves.
- A redesign of the match page beyond what is listed above.

## Anti-goals (a failure even if it works)

- A play lost because the signal dropped or the screen closed.
- Two scorers seeing different scores, or a goal counted twice without anyone being asked.
- Anything common taking more than two taps, or the scorer having to look away for more than about two
  seconds.
- A scoreboard or name that overlaps or clips at any width.
- Losing sight of the pitch while offline.

## Constraints

- Stack and rules: AGENTS.md (Spanish-first copy, mobile-first, WCAG 2.1 AA, reduced motion, no status
  by colour alone) and DESIGN.md (Celeste tokens; the Sala de control's broadcast objects: one LED
  object, 4 px lower-third straps, pills, inset hairlines).
- `matches/{id}` takes no client writes. All live writes go through callables. Keep `events` on the
  match document (the 2500-event cap and the 1 MB document limit are far beyond a match's ~100 plays).
- Firestore and functions are in europe-southwest1. Tests use the emulators and never production.
- Deploy rules and functions before (or together with) the client that needs them.

## Decisions taken after the builder check (Claude's calls, open to change)

- **Queued plays the server can't accept are never dropped and never forced in.**
  - Queued plays are validated against their tapped time, not the current clock revision. A pause or a
    half ending after the tap doesn't invalidate them.
  - Only a real conflict is rejected: the match was already closed or published, the player was
    subbed off or sent off by the other phone, or the time is outside the play window.
  - A rejected play lands in a «Por revisar» tray in la mesa (amber, with a count). There the scorer
    fixes it (player, minute) and resends it, or discards it, with the reason in words.
  - Publishing is blocked while the tray or an unresolved duplicate has items.
- **Publishing from la mesa uses a narrow callable**, not the full `saveMatchSheet` payload. An anotador
  can publish only their match's acta, and only from the live record: events, assists, lineup and
  minutes. Rival, date, season and convocatoria stay admin-only. Under the hood it reuses the same
  ledger, positions and MVP pipeline.
- **«Cambiar» on Antes del pitido** sets this match's starters and bench only. It doesn't touch the
  official pizarra board and sends no convocatoria push. An anotador may use it until kick-off.
- **Rival short code:** a `rivalShort` field on the match. By default it is the first 3 letters of the
  rival's main word, uppercase («Atlético Demo» → ATL, «Rayo Pruebas» → RAY). The admin can edit it in
  the match editor. No new rivals collection.
- **Penalties:** a penalty that ends in a goal is recorded as one goal event with `goalKind: penalti`,
  never as a penalty plus a goal. Missed or saved penalties are their own events.
- **Plays during a pause** are treated like plays at halftime (subs and cards accepted). The match pause
  gets its own clock field and doesn't reuse the archive's `pausedAt`.
- **Clock undo actions** (cancel the kick-off, undo the 2nd-half start) stay available in la mesa,
  behind a confirmation.
- The legacy date-based clock path stays supported for old matches.

## Left to the builder

- Route name and shape for la mesa (for example `/matches/$matchId/mesa`), and how the admin and
  pizarra entry points open it.
- Where presence and the offline queue are stored (IndexedDB vs localStorage; a presence subcollection
  vs fields on `matchPrivate`), within the rules above.
- Exact duplicate window and matching details.
- On desktop, la mesa may sit in a centred phone-width column with the record beside it.
- Placement of the new stats columns.
- Phase split (proposed below).

## Proposed phases

1. **Data and server.** New event types and fields:
   - `byUid` / `editedByUid`;
   - `goalKind`, penalty results, pending scorer;
   - edit and delete actions;
   - tapped-time for queued plays;
   - clock pause/resume and stoppage time;
   - presence;
   - scorer permission to close, reopen and publish.
   With integration tests for two scorers, offline reconnect and concurrent edits.
2. **La mesa · En juego.** Route, pitch, bench, rival row, sheets, lower third with undo and assist,
   offline queue with its states, wake lock, vibration.
3. **The other mesa screens.** Antes, Lo que va pasando (edit, delete, duplicates, presence), Descanso,
   Final (inline assists, publish, reopen).
4. **Integration.** Match page (phone and desktop) with «Abrir la mesa», filters, the numbers column,
   Pulso and Campo; the island, Hoy and the vestuario; stats consumers. Remove the old surfaces and
   unify the catalogue.
5. **Polish and verification.** Real-device checks by the user (two phones, airplane mode, sun), e2e
   for la mesa.
