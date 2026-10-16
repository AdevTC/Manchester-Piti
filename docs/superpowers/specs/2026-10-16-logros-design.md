# Logros: more than six medals, with dates

Date: 2026-10-16. This is idea 11 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
Today the vitrina has 6 medals (`src/lib/vestuario.ts` `vitrina`): Debut, Primer gol, Asistente, MVP, 10 partidos and Hat-trick. They don't say when they were won. The catalogue grows into milestones members chase all season, each with the date and match it was won in. They show on the jugador page and in the perfil, and they feed the season cromos («Tus medallas»).

## Catalogue
Tiers bronze → silver → gold, where a family has them. Every medal is computed from data that already exists, through the same rules as the rest of the site: `minutesOf`, `resultLetter`, `mvpWinners`, `porraStandings` and `positionsPlayed`.

| Family | Medals (threshold) |
|---|---|
| Partidos | 10 · 25 · 50 · 100 matches played |
| Goles | Primer gol · 10 · 25 · 50 goals |
| Asistencias | 3 · 10 · 25 assists |
| MVP | MVP · MVP ×3 · MVP ×5 |
| Hat-trick | 3 goals in one match |
| Doblete | 2 goals in one match |
| Portería a cero | played as POR (or in defence) in a match the team won with 0 against; for POR it counts at 1, 5 and 10 |
| Invicto | 5 matches in a row without a defeat while playing |
| Racha | scored in 3 matches in a row |
| Comodín | played 4 different positions (by position code) |
| Minutos | 1000 minutes (never invented: legacy actas without minutes don't count) |
| Debut | as today |

## Behaviour
- **One pure source.** `achievements(playerId, matches, ctx)` in `src/lib/derived/achievements.ts` returns, for each medal: `{ id, family, tier, label, detail, earned, at?: { matchId, date }, progress?: { now, goal } }`. `at` is the match where the threshold was crossed, walking the matches in date order.
- **Compatibility.** `vitrina()` keeps its signature and output for its current callers (vestuario, jugador «Sus medallas», cromos), now built on `achievements`. The six existing ids stay with the same labels, and the tests pin it.
- **Jugador page.** «Sus medallas» shows the earned ones with their date («Hat-trick · 12 oct vs Rayo»), the next three to chase with a progress bar («Goles · 7 / 10»), and the rest collapsed. Progress is shown with a word and a bar, never colour alone.
- **Perfil.** The same block in «Tu carta» › Temporada (or wherever the perfil shows medals today).
- **Cromos.** `seasonRecap`'s «medallas» card lists the medals whose `at` falls in that season.
- **No backend**, no new data, no push notices (out of scope; the centro de avisos could add «Nuevo logro» later).

## Success criteria
- The numbers and dates match the stats and jugador pages for the same fixture.
- The six existing medals render exactly as before where they appear.
- Phone 390 first, ≥ 44 px targets, Spanish copy.
