# Bloque 2 — todo enlazado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** From any screen you can reach the related one. Every squad member's name is a link. Public pages, the admin and the pizarra link to each other for the same match or player. «Volver» respects where you came from. Errors, loading and «no existe» have a Celeste page instead of a dead end.

**Source of truth:**
- `docs/auditoria/2026-10-14-integracion-y-huecos.md`, findings N4, N5, N7, N8, N9, N11, C9, plus the navigation-graph table in §1.1 (exact file:line for each missing link).
- Block 1 helpers: `src/lib/derived/names.ts` (`nameFor`), `src/lib/matchTabs.ts` (match tab URL).

## Global Constraints
- Block 1 constraints apply: pnpm, no `any`, Spanish copy, never colour alone, reduced motion, `git add <files>`, no new deps, no browsers/WebGL from agents, never production.
- Links use TanStack Router `<Link>` (typed routes). Never build URL strings by hand when a typed route exists.
- A link must look like a link in its context. Underline or highlight on hover/focus, visible focus ring, ≥ 44 px targets on touch where it is a standalone control. Don't restyle text that is already a link.
- Admin-only shortcuts render only for admins (`isAdmin` from the existing auth/team context). Member-only shortcuts render only for linked members.
- New shared components live in `src/components/celeste/` with their CSS in the Celeste base stylesheet that `Chrome.tsx` already loads, or a new `celeste-links.css` imported there.

## Review Focus
1. **Data stays the same.** No page changes its data or layout beyond turning text into links and adding the named shortcuts.
2. **Permissions.** Admin shortcuts never show to members or fans; member shortcuts never show to fans.
3. **Back.** «Volver» goes back in history when the previous entry is in the app. On a first load or deep link it goes to the section.
4. **Errors.** A Firestore error shows the error panel, not «no encontrado». An unknown URL shows the 404, not a silent redirect.
5. **Phone 390.** Links inside dense rows (scorers, minutes) remain tappable and don't break layouts.

---

### Task 1: `PlayerLink` everywhere a squad member is named
**Files:** create `src/components/celeste/PlayerLink.tsx` (+ test). Callers, per N4:
- `MatchPage.tsx:219-236` (hero scorers);
- `match/Tabs.tsx` (Campo player card `fc-pinfo`, minutes chart, MVP leader, crónica chapters, bench);
- `PartidosPage.tsx` (pichichi aside);
- `home/Sections.tsx:137-203` (podium, birthdays);
- `stats/Race.tsx:136`;
- `JugadorPage.tsx` («Sus cambios» partners);
- `ClubPage.tsx` (captain);
- `club/PlantillaPosiciones.tsx` (if names appear).

**`PlayerLink`:**
- Signature: `<PlayerLink id seasonId? className? children?>`. It renders `nameFor(player, seasonId)` (or `children`) as a `<Link to="/jugadores/$playerId" search={season ? { season } : undefined}>`.
- An unknown id renders plain text.
- Optional `variant="quiet"` for dense places: inherits colour, underline on hover/focus only.

Tests: renders a link with the season, falls back to text, and one caller per page renders links.

Commit: `feat(navegacion): cada jugador nombrado lleva a su página`

### Task 2: public ↔ admin ↔ pizarra shortcuts
**Files:**
- `MatchPage.tsx`;
- `JugadorPage.tsx`;
- admin `views/Partidos.tsx`, `live/EnJuego.tsx`, `views/Convocar.tsx`;
- the admin palette (`AdminLayout.tsx:140-190`, `palette/*`);
- `shell/context.ts` (add a «pizarra» target);
- pizarra `v2/ficha.ts` / the ficha component;
- the pizarra match band.

**Shortcuts:**
- **Match page:**
  - admins get «Editar acta» → `/admin/partidos/$id?tab=acta` (or «Abrir en la Sala de control» before the match);
  - members get «La pizarra de este partido» → `/pizarra?tablero=<official board id>` when an official board exists.
- **Jugador page:**
  - his own page (linked member) → «Editar tu carta» → `/profile`;
  - admins → «Editar ficha» → `/admin/plantilla?jugador=<id>`.
- **Admin:**
  - the match workspace and En juego → «Ver en la web» → `/matches/$id` (new tab not needed; plain link);
  - Convocar's «La pizarra» row becomes a link to the pizarra board for that match;
  - palette commands «Ver en la web» (current entity) and «Abrir la pizarra (J… · rival)».
- **Pizarra:**
  - the ficha has «Ver su página» → `/jugadores/$id`;
  - the board's linked match → `/matches/$id`;
  - admins get «Convocar» → `/admin/convocar?j=<matchId>`.

Tests per surface: shown or hidden by role, and the href is correct.

Commit: `feat(navegacion): la web, la sala de control y la pizarra se enlazan entre sí`

### Task 3: next-match and season links + Comparar in the URL
**Files:**
- home `MatchHero.tsx:189-198`;
- `PartidosPage.tsx` board;
- vestuario `Hero.tsx`;
- `router.tsx` (stats search `a`, `b` for Comparar);
- `stats/Panes.tsx` Comparar (picks from the URL);
- `JugadorPage.tsx` («Comparar con…»);
- perfil `TabTemporada.tsx` and `DondeHasJugado.tsx`;
- `squad/FichaModal.tsx` («Cara a cara» stays in-page).

**Links:**
- The next (not live) match hero, board and vestuario hero link to the match page («Ver la previa»).
- Comparar picks live in `?view=compare&a=<id>&b=<id>` (validated; unknown ids ignored). The jugador page has «Comparar con…», which opens `/stats?view=compare&a=<him>`.
- Perfil Temporada links «Ver tus estadísticas» → `/stats?season=` and «Dónde has jugado» → `/stats?view=positions`.

Tests: Comparar reads and writes the URL; the links' hrefs.

Commit: `feat(navegacion): la previa, el cara a cara y tus estadísticas con su enlace`

### Task 4: «Volver» with memory + Celeste states + 404 + legacy admin gate
**Files:**
- `MatchPage.tsx:171` and `JugadorPage.tsx:214` (back);
- create `src/components/celeste/BackLink.tsx` and `src/components/celeste/StatePanel.tsx` (+ CSS);
- `route-states.tsx` (RouteError → StatePanel with chrome);
- `router.tsx` (a not-found route instead of `<Navigate to="/">`, :103);
- pages that ignore `useClubData().error`: Home, Partidos, Match, Club, Vestuario (N5);
- `RootLayout.tsx:368-372` (non-admin on /admin → Celeste panel «Solo para la capitanía» with a way back).

**`BackLink`:**
- If the router history has a previous in-app entry, it goes back; else it links to the section.
- Label: «Volver», or «Partidos» / «Plantilla» when it falls back.

**`StatePanel`:**
- Props: `kind: loading | empty | error | notfound`, title, body, action.
- Celeste look: the site chrome stays visible on immersive pages. Copy: «Fuera de juego» for the 404, with links to Inicio and Partidos.

**Errors:** an error is never presented as «no encontrado».

Tests: BackLink both paths; StatePanel kinds; the 404 route renders; MatchPage error vs not-found.

Commit: `feat(navegacion): volver a donde estabas y estados con la piel Celeste`

### Task 5: glossary — «Fichas» is not four things
**Files:**
- the admin nav (`shell/nav.ts`) and section titles;
- `PRODUCT.md` (glossary section).

**Rename:**
- The admin section «Fichas», which handles account claims, becomes «Cuentas». Keep the route path, or add a redirect so old links work (`/admin/fichas` → `/admin/cuentas` if the path changes; keeping the path is fine).
- Add to PRODUCT.md a short glossary: ficha (a player's record), carta (the member's card), cromo (the pizarra/jugador collectible card), vitrina (medals and trophies), acta (match report), convocatoria, el siete.

Tests: nav label, palette search finds «Cuentas» and «fichas» (alias).

Commit: `docs(glosario): una palabra por cosa y «Cuentas» en la sala de control`

### Task 6 (controller)
- Screenshots of match, jugador, stats Comparar, home, partidos and admin, at 1440 and 390, as admin and as a non-admin member (if the emulator allows).
- lint, unit tests, build, e2e.
- Whole-branch review, PR, merge.
