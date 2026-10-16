# Buscar en la web: design

Date: 2026-10-16. Idea 13 of the web audit (finding N10, `docs/auditoria/2026-10-14-integracion-y-huecos.md`). The defaults were chosen by Claude for continuous progress, and each one is easy to change.

## Purpose
From any public page, find a player, a match, a rival or a section in two keystrokes. The admin already has a command palette (`src/pages/admin/palette/*`); the public web has nothing.

## What
- **Opening it:** a search button in the header (a magnifier icon, labelled «Buscar»), plus ⌘K/Ctrl+K and «/» on desktop. It opens a dialog with a field and live results.
- **Sources** (already loaded public data, so no new reads):
  - players by shirt name, first and last name and dorsal → jugador page;
  - matches by rival, jornada («J5») and date («12 oct») → match page;
  - rivals → the rival dossier (match previa or stats Rivales);
  - seasons → /partidos?season=;
  - sections: Partidos, Plantilla, Estadísticas (and each view), El club, Clasificación, Vestuario.
  - Members also get member-only sections: Mi perfil, Pizarra, La caja.
- **Matching:** accent- and case-insensitive, with prefix and fuzzy-lite subsequence. Players and the next match rank first. At most 8 results, grouped by kind with a word label.
- **Keyboard:** arrows, Enter, Esc; the combobox and listbox ARIA pattern; focus is returned on close.
- **Empty field:** «Sugerencias» shows the next match, the pichichi and recent searches (localStorage, 5 max, wrapped in try/catch).
- **Reuse:** the admin palette's matching model, if it's pure, by extracting it to `src/lib/derived/search.ts`.

## Out of scope
Full-text search of crónicas, server search, and fans' search history synced across devices.

## Success criteria
- «hug» → Hugo's page.
- «rayo» → the matches vs Rayo and the dossier.
- «j5» → that match.
- Works with the keyboard alone at desktop, and with the button on a phone at 390.
