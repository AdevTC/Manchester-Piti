# La clasificación de la liga: design

Date: 2026-10-16. This is idea 9 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
The club plays a league, but the web never says where the team stands. Captains keep the league table (copied from the federation or league app after each jornada), and the web shows «Vamos 3.º · 18 pts» where people look.

## Data
`standings/{seasonId}` holds:
- `competition: string` — the league's name;
- `updatedAt: Timestamp`;
- `updatedBy: uid`;
- `jornada: number | null`;
- `rows: [{ team: string ≤40, pj, g, e, p, gf, gc, pts: int ≥ 0, isUs: boolean }]` — 2 to 24 rows, exactly one with `isUs`.

Rules, with rules tests:
- everyone reads (it's public information);
- only admins write, with a validated shape;
- no client deletes.

## Admin («Sala de control» › Temporadas, or a new «Clasificación» item next to it)
- **The table editor:**
  - one row per team: name, PJ, G, E, P, GF, GC, Pts;
  - add or remove rows; reorder with buttons, and with drag on desktop;
  - mark «Somos nosotros».
- **Paste from the league:** a box takes a table copied from a web page or spreadsheet (tab- or several-space-separated), parses it into rows and shows a preview before saving. The parsing is a pure function with tests.
- **Consistency hints, which never block saving:**
  - «G + E + P ≠ PJ»;
  - «Pts ≠ 3·G + E» (some leagues differ);
  - the team's own row disagrees with the web's results for that competition.

## Public
- **Partidos and the home:** a compact strip «Vamos 3.º de 12 · 18 pts · J8», linking to the full table.
- **The full table:** a «Clasificación» view on /partidos (`?view=tabla`).
  - Our row is highlighted with a word mark «Nosotros» and a left rule, never colour alone.
  - Up and down arrows since the previous save, if a previous version is kept: keep the last `rowsPrev` on each save.
  - The date it was updated: «Actualizada el 12 oct».
- **SSR:** the public bundle includes it like the rest of the club data, so fans see it on first paint.

## Out of scope
Automatic import from league websites, multiple competitions per season, and per-jornada history beyond the previous save.

## Success criteria
- A captain pastes the league table and saves.
- The home and /partidos show the position.
- The full table renders at 390 without horizontal page scroll; the table scrolls inside its own box.
