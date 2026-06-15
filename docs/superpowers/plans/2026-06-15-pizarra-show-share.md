# La Pizarra — Show & share (Sub-proyecto 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox steps. UI via `/impeccable` + "Floodlit Clubhouse".

**Goal:** Shareable/broadcast moments for the board — a PNG matchday poster + Web Share, a one-by-one XI presentation reveal, a floodlight sweep, side-by-side lineup compare, and link-to-match with scoreline.

**Architecture:** A dependency-free `poster.ts` draws the poster on a 2D canvas (page fonts via `document.fonts.ready`) and exports/shares it. The XI reveal + floodlight sweep are CSS enhancements over the existing `presentMode`. Compare reuses `teamRating`/`lineStats` via a new `ratingForLineupDoc` helper. Link-to-match stores `matchId` in board state and persists it through `useLineups.save`.

**Tech Stack:** React 19 + TS strict + Canvas 2D + Web Share API L2 (feature-detected) + existing `FlapNumber`/`FloodlightCanvas`/`useSeasonMatches`/`useLineups`/`chemistry`. No new deps. No Firestore changes.

**Spec:** `docs/superpowers/specs/2026-06-15-pizarra-show-share-design.md`. Scope: all 5 pieces.

**Branch:** `feat/pizarra-share` (created). `git add <files>`, commit per task, never `-A`/`--no-verify`/force-push. Verify each task: `npm run build` + `npm run lint` (read output). No vitest (sub-project 4).

---

## File Structure

**New:** `src/pages/pizarra/poster.ts` (canvas draw + export + share), `src/pages/pizarra/SharePanel.tsx` (preview + download/share), `src/pages/pizarra/CompareView.tsx` (tale-of-the-tape).

**Modified:** `src/pages/pizarra/chemistry.ts` (`ratingForLineupDoc`), `src/pages/pizarra/Pizarra.tsx` (reveal + FlapNumber + sweep + matchId + link + share/compare buttons + scoreline band), `src/pages/pizarra/useLineups.ts` (persist `matchId`), `src/pages/pizarra/PizarraControls.tsx` (buttons), `src/pages/pizarra/Pizarra.css` (poster dialog, broadcast, sweep, compare, scoreline).

---

### Task 0: Baseline
- [ ] `npm run build` exit 0; `npm run lint` 0 errors. Branch `feat/pizarra-share`.

---

### Task 1: `chemistry.ts` — `ratingForLineupDoc` helper

**Files:** Modify `src/pages/pizarra/chemistry.ts`.

- [ ] **Step 1:** Append a helper that builds `PlacedPlayer[]` from a stored board and rates it. It needs the same season `statsById`/`norms` and a player lookup for natural position + seasons.

```ts
import type { SlotState } from "./formations"; // add to existing imports if not present
import type { PlayerStats } from "../../lib/playerStats"; // already imported
import { EMPTY_STATS } from "../../lib/playerStats"; // add

export interface PlayerMeta {
  naturalPosition?: import("./formations").Zone;
  seasonsCount: number;
}

/** Rate an arbitrary stored lineup (slots + per-lineup positions) against the
 *  season's stats/norms. Used by the compare view. */
export function ratingForLineupDoc(
  slots: SlotState[],
  playerPositions: Record<string, import("./formations").Zone>,
  statsById: Map<string, PlayerStats>,
  metaById: Map<string, PlayerMeta>,
  norms: SquadNorms,
): { rating: Rating; lines: LineStat[] } {
  const placed: PlacedPlayer[] = slots
    .filter((s) => s.playerId)
    .map((s) => {
      const id = s.playerId as string;
      const z = playerPositions[id] ?? metaById.get(id)?.naturalPosition;
      return {
        id,
        s: statsById.get(id) ?? EMPTY_STATS,
        seasons: metaById.get(id)?.seasonsCount ?? 0,
        zone: s.zone,
        outOfPosition: !!z && z !== s.zone,
      };
    });
  const empty = slots.length - placed.length;
  return { rating: teamRating(placed, empty, norms), lines: lineStats(placed) };
}
```
(Keep the existing `import type { Zone } from "./formations"` and add `SlotState`; or use the inline `import("./formations").Zone` shown. Prefer a clean named import — adjust the existing import line to `import type { SlotState, Zone } from "./formations";` and use `Zone`/`SlotState` directly, and `import { EMPTY_STATS, type MatchLike, type PlayerStats, type StatEvent } from "../../lib/playerStats";`.)

- [ ] **Step 2:** `npm run build` exit 0; `npm run lint` 0. Commit:
```bash
git add src/pages/pizarra/chemistry.ts
git commit -m "feat(pizarra): rate an arbitrary stored lineup (compare helper)"
```

---

### Task 2: `poster.ts` — canvas poster + export + share

**Files:** Create `src/pages/pizarra/poster.ts`.

- [ ] **Step 1: Write the file**

```ts
// Matchday poster, drawn dependency-free on a 2D canvas. The page already loads
// Anton/Archivo, so after `document.fonts.ready` ctx.fillText uses them. Pure
// drawing + export + share helpers; no React.
import type { Zone } from "./formations";

export interface PosterToken {
  number: number;
  name: string;
  x: number; // % of pitch box
  y: number; // % of pitch box
  zone: Zone;
}

export interface PosterMatch {
  rival: string;
  gf: number;
  gc: number;
  outcomeWord: string; // "Victoria" | "Empate" | "Derrota"
  outcomeLetter: string; // "V" | "E" | "D"
}

export interface PosterData {
  title: string; // "MANCHESTER PITI"
  seasonName: string;
  formation: string;
  tokens: PosterToken[];
  score: number;
  tier: string;
  match?: PosterMatch | null;
  crest?: HTMLImageElement | null;
}

const NAVY = "#0c1733";
const NAVY_DEEP = "#0a1228";
const SKY = "#6CABDD";
const GOLD = "#FFC659";
const INK = "#f4f7fb";
const MUTED = "#9fb6d6";

export async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const W = 1080;
const H = 1350;

export async function drawPoster(canvas: HTMLCanvasElement, d: PosterData): Promise<void> {
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* fonts optional */ }
  }

  // Background
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  // Halftone dots
  ctx.fillStyle = "rgba(108,171,221,0.10)";
  for (let y = 0; y < H; y += 26) {
    for (let x = 0; x < W; x += 26) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header band
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = "700 22px 'Archivo', sans-serif";
  ctx.fillText(d.seasonName.toUpperCase() + "  ·  " + d.formation, 64, 96);
  ctx.fillStyle = INK;
  ctx.font = "64px 'Anton', sans-serif";
  ctx.fillText(d.title.toUpperCase(), 60, 168);
  ctx.fillStyle = GOLD;
  ctx.fillRect(64, 188, 96, 8);

  // Pitch box
  const px = 64, py = 240, pw = W - 128, ph = 720;
  ctx.fillStyle = NAVY_DEEP;
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 14, py + 14, pw - 28, ph - 28);
  ctx.beginPath();
  ctx.moveTo(px + 14, py + ph / 2);
  ctx.lineTo(px + pw - 14, py + ph / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph / 2, 56, 0, Math.PI * 2);
  ctx.stroke();

  // Tokens
  d.tokens.forEach((t) => {
    const cx = px + (t.x / 100) * pw;
    const cy = py + (t.y / 100) * ph;
    ctx.fillStyle = SKY;
    roundRect(ctx, cx - 26, cy - 30, 52, 52, 9);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = "30px 'Anton', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(t.number), cx, cy + 8);
    ctx.fillStyle = INK;
    ctx.font = "700 17px 'Archivo', sans-serif";
    ctx.fillText(truncate(ctx, (t.name || "").toUpperCase(), 120), cx, cy + 44);
    ctx.textAlign = "left";
  });

  // Chemistry block
  const cyBlock = py + ph + 90;
  ctx.fillStyle = MUTED;
  ctx.font = "700 20px 'Archivo', sans-serif";
  ctx.fillText("VALORACIÓN DEL ONCE", 64, cyBlock - 44);
  ctx.fillStyle = SKY;
  ctx.font = "150px 'Anton', sans-serif";
  ctx.fillText(String(d.score), 60, cyBlock + 78);
  const scoreW = ctx.measureText(String(d.score)).width;
  ctx.fillStyle = MUTED;
  ctx.font = "40px 'Anton', sans-serif";
  ctx.fillText("/100", 60 + scoreW + 12, cyBlock + 78);
  ctx.fillStyle = GOLD;
  ctx.font = "700 26px 'Archivo', sans-serif";
  ctx.fillText(d.tier.toUpperCase(), 64, cyBlock + 120);

  // Match scoreline (optional)
  if (d.match) {
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = "90px 'Anton', sans-serif";
    ctx.fillText(`${d.match.gf}-${d.match.gc}`, W - 64, cyBlock + 60);
    ctx.fillStyle = MUTED;
    ctx.font = "700 22px 'Archivo', sans-serif";
    ctx.fillText(`${d.match.outcomeWord.toUpperCase()} · ${d.match.rival.toUpperCase()}`, W - 64, cyBlock + 96);
    ctx.textAlign = "left";
  }

  // Crest watermark
  if (d.crest) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(d.crest, W - 150, 64, 86, 86);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Share the blob as a file (Web Share L2) or fall back to a download. */
export async function sharePoster(blob: Blob, filename: string, shareTitle: string): Promise<"shared" | "downloaded"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = new File([blob], filename, { type: "image/png" });
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return "shared";
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
```

- [ ] **Step 2:** `npm run build` exit 0; `npm run lint` 0. Commit:
```bash
git add src/pages/pizarra/poster.ts
git commit -m "feat(pizarra): dependency-free matchday poster (canvas) + share/download"
```

---

### Task 3: `SharePanel.tsx` — preview + share/download dialog

**Files:** Create `src/pages/pizarra/SharePanel.tsx`.

- [ ] **Step 1: Write the component.** It owns an offscreen canvas, draws on open (async, loading the crest once), shows the rendered PNG as an `<img>` preview, and offers Share/Download.

```tsx
import React, { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { canvasToBlob, drawPoster, loadImage, sharePoster, type PosterData } from "./poster";

interface SharePanelProps {
  data: PosterData;
  onClose: () => void;
}

export const SharePanel: React.FC<SharePanelProps> = ({ data, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const crest = await loadImage("/crest.png");
      await drawPoster(canvas, { ...data, crest });
      const blob = await canvasToBlob(canvas);
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data]);

  const onShare = async (): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    const result = await sharePoster(blob, "manchester-piti-once.png", "Mi once · Manchester Piti");
    setNote(result === "shared" ? "Compartido" : "Descargado");
  };

  return (
    <div className="pz-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="pz-share" role="dialog" aria-modal="true" aria-label="Compartir el once" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pz-share-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        <h3 className="pz-dialog-title">Compartir el once</h3>
        <div className="pz-share-preview">
          {preview ? <img src={preview} alt="Vista previa del póster del once" /> : <span className="pz-share-loading">Generando póster…</span>}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
        <div className="pz-dialog-actions">
          {note && <span className="pz-share-note" role="status">{note}</span>}
          <button type="button" className="pz-btn-ghost" disabled={busy} onClick={() => void onShare()}>
            <Share2 size={15} aria-hidden="true" /> Compartir
          </button>
          <button type="button" className="pz-btn-solid" disabled={busy} onClick={() => void onShare()}>
            <Download size={15} aria-hidden="true" /> Descargar
          </button>
        </div>
      </div>
    </div>
  );
};
```
(Both buttons call the same share-or-download path; on desktop both download, on mobile Share offers the native sheet. Keep it that simple.)

- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/SharePanel.tsx
git commit -m "feat(pizarra): share panel (poster preview + share/download)"
```

---

### Task 4: `CompareView.tsx` — tale of the tape

**Files:** Create `src/pages/pizarra/CompareView.tsx`.

- [ ] **Step 1: Write the component.** Two selects (board A, board B from `mine`+`official`), two columns + center VS, each showing chemistry score, tier, formation, and the 3 line stats. Uses `ratingForLineupDoc`.

```tsx
import React, { useState } from "react";
import { X } from "lucide-react";
import type { LineupDoc } from "./lineupDoc";
import { ratingForLineupDoc, type PlayerMeta } from "./chemistry";
import type { PlayerStats } from "../../lib/playerStats";
import type { SquadNorms } from "./chemistry";
import { ZONE_LABEL } from "./formations";

interface CompareViewProps {
  boards: LineupDoc[]; // mine + official, deduped
  statsById: Map<string, PlayerStats>;
  metaById: Map<string, PlayerMeta>;
  norms: SquadNorms;
  onClose: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ boards, statsById, metaById, norms, onClose }) => {
  const [aId, setAId] = useState(boards[0]?.id ?? "");
  const [bId, setBId] = useState(boards[1]?.id ?? boards[0]?.id ?? "");
  const A = boards.find((x) => x.id === aId);
  const B = boards.find((x) => x.id === bId);

  const evalBoard = (d?: LineupDoc) =>
    d ? ratingForLineupDoc(d.slots, d.playerPositions, statsById, metaById, norms) : null;
  const ra = evalBoard(A);
  const rb = evalBoard(B);

  const col = (d: LineupDoc | undefined, r: ReturnType<typeof evalBoard>, side: "a" | "b") => (
    <div className={`pz-cmp-col pz-cmp-col--${side}`}>
      <select className="pz-select" value={side === "a" ? aId : bId} onChange={(e) => (side === "a" ? setAId : setBId)(e.target.value)} aria-label={`Tablero ${side === "a" ? "A" : "B"}`}>
        {boards.map((x) => <option key={x.id} value={x.id}>{x.name}{x.isOfficial ? " ·oficial" : ""}</option>)}
      </select>
      {r && d ? (
        <>
          <div className="pz-cmp-score">{r.rating.score}</div>
          <div className="pz-cmp-tier">{r.rating.tier}</div>
          <div className="pz-cmp-formation">{d.formation}</div>
          <ul className="pz-cmp-lines">
            {r.lines.map((l) => (
              <li key={l.zone}><span>{ZONE_LABEL[l.zone]}</span><b>{l.goals + l.assists}</b> G+A</li>
            ))}
          </ul>
        </>
      ) : <p className="pz-cmp-empty">Sin tablero.</p>}
    </div>
  );

  return (
    <div className="pz-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="pz-cmp" role="dialog" aria-modal="true" aria-label="Comparar alineaciones" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pz-share-close" aria-label="Cerrar" onClick={onClose}><X size={18} /></button>
        <h3 className="pz-dialog-title">Comparar alineaciones</h3>
        {boards.length < 1 ? (
          <p className="pz-cmp-empty">Guarda al menos un tablero para comparar.</p>
        ) : (
          <div className="pz-cmp-grid">
            {col(A, ra, "a")}
            <div className="pz-cmp-vs" aria-hidden="true">VS</div>
            {col(B, rb, "b")}
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/CompareView.tsx
git commit -m "feat(pizarra): compare two lineups (tale of the tape)"
```

---

### Task 5: `useLineups.ts` — persist `matchId` from state

**Files:** Modify `src/pages/pizarra/useLineups.ts`.

- [ ] **Step 1:** Let `save` accept an optional `matchId` so a non-official board can link a match. Change the `save` signature in `UseLineups` to `save: (id: string, lineup: Lineup, matchId?: string | null) => Promise<void>;`. In both backends, when `matchId !== undefined` write it (else preserve the existing). Firestore branch:
```ts
    const save: UseLineups["save"] = async (id, lineup, matchId) => {
      const cur = items.find((d) => d.id === id);
      const meta: LineupMeta = {
        ownerUid: cur?.ownerUid ?? uid,
        ownerNickname: cur?.ownerNickname ?? nickname,
        seasonId,
        name: cur?.name ?? "Sin nombre",
        isOfficial: cur?.isOfficial ?? false,
        matchId: matchId !== undefined ? matchId : (cur?.matchId ?? null),
      };
      await updateDoc(doc(db, "lineups", id), { ...lineupToData(lineup, meta), updatedAt: serverTimestamp() });
    };
```
Mirror the same `matchId !== undefined ? matchId : prev.matchId` logic in the local backend's `save`.

- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/useLineups.ts
git commit -m "feat(pizarra): persist board matchId through save (link to match)"
```

---

### Task 6: `Pizarra.tsx` — matchId state, link, scoreline, reveal, sweep, buttons

**Files:** Modify `src/pages/pizarra/Pizarra.tsx`.

- [ ] **Step 1: Imports**
```ts
import { FlapNumber } from "../../components/match/FlapNumber";
import { outcomeOf, OUTCOME } from "../../components/match/matchData";
import { SharePanel } from "./SharePanel";
import { CompareView } from "./CompareView";
import type { PosterData, PosterToken } from "./poster";
import type { PlayerMeta } from "./chemistry";
import type { LineupDoc } from "./lineupDoc";
```

- [ ] **Step 2: State**
```ts
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
```
On `loadDoc`, also `setActiveMatchId(d.matchId)`. On `newBoard`/`saveAs`(new) and season reset, `setActiveMatchId(null)`. (Add these lines into the existing handlers/effects.)

- [ ] **Step 3: Link-to-match (sets matchId, autosaves)**
```ts
  const linkMatch = (matchId: string | null): void => {
    if (readOnly) return;
    setActiveMatchId(matchId);
    if (activeBoardId) {
      setSaveState("saving");
      lineups.save(activeBoardId, lineup, matchId)
        .then(() => setSaveState((s) => (s === "saving" ? "saved" : s)))
        .catch(() => setSaveState("dirty"));
    }
  };
  const linkedMatch = useMemo(() => matches.find((m) => m.id === activeMatchId) ?? null, [matches, activeMatchId]);
```

- [ ] **Step 4: metaById (for compare) + boards list**
```ts
  const metaById = useMemo(() => {
    const m = new Map<string, PlayerMeta>();
    players.forEach((p) => m.set(p.id, { naturalPosition: p.naturalPosition, seasonsCount: p.seasonsCount }));
    return m;
  }, [players]);
  const compareBoards = useMemo<LineupDoc[]>(() => {
    const seen = new Set<string>();
    return [...lineups.official, ...lineups.mine].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  }, [lineups.official, lineups.mine]);
```

- [ ] **Step 5: Poster data builder**
```ts
  const posterData = useMemo<PosterData>(() => {
    const tokens: PosterToken[] = lineup.slots
      .filter((s) => s.playerId)
      .map((s) => {
        const p = playersById.get(s.playerId as string);
        return { number: p?.number ?? 0, name: p?.shirtName || p?.firstName || "", x: s.x, y: s.y, zone: s.zone };
      });
    const match = linkedMatch && linkedMatch.goalsFor != null && linkedMatch.goalsAgainst != null
      ? (() => {
          const oc = outcomeOf(linkedMatch.goalsFor as number, linkedMatch.goalsAgainst as number);
          return { rival: linkedMatch.rival, gf: linkedMatch.goalsFor as number, gc: linkedMatch.goalsAgainst as number, outcomeWord: OUTCOME[oc].word, outcomeLetter: OUTCOME[oc].letter };
        })()
      : null;
    return { title: "Manchester Piti", seasonName, formation: lineup.formation, tokens, score: rating.score, tier: rating.tier, match };
  }, [lineup, playersById, seasonName, rating, linkedMatch]);
```

- [ ] **Step 6: Scoreline band** — render above the board (after the read-only banner), when `linkedMatch` has a score:
```tsx
        {linkedMatch && linkedMatch.goalsFor != null && linkedMatch.goalsAgainst != null && (() => {
          const oc = outcomeOf(linkedMatch.goalsFor, linkedMatch.goalsAgainst);
          return (
            <div className={`pz-scoreline pz-scoreline--${oc}`} role="status">
              <span className="pz-scoreline-letter" aria-hidden="true">{OUTCOME[oc].letter}</span>
              <span className="pz-scoreline-score">{linkedMatch.goalsFor}-{linkedMatch.goalsAgainst}</span>
              <span className="pz-scoreline-text">{OUTCOME[oc].word} · {linkedMatch.rival}</span>
            </div>
          );
        })()}
```

- [ ] **Step 7: Presentation broadcast header + reveal** — inside the `pz--present` branch, add a header with crest + name + formation + chemistry FlapNumber, and give pitch tokens a stagger index. In the slots `.map`, set a CSS var for stagger: add `style={{ "--i": index } as React.CSSProperties}` to the `PitchSlot` wrapper (or token). Add the broadcast header markup right after the pitch `<div className="pz-board">` opening or as an overlay; gate with `presentMode`:
```tsx
        {presentMode && (
          <div className="pz-broadcast" aria-hidden="true">
            <img src="/crest.png" alt="" className="pz-broadcast-crest" />
            <span className="pz-broadcast-name">MANCHESTER PITI</span>
            <span className="pz-broadcast-formation">{lineup.formation}</span>
            <span className="pz-broadcast-chem"><FlapNumber value={rating.score} /></span>
          </div>
        )}
```
Pass `index` to the slot wrapper for `--i` (used by CSS reveal). The reveal only fires in present mode (CSS scoped to `.pz--present`).

- [ ] **Step 8: Floodlight sweep** — add a one-shot sweep element inside `.pz-pitch` (after `<FloodlightCanvas/>`):
```tsx
            <span className="pz-sweep" aria-hidden="true" key={`${lineup.formation}-${presentMode}`} />
```
(The `key` re-mounts it to replay the sweep on formation change / entering present. CSS animates it once.)

- [ ] **Step 9: Buttons** — pass `onShare={() => setShareOpen(true)}`, `onCompare={() => setCompareOpen(true)}` to `<PizarraControls>` (props added in Task 7). Add a "Vincular a partido" control: simplest is a small select in the controls or near the scoreline — render an admin/owner-available select of `matches` bound to `activeMatchId` → `linkMatch`. Put it in the LineupsPanel header area or as a control; for this slice add it to `PizarraControls` as a compact select (Task 7).

- [ ] **Step 10: Render dialogs** — near the settings dialog:
```tsx
      {shareOpen && <SharePanel data={posterData} onClose={() => setShareOpen(false)} />}
      {compareOpen && (
        <CompareView boards={compareBoards} statsById={statsById} metaById={metaById} norms={norms} onClose={() => setCompareOpen(false)} />
      )}
```

- [ ] **Step 11:** build + lint. Commit:
```bash
git add src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): share/compare, link-to-match scoreline, broadcast reveal, sweep"
```

---

### Task 7: `PizarraControls.tsx` — share / compare / link controls

**Files:** Modify `src/pages/pizarra/PizarraControls.tsx`.

- [ ] **Step 1:** Add props `onShare: () => void; onCompare: () => void; matches: { id: string; label: string }[]; matchId: string | null; onLinkMatch: (id: string | null) => void;`. Render a "Compartir" button (`Share2`) and "Comparar" button (`GitCompare` or `Columns2`) in the actions row (always enabled, even read-only — sharing/comparing don't mutate). Render a compact "Partido" `<select>` bound to `matchId`→`onLinkMatch` (disabled when `readOnly`), options = `[{id:"",label:"Sin partido"}, ...matches]`. Import the icons. Build the `matches` label list in `Pizarra` from `useSeasonMatches` via `matchLabel` and pass down.

- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/PizarraControls.tsx src/pages/pizarra/Pizarra.tsx
git commit -m "feat(pizarra): share/compare/link controls in the control bar"
```

---

### Task 8: `Pizarra.css` — poster dialog, broadcast, sweep, compare, scoreline

**Files:** Modify `src/pages/pizarra/Pizarra.css`.

- [ ] **Step 1:** Add styles for: `pz-share` dialog + `pz-share-preview` (image max-height ~60vh, centered) + `pz-share-close` + `pz-share-loading`/`pz-share-note`; `pz-cmp` + `pz-cmp-grid` (A | VS | B) + `pz-cmp-col`/`pz-cmp-score` (Anton large) /`pz-cmp-tier`/`pz-cmp-formation`/`pz-cmp-lines`/`pz-cmp-vs`/`pz-cmp-empty`; `pz-scoreline` band (win/draw/loss using sky/gold/red + the letter, non-color cue) + `pz-scoreline--win/draw/loss`; `pz-broadcast` header (present mode; crest + Anton name + formation + chem) ; `pz-sweep` one-shot light bar (`@keyframes pzSweep` translateX once, ~1.1s) ; present-mode token reveal (`.pz--present .pz-slot { animation: pzReveal .5s var(--mp-ease) both; animation-delay: calc(var(--i) * 0.08s); }`). Add `pz-broadcast`/`pz-sweep` to nothing-hidden in present (broadcast shows only in present). Focus rings for new buttons/close. **Reduced motion:** disable `pz-sweep` (opacity 0 / no animation), disable `.pz--present .pz-slot` reveal (animation: none), keep FlapNumber resting value. Mobile: compare grid stacks (A / VS / B vertical); poster preview full width.

- [ ] **Step 2:** build + lint. Commit:
```bash
git add src/pages/pizarra/Pizarra.css
git commit -m "style(pizarra): poster dialog, broadcast, floodlight sweep, compare, scoreline"
```

---

### Task 9: Verify + review pause

- [ ] **Step 1:** `npm run build` exit 0 + `npm run lint` 0 (2 known warnings). Paste output.
- [ ] **Step 2: Browser matrix** (`?preview`, Pizarra; save a board first so compare/link work):
  - Share: open the panel → poster preview renders (navy band, Anton title, pitch + jerseys, chemistry number, crest). Download triggers a PNG; Web Share is feature-detected (desktop falls back to download — confirm no throw).
  - Link a match → scoreline band shows with V/E/D letter + word + score; the poster includes the scoreline; the matchId autosaves (reload → still linked).
  - Compare → pick A and B → two columns with scores/tiers/lines + VS.
  - Presentation → broadcast header (crest + name + formation + chemistry FlapNumber) + tokens reveal one-by-one + floodlight sweep.
  - Light/dark, mobile/desktop, **reduced-motion** (no sweep, no stagger, FlapNumber resting, poster identical). Console clean.
  - Screenshots: poster preview, scoreline band, compare, presentation.
- [ ] **Step 3:** Update memory `pizarra-feature.md` (Sub-proyecto 3 built; files; dependency-free poster; no Firestore changes).
- [ ] **Step 4: Pause for review.** Summarize, paste build/lint + screenshots; ask before merging to `main`.

---

## Self-Review

**Spec coverage:** poster+share (Tasks 2–3) ✓; presentation reveal+FlapNumber (Task 6 step 7 + Task 8) ✓; floodlight sweep (Task 6 step 8 + Task 8) ✓; compare (Tasks 1,4,6) ✓; link-to-match+scoreline (Tasks 5,6) ✓; dependency-free + Web Share feature-detect ✓; never-fabricate (poster omits absent match; tokens from real players) ✓; no Firestore changes ✓.

**Placeholder scan:** poster.ts/SharePanel/CompareView/ratingForLineupDoc/useLineups shown as code; Pizarra integration shown as snippets at exact anchors; CSS specified by class+requirement (impeccable at build). No TODO/TBD.

**Type consistency:** `PosterData`/`PosterToken`/`PosterMatch` defined once in poster.ts, consumed by SharePanel + Pizarra builder. `ratingForLineupDoc(slots, playerPositions, statsById, metaById, norms)` + `PlayerMeta` defined in chemistry.ts, consumed by CompareView + Pizarra. `save(id, lineup, matchId?)` extended signature matches all call sites (autosave passes no matchId → preserves; linkMatch passes matchId). `outcomeOf`/`OUTCOME` reused from matchData. `FlapNumber value` prop matches.
