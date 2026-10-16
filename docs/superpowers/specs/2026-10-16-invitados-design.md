# Invitados en el acta: design

Date: 2026-10-16. This is idea 7 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
In F7 a friend often fills a gap. Today a guest's goal can only be logged as «Lo completo luego» (no scorer) or credited to someone who didn't score. The acta should name the guest, count the goal for the team, and keep every member's stats, rankings, porra and medals exactly as they are.

## Model
- **The guests:** a match gets `guests: [{ id: "g1"…, name: string ≤ 30 }]` (0–4), set by captains in the acta or the convocatoria.
- **References:** a guest is referenced as `guest:g1` wherever a player id goes: starters, bench, `playerId`, `assistPlayerId`, `inPlayerId`, and the minutes ledger rows.
- **Validation** in `matchEngine` (shared by the functions and the client):
  - a `guest:` id must exist in that match's `guests`;
  - guests can score, assist, be subbed in and out, and be booked, exactly like members.

## What counts
- **Team totals** (score, goals for, the crónica, the scoreboard, «Gol de X (invitado)») include the guests.
- **Everything about players excludes them:**
  - stats tables and leaders;
  - pichichi and rankings;
  - minutes, positions and ratings;
  - MVP candidates: a guest can't be voted;
  - the porra scorer picks;
  - medals and achievements, the cromos, «Tu socio», the jugador pages.

  All of these go through shared helpers, so this is a filter there (`isGuestId`), plus tests on each helper.
- **Assists:** a member assisting a guest's goal keeps the assist, and a guest's assist to a member's goal shows as «Asistencia de X (invitado)» without crediting anyone.

## UI
- **Admin, acta and Convocar:** «Añadir invitado» takes a name and creates a chip usable in the pickers. Guests appear with the word «Invitado» and a distinct shirt outline, never colour alone.
- **Banda and En juego:** the live pickers list the guests after the members.
- **Public, crónica and Campo:** «Gol de Rafa (invitado)». On Campo the guest gets a dot labelled with their name and «Inv.».

## Backend
- **Callables:** `saveMatchSheet`, `liveEvent` and `setConvocatoria` accept `guest:` ids per the validation above. The zod `idSchema` gets a `guestIdSchema` alternative for those fields.
- **Rules:** if the client writes `guests` directly anywhere, the rules get matching tests.
- **Push:** goal notices name the guest with «(invitado)».
- **Integration tests:** an acta with a guest's goal and a guest's assist publishes; member stats are unchanged; a missing guest id is refused.

## Out of scope
Guest accounts, guests appearing across matches as a person, and guest stats pages.

## Success criteria
- A captain adds «Rafa (invitado)», logs his goal live and in the acta, and publishes.
- The score counts the goal.
- No member's numbers change anywhere on the site compared with the same acta without the guest's goal attributed.
- Parity tests prove the last point.
