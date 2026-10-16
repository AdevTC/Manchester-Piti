# «Tu temporada en 10 cromos»: design

Date: 2026-10-16. Idea 4 of the web audit (`docs/auditoria/2026-10-14-integracion-y-huecos.md` §3).

The decisions below were taken by Claude with defaults, because the user asked for continuous progress. Each is easy to change.

## Purpose
When a season ends, each member gets their season as a story of 10 cards. They swipe through it in the web and share any card (or all of them) as 9:16 images. It's the moment of the year people show off.

## Where and when
- **Perfil › Temporada:** a «Tu temporada en 10 cromos» block, for linked members with at least one match played in that season.
- **Available:**
  - when the season is closed (archived, or no matches left to play with its last acta published);
  - for the current season from its 10th played match, labelled «hasta ahora».
- **Vestuario:** a single banner during the 14 days after the season closes: «Ya está tu temporada en cromos».
- Members only. The public jugador page doesn't get it (out of scope).

## The 10 cards
Each card is one number or fact, big, in the Celeste look of the perfil share studio (`src/pages/perfil/shareDraw.ts`, `shareLayout.ts`).
1. **Portada:** your shirt name, number and the season.
2. **Partidos y minutos:** matches played and minutes. Minutes come from `minutesOf`, which never invents them; legacy actas show «—».
3. **Goles y asistencias**, plus your best match.
4. **MVP:** times voted MVP and total votes. If none: «El año que viene».
5. **Tu socio:** the teammate you combined with most (goal + assist), from the perfil «Tu socio en el campo» logic.
6. **Dónde jugaste:** the positions map with minutes (`positionStats`, the posiciones map renderer).
7. **La porra:** your rank and points, if you played the porra; otherwise the card is skipped.
8. **Tus medallas:** `vitrina` medals unlocked this season.
9. **El equipo:** the season record G·E·P, goals for and against, and the biggest win.
10. **Cierre:** «Gracias por la temporada», with the club crest.

When there are no data for a card, the card is skipped, so a story may have 7 to 10 cards; the title still says «en cromos».

## Experience
- **Viewer:** a full-screen story on phone, a centred 9:16 frame on desktop.
  - Tap or arrows to advance; Esc closes.
  - A progress bar on top.
  - With reduced motion, no auto-advance and no transitions.
- **Sharing:** each card has «Compartir» (Web Share with the image file, falling back to download). There is also «Descargar todas», which saves the images one by one, without a zip dependency.
- **Rendering:** client-side canvas with the existing share renderer helpers. Fonts load before drawing, as `matchPoster` does. No server work and no new data.

## Data
Everything exists already: matches, actas, ledger minutes, `mvpResults`, `porraStandings`, `positionStats`, `vitrina`, players and seasons. A pure `seasonRecap(data, playerId, seasonId)` in `src/lib/derived/seasonRecap.ts` returns the card models. It has tests over a fixture season, including legacy actas, no porra, no MVP and a mid-season «hasta ahora».

## Out of scope
Recaps for fans or the public jugador page, video export, team-wide recap, and push notices for it (the centro de avisos could add one later).

## Success criteria
- A linked member opens Perfil › Temporada after the season closes and swipes 7–10 cards whose numbers match their perfil and stats pages exactly.
- Any card shares as a 1080×1920 image that looks like the site, in both themes.
