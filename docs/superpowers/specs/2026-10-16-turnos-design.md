# Turnos del equipo: design

Date: 2026-10-16. This is idea 8 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
«¿A quién le toca lavar las camisetas?» Every amateur team argues about it. A simple rota per job, shown where people look on match day: the convocatoria, «Hoy» and the vestuario.

## Jobs
Captains define the season's jobs: name ≤ 30 characters, an icon from a small set, and the order of members. The defaults offered at creation are «Lavar la equipación», «Balones y petos» and «Coche a los partidos fuera» (this last one only applies to away matches).

The rota assigns the next member in order, one per match, skipping:
- members with «No puedo» or an absence covering that match;
- for «Coche…», home matches.

## Data
- `rotas/{seasonId}`: `{ jobs: [{ id, name, icon, awayOnly: boolean, order: string[] (playerIds) }], updatedAt, updatedBy }`.
- `rotaTurns/{matchId}`: `{ [jobId]: { playerId, swappedFrom?: playerId, at } }`. The assignment is computed client-side by a pure function. A captain can pin or swap it; a member can swap with a teammate only if that teammate accepts, which is out of scope v1, so captains only.
- **Rules:**
  - members read;
  - captains write;
  - the shapes are validated;
  - rules tests.
- Without a pinned `rotaTurns` doc, the turn is computed deterministically from the order and the season's previous played matches. Each completed match advances each job by one, counting skips. So it needs no backend job.

## UI
- **«Hoy» card and the vestuario hero:** «Te toca: lavar la equipación» when it's you; otherwise «Lava: Hugo · Balones: Dani».
- **Match page, Vestuario tab:** the turns for that match.
- **Admin:**
  - a «Turnos» panel in Convocar: see this match's turns, swap someone, «Lo hizo otro» to record who really did it;
  - a «Turnos» section to edit the jobs and the order, with keyboard reorder.
- **Push:** the convocatoria-published reminder to the member whose turn it is: «Te toca lavar la equipación tras el partido del sábado», once per match and job. It's stored in the centro de avisos via `sendTo`.

## Out of scope
Member-to-member swap requests, fines for skipping, and counting turns in stats.

## Success criteria
- The turns rotate fairly over a season.
- They skip absentees and, for the car, home matches.
- A captain can override.
- The person whose turn it is sees it in «Hoy» and gets one notice.
