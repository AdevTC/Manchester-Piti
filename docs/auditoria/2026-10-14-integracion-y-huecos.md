# Manchester Piti: cross-module integration, coherence and product gaps

Read-only audit of `main` at `bd459d8` (2026-10-14). No files were changed, no server, browser or production access. Evidence is `file:line` against the working tree. Severity reflects impact on a member/captain/fan using the app on match day, weighted by the user's stated priorities: redesign/features/perf first, a11y/SEO secondary.

Effort: **S** < half a day · **M** 1–3 days · **L** > 3 days.

---

## 0. Top findings at a glance

| # | Sev | Finding | Effort |
|---|-----|---------|--------|
| N1 | High | The season `<select>` on /partidos snaps back after the second change (same bug class fixed in 1ed64b7, reintroduced by the Celeste redesign) | S |
| C1 | High | "Jornada N" is computed three different ways (public / admin / pizarra), so J-numbers can disagree for the same match | S–M |
| C2 | High | Result letters are G/E/P on home and /partidos but V/E/D in the admin, jugador, stats and pizarra | S |
| N2 | High | /club has no entry in the phone dock, so on a phone it's reachable only from the footer. Its dock also highlights nothing | S |
| N3 | High | The match page's tab isn't in the URL, so a push or shared link can't land on Vestuario (MVP/porra) or Campo | S |
| N4 | Med-High | Players are dead text on the match page (scorers, Campo player card, minutes, MVP, crónica) and on the partidos pichichi, the plantilla podium and the birthdays | S–M |
| C3 | Med-High | The match page "Campo" still draws orientative F7_SPOTS and ignores the stored `ledger[pid].positionsPlayed` / `match.system` from Phase 4 | M |
| C4 | Medium | Minutes show with 2 decimals and a dot ("342.67′") on the jugador page, but rounded everywhere else | S |
| N5 | Medium | Route errors render the legacy shadcn card with no Celeste chrome on immersive pages (dead end). 5 pages ignore `useClubData().error` | S–M |
| D1 | Medium | About 5.5k lines of dead legacy UI (Landing, Login, MatchCenter, components/match, old Vestuario, ClubUI, ResultsTicker…) and DESIGN.md still describes it as live | S |

---

## 1. Navigation graph

### 1.1 Current graph (outbound links per screen)

| Screen | Goes to | Obviously missing |
|---|---|---|
| `/` Home | `/vestuario` (header CTA, band), `/plantilla`, last match → `/matches/$id`, "Lo que viene" rows → `/matches/$id`, `/partidos`, player of the moment → `/jugadores/$id`, live → `/matches/$id` | Next (not live) match hero → its ficha/previa (`MatchHero.tsx:189-198` only offers calendar buttons). No personalisation for a logged-in member (e.g. "te falta responder la convocatoria") |
| `/partidos` | rows and season tiles → `/matches/$id`, live → `/matches/$id` | Next-match board → previa (`PartidosPage.tsx:160-167`). Pichichi aside names aren't links (`:372-380`), and there's no "ver estadísticas" link. No rival → head-to-head (stats Rivales) |
| `/matches/$id` | back → `/partidos` (hard-coded, `MatchPage.tsx:171`), head-to-head → other matches, `/vestuario` (non-members) | Tab not in URL (`MatchPage.tsx:81`). No player links anywhere: hero scorers (`:219-236`), Campo player card `fc-pinfo` (`Tabs.tsx:288`), minutes chart (`Tabs.tsx:318`), MVP leader (`Tabs.tsx:575`), crónica chapters. No previous/next match. No "Abrir en la Sala de control" for admins. No "La charla / el siete en la pizarra" for members. No rival → Rivales |
| `/stats` | most names → `/jugadores/$id`, matches → `/matches/$id`, `view`/`section`/`season` in URL | RaceBoard names (`Race.tsx:136`). Comparar picks live in local state (`Panes.tsx:457-459`), so "X vs Y" can't be linked from the jugador page or the plantilla |
| `/plantilla` | ficha modal → `/jugadores/$id`, compare in-page | Open ficha and cara-a-cara aren't in the URL (`SquadPage.tsx:68-72`). The declared `plantillaSearchSchema` (`router.tsx:22`, mode expedientes/pizarra) is dead. Podium and birthday names aren't links (`home/Sections.tsx:137-203`). No season selector (it relies on the global sticky season) |
| `/jugadores/$id` | back → `/plantilla` (hard-coded, `JugadorPage.tsx:214`), ADN and last games → matches, best partner → other jugador | "Comparar con…" → stats Comparar (needs URL params). When it's your own page: "Editar tu carta" → `/profile`. For admins: "Editar ficha" → `/admin/plantilla?jugador=`. Substitution partners in "Sus cambios" aren't links |
| `/club` | `/partidos`, history tickets → matches, next match | Captain name isn't a link (`ClubPage.tsx` "Capitán"). Trophies don't link to the matches that earned them. Not in the phone dock (N2) |
| `/vestuario` | `/profile` (avatar), Access block → `/pizarra`, `/stats`, own `/jugadores/$id`, `/admin`, `/plantilla`. CaptainStrip → `/admin` | Next match in the hero has share but no link to its ficha (`vestuario/Hero.tsx:138,184`). The MVP and Porra blocks don't link to the match page's Vestuario tab |
| `/pizarra` | crest → `/`, avatar → `/profile` | Cromo or ficha → `/jugadores/$id`. The linked match → `/matches/$id`. Admins → `/admin/convocar?j=` |
| `/profile` | own public page (`TabCarta.tsx:69`), `/vestuario`, `/admin` (captains) | Season tab → `/stats?season=`. "Dónde has jugado" → `/stats?view=positions` |
| `/admin/*` | "Ver la web" → `/`, Plantilla ficha → `/jugadores/$id`, published vitrina → `/matches/$id` (plain `<a>`, `Publicado.tsx`), La puerta → `/vestuario#puerta` | Match workspace and En juego → public ficha/directo. Convocar's "La pizarra" row is a status, not a link (`Convocar.tsx:267-275`). The palette has no "ver en la web" or "abrir pizarra" commands (`AdminLayout.tsx:140-190`) |

### 1.2 Findings

**N1 · High · Season selector on /partidos reverts.**
Evidence: `PartidosPage.tsx:331` calls `setSelectedSeasonId` directly. `SeasonUrlSync.tsx:21-37` treats the URL as the source of truth and resets context to `?season=`.
Symptom: the first change works (the URL is empty, so it gets seeded). From the second change on, the effect sees `urlSeason !== selectedSeasonId` and puts the old season back. This is exactly the MatchCenter bug fixed in 1ed64b7, reintroduced in fa4bda8.
Fix: navigate `{ search: prev => ({...prev, season}) }` like Stats, Jugador and Pizarra do. Add a unit/e2e test for two consecutive changes.
Effort: S.

**N2 · High (mobile-first) · El club is missing from the phone dock.**
Evidence: `Chrome.tsx:17-23` (DOCK has inicio/partidos/vestuario/stats/plantilla) and `ClubPage.tsx:511` (`active="club"`).
Symptom: under 1100px the only way to /club is the footer. On /club no dock item is lit and there's no labelled pill.
Fix: decide the dock IA. Either 6 items (≤380px already hides labels), or swap Plantilla/Club with a "Más" sheet like the admin.
Effort: S.

**N3 · High · Match ficha tabs aren't deep-linkable.**
Evidence: `MatchPage.tsx:81` uses `useState` for the tab, and the route has no `validateSearch`.
Symptom: the push «Se abre el voto del MVP», a WhatsApp link to the porra and "ver minutos" can't open the right tab. Back and refresh lose the tab.
Fix: add `matchSearchSchema { tab: cronica|campo|pulso|vestuario|estadisticas }`, use it in the push URLs (functions/src/pushLogic.ts) and in the vestuario MVP/Porra blocks.
Effort: S.

**N4 · Medium-High · Player names are dead text where it matters most.**
Evidence: `MatchPage.tsx:219-236`, `Tabs.tsx:288` (`fc-pinfo` has no "Ver su ficha"), `Tabs.tsx:318`, `Tabs.tsx:575`, `PartidosPage.tsx:372-380`, `home/Sections.tsx:137-154,191-203`, `Race.tsx:136`, `JugadorPage.tsx` "Sus cambios".
Fix: a shared `<PlayerLink id>` (name, dorsal, season-aware name) used everywhere a squad member is named.
Effort: S–M.

**N5 · Medium · Error and 404 dead ends.**
Evidence:
- `route-states.tsx:83-121`: RouteError is shadcn with `--mp-*` and lucide. Immersive routes hide the site chrome (`RootLayout.tsx:343`), so an error shows a card with no header or dock.
- `router.tsx:103`: unknown URLs silently `<Navigate to="/">`.
- `MatchDetailPending` and `PlayerProfilePending` mirror the deleted legacy layouts and never fire, because the detail routes have no loader.
- `useClubData().error` is ignored in HomePage:21, PartidosPage:175, MatchPage:75, ClubPage:58 and VestuarioPage:61. On MatchPage an error reads as «Partido no encontrado» (`:110`).

Fix: one Celeste `<StatePanel kind=loading|empty|error|notfound>` with chrome, a real not-found route («Fuera de juego») and the `error` branch in every page.
Effort: S–M.

**N6 · Medium · Deep-link conventions fight each other.**
Evidence:
- `SeasonUrlSync.tsx:21-24` adds `?season=` on every route, including pages that ignore it (home, club, vestuario, match, admin). Opening someone's `/stats?season=X` link also persists X into your localStorage (`SeasonContext.tsx:38-41`).
- The pizarra (`v2/deeplink.ts`) and perfil (`perfil/tabs.ts:58-65`) both had to add "remember the first-load URL" hacks because the sync rewrites the URL and drops undeclared params.
- Conventions: stats uses `?view`, pizarra `?tablero` + `#panel`, perfil `#hash`, admin `?tab/?jugador/?j`, match none.

Fix: declare search schemas for `/pizarra` (`tablero`) and `/matches/$id` (`tab`). Only sync `season` on routes that read it (stats, jugador, partidos list, pizarra). Don't persist a season that arrived from a shared URL.
Effort: M.

**N7 · Medium · Captain workflow is split over four places with weak links between them.**
Evidence:
- Admin (`/admin/*`).
- Vestuario CaptainStrip, CaptainDoor and TrainingPoll admin mode (`VestuarioPage.tsx:151-197`).
- Perfil «Capitanía».
- The pizarra's official siete and charla, which the admin never links to (`Convocar.tsx:267-275`).
- La puerta lives in the vestuario but appears in the admin rail (`nav.ts DOOR_HREF`).

Fix: add a "Pizarra" target to `AdminTarget`, admin palette commands («Abrir la pizarra del J5», «Ver en la web»), and link the Convocar «La pizarra» row to `/pizarra?tablero=`.
Effort: S–M.

**N8 · Medium · Public → admin shortcuts are missing for admins.**
The match page shows the «Mesa de partido» (Banda) but no «Editar acta / Publicar» (`/admin/partidos/$id?tab=acta`). The jugador page has no «Editar ficha».
Effort: S.

**N9 · Low · Hard-coded back links.**
`MatchPage.tsx:171` always goes to /partidos and `JugadorPage.tsx:214` always to /plantilla, even when you came from stats, home or a jugador page. Fix: use `router.history.back()` when there's in-app history and fall back to the section otherwise.
Effort: S.

**N10 · Low · No public search.**
The admin has a good ⌘K (`palette/search.ts`). The public site only has "Buscar rival" on /partidos and "Nombre o dorsal" on /plantilla. A small global finder (players, rivals, jornadas) would reuse `normalize` and `commandMatches`.
Effort: M.

**N11 · Low · Non-admin members on /admin get the legacy chrome.**
They see the old `Navbar` and `club-empty` («Solo para administradores», `RootLayout.tsx:368-372`), the only remaining route into the legacy chrome.
Effort: S.

---

## 2. Coherence: same concept, different rendering

**C1 · High · Jornada numbering differs per module.**
- Public: `lib/partidos.ts:52,72` numbers by date and excludes cancelled matches.
- Admin: `admin/data/adminLogic.ts:63-69` includes drafts (unpublished) and cancelled matches.
- Pizarra: `pizarra/v2/useBoardData.ts:55-70` includes cancelled. With season "all" it numbers across seasons (J37…).

Symptom: «J5» in Convocar, the charla, the push «Ya está el siete» and the admin palette can be a different match from J5 on /partidos and the ficha.
Fix: one `jornadaOf(matches, seasonId)` in `lib/` (published, not cancelled, by date, per season), used by all three. Also consider storing `jornada` on publish.
Effort: S–M.

**C2 · High · Two result alphabets.**
- G/E/P: `lib/home.ts:12`, `lib/partidos.ts:8`, `home/Sections.tsx:7`, `PartidosPage.tsx:279,290` (legend «G victoria · E empate · P derrota»), `perfil/card.ts:85`.
- V/E/D: `admin/kit/result.ts:2`, `adminLogic.ts:391`, `seasonsLogic.ts:120`, `JugadorPage.tsx:34`, `stats/Charts.tsx:10`, `pizarra/v2/boards.ts:122`, and DESIGN.md's Never-Color-Alone rule.

Symptom: a fan sees «P» for a loss on /partidos and «D» on the jugador ADN. The letter function is reimplemented 7 times.
Fix: one `resultLetter()` + `RESULT_WORD` in `lib/`. Pick V/E/D (the design system and admin say so) or G/E/P, but use one.
Effort: S.

**C3 · Medium-High · Positions history doesn't reach the match.**
Evidence: `lib/ficha.ts:110-111` (F7_SPOTS «Orientative F7 positions (1-3-2-1)») and `Tabs.tsx:257`. `positionsPlayed`/`system` are read only by `lib/positionStats.ts` and `stats/Posiciones.tsx`.
Symptom: the match the positions were recorded for still draws every siete as 1-3-2-1 «Posiciones orientativas», and never names the system played.
Fix: place starters by `ledger[pid].positionsPlayed` (largest code) on the `MapaPosiciones` geometry, show `match.system` as a chip, and keep the orientative fallback for old actas.
Effort: M.

**C4 · Medium · Minutes formatting.**
Evidence: `clubAnalytics.ts:122` keeps 2 decimals (from `secondsPlayed`). `JugadorPage.tsx:134` renders `${me.minutes}′` and `:188` a raw `342.67` in the season table. MapaPosiciones, playedSummary and positionStats round. The match bench shows ledger minutes `p.minutes min` (`Tabs.tsx` fc-bench-name).
Symptom: «342.67′» with a dot decimal next to «342′» elsewhere.
Fix: `fmtMinutes(n)` → integer `′` for display (es-ES comma only if you ever show decimals).
Effort: S.

**C5 · Medium · The player's name has five rules.**
- `clubData.playerName` (`clubData.ts:47`: shirtName → first+last → «Jugador»).
- Copies in `squad.ts:97` and `statsView.ts:16`.
- `stats/Panes.tsx:363` (shirtName → firstName only).
- `detailQueries.ts:51` (→ «—»).
- Admin `EnJuego.tsx:30`/`Hoy.tsx:81` (roster name → shirtName).
- Vestuario `me.displayName` (shirtName or nickname, uppercased).

Season overrides are applied on Home, Club and Plantilla (`playerForSeason`) but not on MatchPage, Partidos, LiveIsland or Tabs (`MatchPage.tsx:84`, `PartidosPage.tsx:184`, `LiveIsland.tsx:35`). A player with a per-season shirt name reads differently on the home and on the match page.
Fix: `nameFor(player, seasonId)` as the only API, with the match pages passing `match.seasonId`.
Effort: S–M.

**C6 · Medium · "All seasons" has three names and one global sticky state.**
- «Todo el historial»: `StatsPage.tsx:67`, `JugadorPage.tsx:127`.
- «Todas las temporadas»: `PartidosPage.tsx:332`.
- «Histórico total»: `PizarraPage.tsx:94`, `v2/Panels.tsx`, `SheetPanels.tsx`, `Tableros.tsx`.

Ordering differs too: Stats and Jugador use `[...seasons].reverse()`, Partidos uses ascending. Seasons come `orderBy("name","asc")` (`publicData.ts:19`), which will sort «Temporada 10» before «Temporada 2».

What "all" means also differs: Home, Partidos hero and Vestuario always use `currentSeasonId`. Squad falls back to current when "all". Stats, Jugador and Pizarra show all-time. One selection made on /jugadores silently changes /stats and /pizarra on the next visit.

Fix: one `SeasonPicker` component, one label, newest-first, order by a created/start field, and a documented rule for which pages follow the global season.
Effort: S–M.

**C7 · Medium · Duplicate member actions with diverging flows.**
- RSVP, porra and MVP exist twice: vestuario (`Hero.tsx:48-50`, `TeamBlocks.tsx:338` Porra, `:450` MvpBlock) and match Vestuario tab (`Tabs.tsx:405-407`, porra, MVP). Same writes, separate markup and copy (e.g. the porra scoring rule appears only on the match tab, `Tabs.tsx:549`).
- Live logging exists twice: public «Mesa de partido» `match/Banda.tsx:14-29` (13 actions incl. ocasión/córner/palo) and admin «En juego» `admin/live/liveModel.ts` (goal → team → player → assist wizard, cards, subs).

Symptom: two places to keep in sync, with different capabilities by entry point.
Fix: extract `RsvpSwitch`, `PorraCard` and `MvpBallot`, and one live action catalogue shared by Banda and En juego.
Effort: M.

**C8 · Medium · Match analytics panel is a style and tone outlier.**
Evidence: `components/celeste/TechnicalStats.tsx:1-67` (minified JSX, one-line `technical-stats.css`, native selects, «Piti y rival», «Cobertura parcial», «Acciones registradas») from ee28971.

It sits at the top of every jugador page (`JugadorPage.tsx:264`), before the cromo chips, and as the 5th match tab. With most actas unnarrated it shows an almost empty panel first. It also overlaps the Constellation (`stats/Charts.tsx`) with a second "network".

Fix: format it to house style, move it below the fold or behind «El juego en detalle», hide it when `data.events` is empty, link names, and reuse `st-card`/`st-seg`.
Effort: M.

**C9 · Medium · Same words, different things.**
- «Ficha» means four things: the admin player editor, the admin section «Fichas» (account claims), the public squad modal, and «Ficha de partido».
- «Vitrina» means four things: player medals (`SeasonBlocks.tsx:51`, jugador «Sus medallas»), the club crest case (`club/Vitrina.tsx`), the admin publish peak (`?vitrina=`) and the admin Temporadas silverware.
- «Cromo» vs «carta» for the same card.

Fix: a short glossary in PRODUCT.md, then rename the admin «Fichas» section to «Solicitudes» or «Cuentas».
Effort: S.

**C10 · Low-Medium · Medals and best partner use different scopes.**
Vestuario computes `vitrina` and `bestPartner` over all matches (`VestuarioPage.tsx:109-112`). Jugador uses the selected season's `games` (`JugadorPage.tsx:175-177`) and the perfil card uses its season (`perfil/card.ts:302,328`). The same player can show a different «mejor socio» on each.
Effort: S.

**C11 · Low · Stale «nuevo» badges.**
There are 34 hard-coded `st-new`/`isNew` badges with no expiry (JugadorPage 7, Panes 13, ClubPage 8…). They read as noise and undercut «earn the glow».
Fix: remove them, or gate by a release date.
Effort: S.

**C12 · Low · Header actions and feedback patterns vary.**
- Header actions: the public pages repeat ThemeToggle + `hm-cta-top` «Vestuario» 7 times. Perfil uses `pc-cta-top`. Vestuario and Pizarra show the avatar. The pizarra re-implements the theme button (`PizarraPage.tsx:30-48`). A logged-in member on public pages never sees their avatar.
- Feedback: per-page `notice` + `role=status` lines (Match, Jugador), perfil «press» toasts, pizarra `toast` state, the admin lower thirds, and a global sonner `<Toaster/>` (`App.tsx`) that public code never calls.

Effort: S–M.

**C13 · Low · The match poster is still in the legacy look.**
`lib/matchPoster.ts:11,35` (Anton/Archivo, flat stripes) sits next to the Celeste perfil share studio and pizarra cartel (Anybody/Geist). It awaits only `document.fonts.ready`, not `document.fonts.load('74px Anton')`. On Celeste pages, where Anton is never used in the DOM, the face may not be loaded and the poster can fall back to a system font. This is likely; verify in a browser.
Fix: redraw with the cartel's renderer and load the faces explicitly, as `pizarra/v2/cartel.ts:191` does.
Effort: M.

**C14 · Low · Tablist keyboard support.**
The match tabs (`MatchPage.tsx:286-293`) have no arrow-key roving. Perfil, FichaModal, MatchEditor and CaptainDoor do. Stats uses `aria-pressed` buttons for the same pattern. This is secondary per your priorities, but it's a free win when extracting a shared Tabs.
Effort: S.

---

## 3. Product gaps and feature ideas

What exists today is strong for the moment around the match: convocatoria, RSVP and reminders, the pizarra's official siete and charla, live logging and the island, push, ICS with trainings, publish → MVP 48h → porra → stats, medals, share posters, positions history. The gaps cluster around **money**, **the week between matches**, **the season as a story** and **closing loops**.

Ranked by value × effort for an amateur F7 team (V = value 1–5, E = effort S/M/L):

| Rank | Idea | V | E | Notes / what it reuses |
|---|---|---|---|---|
| 1 | **Match-day "Hoy" for members**: on the home and vestuario on match day, one card with my RSVP, quedada, the official siete (pizarra), kit, weather and «Cómo llegar», then the live island and the MVP ballot after the whistle | 5 | M | Everything exists in 4 places (vestuario Hero, match previa, pizarra charla, Avisos). Mostly composition and links (N3, N7) |
| 2 | **La caja: cuotas, pitch/referee fees and multas** (who paid, who owes, the jar balance; captain marks payments; no real payments) | 5 | M–L | The classic pain of an amateur team. New collection + rules + a vestuario block + an admin section. No payment provider: just a ledger. Bizum and transfer details stay outside the app |
| 3 | **Ausencias / season availability** («no puedo del 12 al 19») feeding the convocatoria and «Sugerir siete» | 4 | M | `availability` is per match today (`useAvailability(next.id)`). A date-range doc would pre-answer future matches |
| 4 | **Season recap («La temporada en 10 cromos»)** at season close: your numbers, MVPs, best partner, positions, porra rank and team records as a shareable story | 4 | M | All data and share renderers exist (perfil `shareDraw.ts`, `cartel.ts`, `vitrina`, `positionStats`). The admin's «Temporada terminada» state is the trigger |
| 5 | **Notifications centre** (in-app inbox of what push sent: convocatoria, el siete, MVP abierto, cambios de hora) plus unread dots on the dock | 4 | M | `pushLog` already exists server-side (memory: pushLog conv-{id}). Read it per member |
| 6 | **Post-match loop for members**: rate your match, upload 1–3 photos, react or comment on the crónica | 4 | M–L | The gallery is admin-only, https URLs only (`sheetModel.ts:308`) and there's no Firebase Storage. Needs Storage or an external image host. Reactions are cheap (pizarra reactions pattern) |
| 7 | **Guests / invitados in the acta** (goals and assists by «Invitado» without breaking stats) | 3 | M | Common in F7. `matchEngine` events require a `playerId` for ours. A `guest` actor type keeps team totals right |
| 8 | **Kit and logistics rota** (who washes the kit, who brings balls and petos, lifts to away pitches) | 3 | S–M | Simple roster rotation shown in the convocatoria and the quedada note |
| 9 | **League table / competition context** (manual or imported standings, «estamos 3.º») | 3 | M | No standings anywhere. `competition` is free text |
| 10 | **Generic polls** («¿cena el viernes?», «¿nueva equipación?») | 3 | S–M | Generalise the TrainingPoll (`TeamBlocks.tsx:62`) |
| 11 | **Achievements beyond 6 medals** (100 partidos, 50 goles, «hat-trick», «portería a cero», «MVP x5») with dates | 3 | S | `vitrina()` and `collection().next` (próximo hito) exist; extend the catalogue and show it on the jugador page and in perfil |
| 12 | **Rival dossier** (record vs rival, last scorers, notes from the pizarra RivalPanel) on the match previa | 3 | S | `HeadToHead` (`Tabs.tsx:37`) + `stats/Rivales` + `pizarra/v2/RivalPanel.tsx` are three separate halves |
| 13 | **Public search / ⌘K** (N10) | 2 | M | Reuse the admin palette model |
| 14 | **Bulk "no puedo" from the push** (action buttons on the convocatoria notification) | 2 | S–M | Web Push actions + the existing `setAvailability` callable |

Already well covered (no action): calendar sync (ICS feed + per-match), social share (posters, cromo studio, pizarra cartel/QR/video), training scheduling (poll + ICS), tactics (pizarra), positions, MVP and porra.

---

## 4. Design-system and code debt

**D1 · Medium · Dead legacy layer (about 5.5k lines) still shipped or tracked, and the docs say it's live.**

Dead files (no importer outside themselves):
- `pages/Landing.tsx/.css`, `pages/Login.tsx/.css`, `pages/MatchCenter.tsx/.css` + `components/match/*` (6 files), `pages/MatchDetail.css`, `pages/Vestuario.tsx` (old MvpVote).
- `components/club/ClubUI.tsx`, `ResultsTicker.tsx`, `SeasonSelector.tsx`, `Reveal.tsx`, `FloodlightCanvas.tsx`, `LoginLights.tsx`, `hooks/useCountUp.ts`, `App.css`, `components/Navbar.css`.
- `pizarra/usePizarraPlayers.ts:59` `setInjured` (unused).

Still loaded globally although only the legacy uses them: `index.css` (body font = Archivo), `theme.css` (`--mp-*`), `tailwind.css` (shadcn bridge), `club.css` (1,690 lines, RootLayout).
- `analytics.css` (990 lines, `--mp-*`) still reaches /stats through `OpponentBadge` (`stats/Panes.tsx`).
- shadcn: 8 of 14 components are unused (badge, checkbox, dialog, dropdown-menu, input, label, select, table). Only button and skeleton (route-states), tabs (perfil), tooltip/hint and sonner (mounted, unused publicly) are imported.
- `DESIGN.md:446` says the legacy layer is "kept only for the pages not yet migrated (Landing, Login, MatchDetail, the old Navbar)". Those are gone.
- `docs/GUIA-NUEVA-WEB.md:10,62,167` still describes the team password («clave del equipo»), now replaced by invitations, and the home results carousel.

Fix: delete the dead files, move `OpponentBadge` to Celeste, and audit what `index.css`/`club.css` still style (RouteError, the admin-only gate, the demo banner). Update DESIGN.md and the guide.
Effort: S–M.

**D2 · Medium · Page CSS doubles as the shared component library.**
- `home.css` (`hm-btn`, `hm-ghostbtn`, `hm-kick`, `hm-sr`, `hm-cta-top`) is imported by club, jugador, match, partidos, squad and stats.
- `partidos.css` (`pt-board`, `pt-chip`, `pt-res`) is imported by match, stats, jugador, club, the LiveIsland and even **admin** EnJuego/Partidos.
- `stats.css` (`st-card`, `st-seg`, `st-empty`, `st-new`) is imported by club, jugador and TechnicalStats.

Variant counts:
- section titles: `hm-h2` ×26, `st-h2` ×19, `vx-h2` ×10, `mp-h2` ×6, `cl-h2`
- kickers: `hm-kick` ×63, `vx-kick` ×10, `club-kicker`
- empty states: `st-empty`, `vx-empty`, `ts-empty`, `sq-empty`, `hm-empty`, `nt-empty`, `club-empty`
- segmented controls: `st-seg`, `pt-seg`, `ch-seg`, `sq-kit`
- tab bars: `st-tabs`, `sq-tabs`, `fc-tabs`, shadcn tabs (perfil)
- page titles: `pt-h1`, `st-h1`, `jg-h1`, `fc-h1`, `cl-h1`, `tl-h1`
- cards: `st-card`, `ts-card`, `pt-card`, `mb-card`, `led-card`, `wk-card`, `pv-card`

32 kickers also need an inline `style={{ margin: 0 }}` override, and there are 270 inline `style={{` overall.

Fix: a `styles/celeste/` base (`kicker`, `h2`, `btn`/`ghost`/`cta`, `seg`, `tabs`, `card`, `state`) on the `.vx` tokens, imported once by `Chrome.tsx`. Pages keep only their own layout.
Effort: M (mechanical, low risk with screenshots).

**D3 · Medium · Duplicated React components (should be shared).**
- `Countdown`: identical in `PartidosPage.tsx:29` and `MatchPage.tsx:36`.
- The scoreboard (teams/score/progress/last event) is triplicated: Partidos Board `:52-172`, MatchPage hero `:184-258`, LiveIsland.
- `mapsUrl`/`kitLabel`/`origin()`: Partidos, Match, Club.
- The page shell with header actions is copied 7×.
- Result letter ×7 (C2). Name helpers ×5 (C5).
- Medals: vestuario `Vitrina` and jugador «Sus medallas».
- Player compare ×2: squad `CaraACara` + `lib/squad.duelVerdict`, and stats `Comparar` + `metricValue`, with different metrics and verdicts.
- Pitch renderers ×5: MapaPosiciones, stats `st-pos-field`, club `PlantillaPosiciones` Pitch SVG, match Campo F7_SPOTS, pizarra Stage.
- Cromo/card implementations ×5: jugador/Cromo, admin/kit/Cromo, pizarra v2/Cromos, perfil CardFaces, admin CromosGrid.
- Canvas exporters ×3: matchPoster, pizarra poster/cartel, perfil shareDraw.
- Icon sets ×5: `components/celeste/icons`, `admin/ui/icons`, `perfil/icons`, `acceso/icons`, `pizarra/v2/icons`, plus lucide in the legacy route-states.
- Date formatters: 21 files build their own `Intl.DateTimeFormat`.

Fix priority: Countdown/Scoreboard → PlayerLink/nameFor → resultLetter/jornadaOf → SeasonPicker → StatePanel → Tabs. The icons are a later consolidation into one sprite with per-area aliases.
Effort: M overall.

**D4 · Low-Medium · Tokens.**
- The `.vx` token layer (`vestuario.css`) is the right base, but generated ports carry raw hex: `pizarra.css` 367, `perfil.css` 361, `acceso.css` 227, `admin.css` 136 (generated, not to be hand-edited), `vestuario.css` 134, `stats.css` 99.
- `posiciones.css:14-27` gives `--pos-*` **off-palette defaults** (`#6cc4ff`, `#ffd23f`, `#5ee08a`, `#ff8f8f`) instead of sky `#6CABDD` and gold `#FFC659`. Every host must remap them: jugador.css ×12, perfil-app ×11, squad ×24, admin plantilla ×19. A new host that forgets to remap gets yellow and green, and no day theme.
- Pages alias tokens locally (`--st-gold`, `--st-sky`, `--cl-gold`).
- 367 `@keyframes` with many near-duplicates (ping ×5, spin ×5, shine ×4, rise ×3, fade ×3).
- An ad-hoc z-index scale (0–6, 8, 30, 40, 41, 60).

Fix: default `--pos-*` to `var(--sky)`/`var(--gold)`/`var(--ink)` from `.vx`, and add a small motion and z-index token set.
Effort: S–M.

**D5 · Low · Router/schema leftovers.**
`plantillaSearchSchema` (`router.tsx:22`) is unused, `statsSearchSchema.tab` is legacy, and `MatchDetailPending`/`PlayerProfilePending` never fire (no loaders).
Effort: S.

**D6 · Low · Test gaps on cross-module flows.**
The e2e specs cover home/nav/squad/perfil/pizarra/vestuario/door/admin-crud. There's no e2e for /partidos (N1 would have been caught), /stats season switching, or the match-day chain convocar → RSVP → live → publish → MVP/porra → stats/jugador.
Effort: M.

---

## 5. Open deferred items from the ledgers and docs that still matter

From `.superpowers/sdd/2026-10-13-posiciones-*/progress.md`, `docs/superpowers/specs/2026-10-13-posiciones-y-sistemas-design.md` and the memory notes:

1. **This audit is the deferred "auditoría transversal de módulos y sincronización en vivo"** (spec, «Fuera de alcance»). The live-sync half (do all modules update together during a match: island, ficha, pizarra, admin, vestuario) still needs a real-session run. En juego live logging has never been exercised in a real match (memory, admin-redesign).
2. **«Rombo alto» renders as a zig-zag**: MCO sits behind MI/MD (fase1 Task 4). 2-1-2-1 variants print the same label in compare.ts/boards.ts.
3. **Firestore rules duplicate `POS_CODES`** and must change together (fase1 Task 6). An admin can write a non-null proposal without `by` (fase1 Task 6).
4. **Sugerir siete**: familiarity plus answer can still let an adaptado beat an in-place player at a ~6 rating gap (fase2b final). «Como siempre» is missing from «Otra posición…».
5. **Phase 3 minors**: out-of-season status copy still invites players to propose a position, and focus is lost if a new proposal arrives while the Ajustar map has focus.
6. **Phase 4 parked**: `keepStoredPositions` ignores event minutes, there's a mixed keep on pre-phase-4 actas, and the tab arrow keys step players instead of following the ARIA tabs pattern.
7. **Stack deferrals** (memory): the query-firebase adapter, the SeasonContext bridge (related to N1/N6), three r187 (knit shader), RHF v8 and pnpm 12 (Vercel) are still blocked. Cloud Scheduler isn't available in Madrid (reminders in europe-west1).
8. **Docs drift**: DESIGN.md legacy paragraph (D1) and GUIA-NUEVA-WEB.md (D1).

---

## 6. Suggested order of work

1. **Quick fixes, about one day, all S:** N1, C2, C1, C4, N2, N3, C11, D5. Together they remove the visible contradictions.
2. **Linking pass (M):** `PlayerLink`/`nameFor`, then N4, N7, N8, C5, then the Celeste `StatePanel` (N5).
3. **Shared Celeste base CSS and components (M):** D2/D3, deleting the dead layer (D1), and the `--pos-*` defaults (D4).
4. **Match ficha 2.0 (M):** C3 (real positions and system), C8 (analytics placement), C7 (shared RSVP/porra/MVP), and a pizarra link.
5. **Features:** members' «Hoy» (#1), La caja (#2), ausencias (#3), season recap (#4), notifications centre (#5).
