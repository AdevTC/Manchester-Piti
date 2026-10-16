# «Tu temporada en 10 cromos»: Implementation Plan

> **For agentic workers:** subagent-driven, speed mode. Two parallel agents on disjoint files, one whole-branch review at the end.

**Spec:** `docs/superpowers/specs/2026-10-16-temporada-en-cromos-design.md` (binding).

## Contract shared by both tasks
`src/lib/derived/seasonRecap.ts` exports:

```ts
export type RecapCard =
  | { kind: "portada"; name: string; number: string; season: string }
  | { kind: "partidos"; played: number; minutes: number | null }
  | { kind: "goles"; goals: number; assists: number; best: { matchId: string; label: string; goals: number; assists: number } | null }
  | { kind: "mvp"; times: number; votes: number }
  | { kind: "socio"; partnerId: string; partnerName: string; combined: number }
  | { kind: "posiciones"; codes: { code: string; minutes: number }[]; main: string | null }
  | { kind: "porra"; rank: number; of: number; points: number }
  | { kind: "medallas"; medals: { id: string; label: string }[] }
  | { kind: "equipo"; g: number; e: number; p: number; gf: number; ga: number; biggest: { label: string; score: string } | null }
  | { kind: "cierre"; season: string };
export interface SeasonRecap { seasonId: string; seasonName: string; partial: boolean; cards: RecapCard[] }
export function seasonRecap(input: RecapInput, playerId: string, seasonId: string): SeasonRecap | null;
export function recapAvailable(input: RecapInput, playerId: string, seasonId: string, now: number): "closed" | "partial" | null;
```

- `RecapInput` is whatever the perfil already has: matches, players, seasons, `mvpResults`, `porraStandings` rows. Task A defines it from the perfil data hooks (`src/pages/perfil/useProfileData.ts`) and documents it at the top of the file.
- Cards with no data are left out, per the spec.
- Task A also exports `drawRecapCard(canvas, card, ctx: { theme, shirt })` and `recapCardBlob(card, ctx)` from `src/pages/perfil/recapDraw.ts`: 1080×1920 canvas, fonts loaded first.

## Task A: the model and the renderer
**Files:** `src/lib/derived/seasonRecap.ts` (+ tests) and `src/pages/perfil/recapDraw.ts` (+ tests for pure layout values and font loading, with `document.fonts` mocked).

**Reuse:**
- `minutesOf` (never invent minutes), `resultLetter`, `nameFor`, `jornadaOf`;
- `playerPositions` (`src/lib/positionStats.ts`) and `mvpOfFrom`;
- `vitrina` (`src/lib/vestuario.ts`);
- the socio logic in `src/pages/perfil/TabTemporada.tsx` (extract it to `src/lib/derived` if it's inline);
- the perfil share renderer helpers (`shareDraw.ts`, `shareLayout.ts`), plus `matchPoster.ts`'s font loading.

**Tests:** a fixture season covering legacy actas, no porra, no MVP and a mid-season «hasta ahora». The numbers must equal what perfil and stats show for the same fixture.

## Task B: the viewer, the perfil block and the vestuario banner
**Files:** new `src/pages/perfil/RecapStory.tsx` + `recap.css` (prefix `rc-`), the block in `TabTemporada.tsx`, a banner in the vestuario (`src/pages/vestuario/`), and tests.

**Viewer:**
- A full-screen dialog on phone, a centred 9:16 frame on desktop.
- Progress bar, tap zones and arrow keys, Esc closes, focus trapped and returned.
- Reduced motion: no auto-advance and no transitions.

**Each card:** an on-page DOM rendering of the card (not the canvas), so it is readable and accessible. «Compartir» uses Web Share with the file from `recapCardBlob`, falling back to download. «Descargar todas» saves the images one by one.

**Placement:**
- The block shows for linked members when `recapAvailable` is not null, labelled «hasta ahora» when partial.
- The vestuario banner shows for 14 days after close.

**Until Task A lands:** code against the contract, with a local stub of `seasonRecap` in tests only.

**Design:**
- Follow the perfil «La carta» look.
- Avoid: a cream background, italic accent words, numbered «01/02» labels, pill buttons with gradients, and generic «Spotify Wrapped» confetti.

## Controller
- Seed the emulator with a closed season.
- Take screenshots at 390 and 1440, in both themes.
- Render each card's PNG via the page to check the canvas output.
- Run lint, unit, build and e2e.
- Do the whole-branch review, then the PR and the merge. It's web only: no rules or functions.
