# Bloque 5: base de diseño Celeste. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** One Celeste design base instead of page stylesheets acting as the component library. Delete the dead legacy layer, give the shared pieces one home, and make the tokens safe by default, with no visible change on any live page.

**Source of truth:** `docs/auditoria/2026-10-14-integracion-y-huecos.md` §4 (D1–D5) and §5 item 8. Also two items parked in earlier blocks: `admin.css`'s generator still emits V/E/D letters (G·E·P is the rule), and `MatchEditor.tsx` has its own tab-key handling (`src/lib/tabKeys.ts` is the shared one).

**Execution (user asked for speed, 2026-10-15):** two waves of two parallel agents on disjoint files. No per-task review. One whole-branch review plus screenshots at the end.
- Wave A: Task 1 + Task 2.
- Wave B: Task 3 + Task 4.

## Global Constraints
- Blocks 1–4 constraints apply: pnpm, no `any`, Spanish copy, never colour alone, reduced motion, `git add <files>` only (never `-A`), no new deps, no browsers or WebGL from agents, never production.
- **No visual change on live pages.** This block moves and deletes code. Where two variants differ, keep what the page shows today.
- **Class names stay the same** (`hm-kick`, `hm-h2`, `hm-btn`, `hm-ghostbtn`, `st-card`, `st-seg`, `pt-chip`…). They move to the base; they are not renamed.
- Parallel agents share one working tree. Each touches only its own task's files, commits only its own paths, and runs only its own focused tests plus `tsc -b` and lint. Failures in the other agent's files are expected while it works.
- `admin.css` is generated, so change its generator, not the output.

## Review Focus
1. **Nothing live disappears.** Every deleted file has no importer, checked by grep including dynamic `import()` and CSS `@import`. Every moved class still reaches every page that uses it, including a direct SSR load of `/stats`, `/partidos` and `/matches/$id`, not only in-app navigation.
2. **Cascade order.** Moving rules into a base loaded once can change which rule wins. Bloque 4 hit this with `stats.css` vs `home.css`. Equal-specificity pairs need checking.
3. **Day and night themes.** The token changes keep both themes, and `--pos-*` hosts that relied on remaps look the same.
4. **Phone 390.** Nothing shifts.
5. **Docs** describe what exists.

---

### Task 1: delete the dead layer (D1) and the router leftovers (D5)
**Files:** the D1 list in the audit, `src/router.tsx`, `src/route-states.tsx`, `src/pages/stats/Panes.tsx` (OpponentBadge), `src/components/ui/*` (unused shadcn), `DESIGN.md`, `docs/GUIA-NUEVA-WEB.md`, `src/pages/pizarra/usePizarraPlayers.ts` (`setInjured`).

**Deletion:**
- For every file in D1, re-check it has no importer. Delete it with `git rm`. This includes `src/components/match/*` (BoardBits is only used inside it).
- Move `OpponentBadge` off `analytics.css`/`--mp-*` to Celeste tokens, with the same look. If `analytics.css` then has no importer, delete it.
- Delete the unused shadcn components.
- Before removing anything from `index.css`, `theme.css`, `tailwind.css` or `club.css`, audit what they still style. Remove only rules with no consumer; RouteError, the admin gate and the demo banner must keep their look.
- D5: remove `plantillaSearchSchema`, the legacy `statsSearchSchema.tab` (after grep), and the `MatchDetailPending`/`PlayerProfilePending` that never fire.

**Docs:**
- DESIGN.md: replace the legacy paragraph with what is live.
- GUIA-NUEVA-WEB.md: invitations instead of the team password, and the home as it is now.

**Tests:** existing ones stay green. Delete tests of deleted files.

**Commit:** `chore(limpieza): fuera la capa antigua que ya nadie carga`

### Task 2: tokens safe by default (D4) + G·E·P in the admin generator + one tab-key helper
**Files:**
- `src/styles/posiciones.css` (or wherever `--pos-*` defaults live), plus the host remaps in `jugador.css`, perfil-app, squad and admin plantilla;
- the `admin.css` generator (find it) and its output;
- `src/pages/admin/partidos/MatchEditor.tsx`;
- `src/lib/tabKeys.ts`.

**Tokens:**
- `--pos-*` defaults come from the `.vx` palette (`var(--sky)`, `var(--gold)`, `var(--ink)`…), so a new host gets Celeste and the day theme for free.
- Remove each host remap that becomes identical to the default. Keep a remap only where the host deliberately differs.
- Add a small z-index scale and a motion-duration set as custom properties on `.vx`. Use them only where this task already edits; no sweep.

**Admin generator:** emit G·E·P (`resultLetter` / `RESULT_WORD` from `src/lib/derived/result.ts`) instead of V/E/D. Regenerate the output.

**Tab keys:** `MatchEditor.tsx` uses `tabForKey` from `src/lib/tabKeys.ts` instead of its own copy, with the same behaviour.

**Tests:** a token test if practical (the defaults resolve to palette vars), the generator output, and MatchEditor keys.

**Commit:** `refactor(diseño): tokens de posiciones con la paleta y G·E·P también en la sala de control`

### Task 3: the Celeste base stylesheet (D2)
Wave B. It runs after Task 1, because Task 1 deletes CSS this task would otherwise move.

**Files:**
- new `src/styles/celeste/` with `kicker.css`, `type.css` (h2/h1 sizes), `buttons.css`, `seg.css`, `tabs.css`, `card.css`, `state.css` (or a single `base.css` if smaller), imported once by `src/components/celeste/Chrome.tsx`;
- `home.css`, `partidos.css`, `stats.css`, `src/styles/st-base.css` (from block 4);
- the pages that import another page's CSS only for shared classes.

**Move, don't rename:**
- Move the shared rules out of the page stylesheets: `hm-btn`, `hm-ghostbtn`, `hm-kick`, `hm-sr`, `hm-cta-top`, `hm-h2`; `pt-chip`, `pt-res`, and `pt-board` if shared; `st-card`, `st-seg`, `st-empty`, `st-new`; plus the `st-base.css` content.
- Each page keeps only its own layout.
- Remove a page's import of another page's stylesheet once nothing else needs it from there.
- The admin (`EnJuego`/`Partidos`) imports `partidos.css`. Give it what it uses from the base, or keep the import if the admin's `.adm` scope needs it, and say which.

**Cascade:**
- The base loads before the page sheets, so a page override still wins.
- Check every equal-specificity pair the move reorders, and list them in the report.
- Check direct SSR loads: `Chrome.tsx` is in the SSR shell; confirm via `src/entry-server.tsx` or the shell template.

**Kicker margins:**
- The 32 kicker uses with inline `style={{ margin: 0 }}`: if the base kicker can default to `margin: 0` without changing any page (check each use), do it and remove the inline styles.
- Otherwise leave them and say why.

**Docs:** DESIGN.md gets a short «Base Celeste» section listing the shared classes and where they live.

**Tests:** existing ones stay green. CSS has no unit tests, so the controller screenshots.

**Commit:** `refactor(diseño): una base Celeste para títulos, botones, segmentos, tarjetas y estados`

### Task 4: shared match bits (D3, first step)
Wave B, in parallel with Task 3. It touches only TSX and `src/lib`, never CSS.

**Files:** `PartidosPage.tsx`, `MatchPage.tsx`, `ClubPage.tsx`, `LiveIsland.tsx`, new `src/components/celeste/Countdown.tsx`, new `src/lib/derived/venue.ts` (or the closest existing file), tests.

**Changes:**
- `Countdown` is identical in Partidos and Match. Make it one component with one prop API and the same markup and classes.
- `mapsUrl`, `kitLabel` and `origin()` from Partidos, Match and Club become one pure module with tests.
- Scoreboard (Partidos board, Match hero, LiveIsland): extract only the pure parts they repeat (teams/score model, last-event line) into `src/lib/derived/scoreboard.ts` with tests. Keep each one's markup.
- Date formatters: no sweep. Only the three files this task touches use a shared `fmt` helper if one exists in `src/lib`.

**Commit:** `refactor(partidos): una cuenta atrás, un marcador y una forma de llegar al campo`

### Task 5 (controller)
- Shoot before and after for every page, at 1440 and 390, in day and night themes: `/`, `/partidos`, `/matches/hist-1` (each tab), `/stats` (each view), `/jugadores`, `/jugadores/$id`, `/club`, `/vestuario`, `/profile`, `/admin/partidos`, the 404 page, and the pizarra 2D (no WebGL).
- To get the "before" shots, check out main in a worktree and shoot it first, or diff against the bloque 4 shots.
- Fix any visual diff.
- Run lint, unit tests, build and e2e.
- Do the whole-branch review, then the PR and merge.
