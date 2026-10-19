// El siete's collision pass, pure: the shirts stand where the pizarra put them (tactics, never moved); the
// night's tags and the name plates go where they don't sit on another shirt, tag or plate. Tags first: a
// column beside the shirt on the roomier side (inwards first), nudged up or down until clear, folded into two
// columns when one is too tall, down to icon-only chips (the minute stays in each chip's name) when even that
// doesn't fit. Then the plates: below the shirt, a little lower, above it; when none fits the
// plate shrinks to the dorsal the shirt already wears (the name stays for screen readers). Any seven with up
// to four tags each stays legible, whatever the lineup and the pitch's size. Coordinates: px from the pitch's
// top-left.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PitchPlayer {
  /** The shirt's box (fixed). */
  shirt: Rect;
  /** The name plate's box where the layout puts it (under the shirt). */
  plate: Rect;
  /** The tags column's size and how many tags it holds, or null without tags. */
  tags: { w: number; h: number; n: number } | null;
  /** Placed first (the viewer's own player keeps his plate). */
  first?: boolean;
}

export interface PitchPlace {
  /** «full» name plate or «num» (the dorsal on the shirt only). */
  plate: "full" | "num";
  /** Vertical move of the plate from where the layout put it. */
  plateDy: number;
  /** Side of the shirt the tags stand on. */
  tags: "l" | "r";
  /** One column of tags, or two (a tall column folded). */
  cols: 1 | 2;
  /** Chips with the minute, or icon-only chips. */
  chips: "full" | "icon";
  /** Vertical move of the tags from the shirt's top. */
  tagsDy: number;
}

/** Gap between a shirt and its tags (the CSS: calc(50% + ps/2 + 3px)), and between two tags. */
export const TAG_GAP = 3;
/** An icon-only chip's width (11 px icon, 5 px each side). */
export const ICON_CHIP = 21;
/** Air kept on each side of a name plate. */
export const PLATE_AIR = 4;

const overlap = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** How much of a box falls outside the pitch (the pitch clips it). */
const outside = (r: Rect, W: number, H: number): number => r.w * r.h - overlap(r, { x: 0, y: 0, w: W, h: H });

interface Ob {
  r: Rect;
  weight: number;
}
const cost = (r: Rect, against: readonly Ob[], W: number, H: number): number => against.reduce((s, o) => s + o.weight * overlap(r, o.r), 0) + 3 * outside(r, W, H);

/** The size of a player's tags folded into `cols` columns. */
export function tagsSize(t: { w: number; h: number; n: number }, cols: 1 | 2, chips: "full" | "icon" = "full"): { w: number; h: number } {
  const w = chips === "icon" ? Math.min(t.w, ICON_CHIP) : t.w;
  if (cols === 1 || t.n < 2) return { w, h: t.h };
  const row = (t.h + TAG_GAP) / t.n - TAG_GAP;
  const rows = Math.ceil(t.n / 2);
  return { w: 2 * w + TAG_GAP, h: rows * row + (rows - 1) * TAG_GAP };
}

/** The tags' box for a side, a fold and a vertical move. */
export function tagsBox(shirt: Rect, size: { w: number; h: number }, side: "l" | "r", dy: number): Rect {
  return { x: side === "r" ? shirt.x + shirt.w + TAG_GAP : shirt.x - TAG_GAP - size.w, y: shirt.y + dy, ...size };
}

/** Where each plate and tags block goes (same order as `players`). */
export function placePitch(players: readonly PitchPlayer[], W: number, H: number): PitchPlace[] {
  const out: PitchPlace[] = players.map((p) => ({ plate: "full", plateDy: 0, tags: p.shirt.x + p.shirt.w / 2 > W * 0.6 ? "l" : "r", cols: 1, chips: "full", tagsDy: 0 }));
  if (!W || !H) return out;
  const shirts: Ob[] = players.map((p) => ({ r: p.shirt, weight: 1 }));
  const tagsPlaced: Ob[] = [];

  // tags: the busiest players first; the plates where they'd stand weigh less (a plate can still move or shrink)
  const byTags = players.map((_, i) => i).sort((a, b) => (players[b].tags?.n ?? 0) - (players[a].tags?.n ?? 0));
  const plates: Ob[] = players.map((p) => ({ r: p.plate, weight: 0.35 }));
  for (const i of byTags) {
    const p = players[i];
    if (!p.tags || !p.tags.w) continue;
    const sides: ("l" | "r")[] = out[i].tags === "l" ? ["l", "r"] : ["r", "l"];
    let best = { side: out[i].tags, cols: 1 as 1 | 2, chips: "full" as "full" | "icon", dy: 0, c: Infinity };
    const folds = [[1, "full"], [2, "full"], [1, "icon"], [2, "icon"]] as const;
    search: for (const [cols, chips] of folds) {
      if (cols === 2 && p.tags.n < 3) continue;
      const size = tagsSize(p.tags, cols, chips);
      const penalty = (cols === 2 ? 0.5 : 0) + (chips === "icon" ? 0.75 : 0);
      const reach = Math.max(p.shirt.h, size.h);
      const dys = [0];
      for (let d = 4; d <= reach; d += 4) dys.push(d, -d);
      for (const side of sides) {
        for (const dy of dys) {
          const c = cost(tagsBox(p.shirt, size, side, dy), [...shirts, ...tagsPlaced, ...plates.filter((_, k) => k !== i)], W, H) + penalty;
          if (c < best.c) best = { side, cols, chips, dy, c };
          if (c < 1 + penalty) break search;
        }
      }
    }
    out[i].tags = best.side;
    out[i].cols = best.cols;
    out[i].chips = best.chips;
    out[i].tagsDy = best.dy;
    tagsPlaced.push({ r: tagsBox(p.shirt, tagsSize(p.tags, best.cols, best.chips), best.side, best.dy), weight: 1 });
  }

  // plates: below, a little lower, above; else the dorsal only (the viewer's first)
  const order = players.map((_, i) => i).sort((a, b) => Number(!!players[b].first) - Number(!!players[a].first));
  const placed: Ob[] = [];
  for (const i of order) {
    const p = players[i];
    const above = p.shirt.y - 2 - p.plate.h - p.plate.y;
    let done = false;
    for (const dy of [0, 3, 6, above]) {
      const r = { ...p.plate, y: p.plate.y + dy };
      // (two plates side by side keep a little air between them, so the names never run into one)
      const roomy = { ...r, x: r.x - PLATE_AIR, w: r.w + 2 * PLATE_AIR };
      if (cost(roomy, [...shirts, ...tagsPlaced, ...placed], W, H) - 3 * outside(roomy, W, H) + 3 * outside(r, W, H) < 1) {
        out[i].plateDy = dy;
        placed.push({ r, weight: 1 });
        done = true;
        break;
      }
    }
    if (!done) out[i].plate = "num";
  }
  return out;
}
