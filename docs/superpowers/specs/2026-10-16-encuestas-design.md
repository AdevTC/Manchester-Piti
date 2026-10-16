# Encuestas del vestuario: design

Date: 2026-10-16. This is idea 10 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
«¿Cena el viernes?», «¿Nueva equipación: azul o blanca?», «¿Quién se apunta al torneo?». Any member asks the team something quick and everyone answers in the vestuario. Today the only poll is the training one, which is about time slots.

## Rules of the game
- **Who creates:** any member can create a poll. It has a question (≤ 120 chars), 2–6 options (≤ 40 chars each), a closing time (from 1 hour to 14 days; 3 days by default), and «una o varias respuestas».
- **Voting:** while the poll is open, members vote and can change their vote. Votes are public: everyone sees who voted what. That is the same spirit as the team-wide caja.
- **Closing:** the author or a captain can close it early or delete it. At closing time it shows the result (the winner, or a tie) and stays visible for 7 days, then drops out of the vestuario list.
- **Reach:** at most 3 open polls per author at a time. Fans never see polls.

## Data
- `polls/{id}`: `{ question, options: [{ id, label }], multi: boolean, authorUid, authorName, createdAt, closesAt, closedAt?: Timestamp }`.
- `polls/{id}/votes/{uid}`: `{ optionIds: string[], name, playerId, at }`.

Both have rules and rules tests:
- **Members:** read; create with a validated shape and size, `authorUid == auth.uid` and `createdAt == request.time`; vote their own doc while `request.time < closesAt` and before `closedAt`, with option ids taken from the poll and exactly one id unless `multi`; delete their own vote.
- **The author:** sets only `closedAt` (= `request.time`), and deletes their own poll.
- **Captains:** can do the same on any poll.

The limit of 3 open polls per author is enforced in the UI only, since the rules can't count.

**Push and the centro de avisos:** a new poll triggers one team notice, «Nueva encuesta: ¿Cena el viernes?». It is a small trigger `onPollCreated` → `sendTo` with topic `lineup`, so it lands in the centro de avisos too. The closing result is not pushed.

## UI (vestuario)
- **«Encuestas» block:**
  - the open polls first, then the closed ones within 7 days;
  - each poll shows the question, the options with a live bar, the count and «Tú: X», plus «Votaron: …» (the names collapsed after 5);
  - a «Cambiar mi voto» button.
- **«Nueva encuesta»:** an inline form with the question, the options (add or remove, from 2 to 6), a closing selector (1 h, 1 día, 3 días, 1 semana) and a «Varias respuestas» toggle.
- **The training poll** stays as it is. Generalising it is out of scope.
- Phone 390 first, ≥ 44 px targets, never colour alone, reduced motion.

## Out of scope
Anonymous votes, polls for fans, images in options, and merging the training poll.

## Success criteria
- A member creates a poll, the team gets one notice, and votes show live on every device.
- Votes are refused after the poll closes.
- Nobody can vote twice, nobody but the author or a captain can close or delete a poll, and fans read nothing. Rules tests prove all of this.
