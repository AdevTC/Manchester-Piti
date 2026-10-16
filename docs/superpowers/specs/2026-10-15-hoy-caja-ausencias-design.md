# «Hoy», La caja y Ausencias: design

Date: 2026-10-15. These are the three features chosen after the web audit (`docs/auditoria/2026-10-14-auditoria-web.md`, ideas 1–3).

## What the user decided (2026-10-15)
- **La caja: everyone sees everything.** Every member sees each player's balance and the jar's.
- **La caja holds:** cuotas, campo y árbitro (per match), and gastos del bote. **No fines.**
- **Ausencias** fill in «No puedo» on the matches in their dates. The member can still change it by hand.
- **«Hoy»** shows on the home and the vestuario, for members, on match day. Fans keep today's home.

## Out of scope
Real payments (Bizum or a bank stay outside the app; a free-text «Cómo pagar» note is enough), fines, and push reminders for debts.

---

## 1. «Hoy» de día de partido
**Purpose:** on match day, a member opens the web and has everything about today's match in one card, without hunting through four places.

**When it shows:**
- From 00:00 Madrid time on the match's date until the MVP vote closes (`voteClosesAt`), or until 23:59 of that day if there is no vote.
- Only for linked members (`useViewer`).
- With two matches the same day (rare), it shows the next one not yet ended.
- `kickoffState` from block 1 drives the phases.

**Where:**
- At the top of the home, above the hero, for members only. The SSR/fan home is unchanged; the card mounts client-side once the member is known, without layout shift for fans.
- At the top of the vestuario, replacing its next-match hero during the window.

**Content by phase:**
- **Before kick-off** (`scheduled` / `pending_whistle`):
  - your RSVP (`RsvpSwitch`, block 4);
  - the quedada time and note;
  - the official siete if published (block 3's `campoSeven`/`useMatchBoard`), else the convocatoria;
  - kit;
  - weather (existing forecast);
  - «Cómo llegar» (`venue.ts`);
  - countdown;
  - a link to the previa.
  
  If you are in the siete, it says so: «Sales de titular · DFC».
- **Live** (`live` / `halftime`): score and minute (the scoreboard model from block 5), the last event, and a link to the match. The island keeps doing its job on other pages.
- **After the whistle** (`ended` / `awaiting_result`, or the acta published with the vote open): the result and `MvpBallot` (block 4), or «Vota al MVP» linking to `?tab=vestuario`, plus the porra outcome if any.

**Data:** only what members already read. No new collections, no new rules.

**Composition:** a new `src/components/celeste/HoyCard.tsx` with a pure `hoyModel(match, viewer, now)` in `src/lib/derived/hoy.ts`. Each phase reuses the existing shared components; nothing is duplicated.

## 2. Ausencias por fechas
**Purpose:** «no puedo del 12 al 19» once, instead of answering each match.

**Data:** `absences/{id}` with these fields:
- `uid`, `playerId`, `name`;
- `from` and `to` as `YYYY-MM-DD` Madrid dates, inclusive, at most 120 days;
- an optional `note` (≤ 140 characters, visible to members);
- `createdAt`.

**Rules:**
- Members read all absences.
- A member creates and deletes only their own, with validated shape and range; no update (delete and create instead).
- Captains can delete any.

**Effect, in a Cloud Function trigger `onAbsenceWritten` plus the existing match trigger:**
- **Absence created:** for every published, not cancelled, upcoming match whose Madrid date falls in the range, write `matchPrivate/{matchId}/availability/{uid}` = `{ response: "no", name, playerId, at, source: "absence", absenceId }`. This overwrites any earlier answer: the absence is the newer intent.
- **Absence deleted:** remove only the availability docs still `source == "absence"` with that `absenceId`. Answers the member changed by hand stay.
- **A match is published, or its date changes, into a range:** set «No puedo» only if the member hasn't answered.
- **The member later answers by hand:** the client writes the doc without `source`, so it becomes a normal answer. The availability rule must allow `source`/`absenceId` to be absent on client writes; only the backend writes them.

**Push:**
- An absence does **not** send one «Baja» push per match to the captains. It sends one notice: «NOMBRE no puede del 12 al 19 oct (2 partidos)».
- `pushOnAnswer` skips writes with `source == "absence"`.

**UI:**
- Vestuario: «Mis ausencias» block with an add form (two dates and a note) and the list with a delete action.
- Convocar (admin) and the vestuario convocatoria list show «Ausente · hasta 19 oct» on those players.
- «Sugerir siete» already excludes «No puedo».

## 3. La caja
**Purpose:** the team's money as a shared ledger: who has paid, who owes, and what is in the jar.

**Data:**
- **`caja/{seasonId}`**, the season's settings, captains only:
  - `cuota` (amount in cents);
  - `cuotaPeriod` (`"temporada" | "mensual"`);
  - `howToPay` (free text, e.g. the Bizum number, shown to members);
  - `updatedAt`.
- **`cajaMovs/{id}`**, append-only movements:
  - `seasonId`, `kind`, `playerId`, `amount` (positive cents), `concept`, `date`, `matchId`, `by` (captain uid), `createdAt`, `void`;
  - `kind` is `"cargo"` (cuota or match share), `"pago"` (a player paid), `"gasto"` (money out of the jar) or `"ingreso"` (other money in, e.g. a sponsor);
  - `playerId` is set for cargo and pago, and null for gasto and ingreso;
  - `void` is a boolean: corrections cancel a movement, never delete it.

**Balances:** pure functions in `src/lib/derived/caja.ts`, tested.
- A player's balance is the sum of their pagos minus the sum of their cargos (non-void). Negative means they owe.
- The jar is pagos + ingresos − gastos.

**Captain actions** (admin «Caja» section, batched writes; the split maths is pure and tested):
- **Cobrar cuota:** one cargo per active squad player, with the concept «Cuota 2026/27», or «Cuota octubre» when monthly.
- **Coste del partido:** the captain enters the campo + árbitro total. It splits into cargos among the players who played (from the acta: starters plus subs who came in). If there is no acta, it splits among the convocados. Leftover cents go to the first players in dorsal order, and the concept is «Campo y árbitro · J5 vs Rival».
- **Apuntar pago, gasto or ingreso.**
- **Anular** any movement, which sets `void`.
- **Edit the settings.**

**Rules:**
- Members read `caja` and `cajaMovs`.
- Only admins create `cajaMovs`, with a validated shape.
- An update may only flip `void` false → true. No deletes.

**UI:**
- **Vestuario «La caja» block:**
  - your balance, big: «Debes 12,50 €» or «Al día»;
  - the jar;
  - «Cómo pagar»;
  - everyone's balances, sorted with those who owe first, each with a text and icon status, never colour alone;
  - your movements.
- **Admin:** a «Caja» section in the Sala de control nav, holding the actions, the full movement log with filters, and the anular button.
- The match workspace gets a «Coste del partido» shortcut once the acta is published.
- **Amounts** are formatted `es-ES` with €, and amounts are integer cents everywhere.

---

## Cross-cutting
- Spanish copy, never colour alone, reduced motion, ≥ 44 px targets, phone 390 first. The Celeste base from block 5 applies (`hm-kick`, `hm-h2`, `st-card`, `hm-btn`…).
- Every new collection gets rules and rules tests. Every function gets emulator integration tests. Pure logic lives in `src/lib/derived/` (or `functions/src` when both sides need it), with tests.
- Deploy order: Firestore rules and functions before the web.

## Success criteria
- On match day a member sees one card with everything: RSVP, siete, quedada, kit, weather, how to get there. It turns into the live score and then the MVP vote without reloading.
- A member adds «del 12 al 19» and the two matches in that range show «No puedo» everywhere (vestuario, Convocar, pizarra). Deleting the absence restores them, unless they were changed by hand. The captains get one notice.
- A captain charges the cuota and a match cost, and marks a payment. Every member sees the same balances and jar, and the numbers add up to the cent.
