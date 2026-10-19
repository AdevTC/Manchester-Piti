// El siete's collision pass, pure. Every name stays on the pitch (the V-Inicio boards: a name centred under
// each shirt, the night's marks in a tidy column beside it, never on a name). The names go first: under the
// shirt, a little lower, a little to a side, on two lines, above the shirt; when none of that is clear the
// player himself moves a little from the pizarra's spot (at most 6 % of the pitch each way), so the tactics
// still read. Then the marks: a column on the roomier side, nudged up or down until clear, folded into two
// columns when one is too tall, down to icon-only chips (the minute stays in each chip's name), and, when both
// sides are full, a row under the name. Coordinates: px from the pitch's top-left.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PitchPlayer {
  /** The shirt's box where the pizarra puts it. */
  shirt: Rect;
  /** The name plate's box where the layout puts it (under the shirt, one line). */
  plate: Rect;
  /** The plate set on two lines (a name with a space), measured; null or absent for a one-word name. */
  plate2?: { w: number; h: number } | null;
  /** The tags column's size and how many tags it holds, or null without tags. */
  tags: { w: number; h: number; n: number } | null;
  /** Placed first (the viewer's own player). */
  first?: boolean;
}

export interface PitchPlace {
  /** The name on one line or on two. */
  plate: "one" | "two";
  /** Move of the plate from where the layout put it (px). */
  plateDx: number;
  plateDy: number;
  /** Move of the whole player (shirt and plate) from the pizarra's spot (px, within 6 % of the pitch). */
  nx: number;
  ny: number;
  /** Where the tags stand: a column left or right of the shirt, or a row below the name. */
  tags: "l" | "r" | "b";
  /** One column of tags, or two (a tall column folded). */
  cols: 1 | 2;
  /** Chips with the minute, or icon-only chips. */
  chips: "full" | "icon";
  /** The tags' box (px from the pitch's top-left), null without tags. */
  tagsAt: Rect | null;
}

/** Gap between a shirt and its tags (the CSS: calc(50% + ps/2 + 3px)), and between two tags. */
export const TAG_GAP = 3;
/** An icon-only chip's width (11 px icon, 5 px each side). */
export const ICON_CHIP = 21;
/** Air kept on each side of a name plate. */
export const PLATE_AIR = 4;
/** How far a player may move from the pizarra's spot, as a share of the pitch. */
export const NUDGE = 0.06;

const ov = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const outside = (r: Rect, W: number, H: number): number => r.w * r.h - ov(r, { x: 0, y: 0, w: W, h: H });
const move = (r: Rect, dx: number, dy: number): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
const roomy = (r: Rect): Rect => ({ x: r.x - PLATE_AIR, y: r.y, w: r.w + 2 * PLATE_AIR, h: r.h });

/** The size of a player's tags folded into `cols` columns. */
export function tagsSize(t: { w: number; h: number; n: number }, cols: 1 | 2, chips: "full" | "icon" = "full"): { w: number; h: number } {
  const w = chips === "icon" ? Math.min(t.w, ICON_CHIP) : t.w;
  if (cols === 1 || t.n < 2) return { w, h: t.h };
  const row = (t.h + TAG_GAP) / t.n - TAG_GAP;
  const rows = Math.ceil(t.n / 2);
  return { w: 2 * w + TAG_GAP, h: rows * row + (rows - 1) * TAG_GAP };
}

/** The tags' box beside a shirt (`l`/`r`, moved `dy` from the shirt's top). */
export function tagsBox(shirt: Rect, size: { w: number; h: number }, side: "l" | "r", dy: number): Rect {
  return { x: side === "r" ? shirt.x + shirt.w + TAG_GAP : shirt.x - TAG_GAP - size.w, y: shirt.y + dy, ...size };
}

/** The tags as one row centred under the name. */
function rowBox(shirt: Rect, plate: Rect, t: { w: number; h: number; n: number }, chips: "full" | "icon", dy: number): Rect {
  const w = chips === "icon" ? Math.min(t.w, ICON_CHIP) : t.w;
  const h = (t.h + TAG_GAP) / t.n - TAG_GAP;
  const rowW = t.n * w + (t.n - 1) * TAG_GAP;
  const cx = shirt.x + shirt.w / 2;
  return { x: cx - rowW / 2, y: Math.max(shirt.y + shirt.h, plate.y + plate.h) + 2 + dy, w: rowW, h };
}

interface PlateOpt {
  kind: "one" | "two";
  dx: number;
  dy: number;
  /** The plate's box before the player's own move. */
  r: Rect;
  pen: number;
}

function plateOptions(p: PitchPlayer): PlateOpt[] {
  const out: PlateOpt[] = [];
  const cx = p.plate.x + p.plate.w / 2;
  const shapes: { kind: "one" | "two"; r: Rect; pen: number }[] = [{ kind: "one", r: p.plate, pen: 0 }];
  if (p.plate2 && p.plate2.w > 0 && p.plate2.w < p.plate.w) shapes.push({ kind: "two", r: { x: cx - p.plate2.w / 2, y: p.plate.y, w: p.plate2.w, h: p.plate2.h }, pen: 1.2 });
  for (const s of shapes) {
    for (const [dy, pen] of [
      [0, 0],
      [3, 0.2],
      [6, 0.4],
    ] as const) {
      for (const [dx, penX] of [
        [0, 0],
        [-8, 0.5],
        [8, 0.5],
        [-16, 0.9],
        [16, 0.9],
      ] as const) {
        if (dy === 6 && dx !== 0) continue;
        out.push({ kind: s.kind, dx, dy, r: move(s.r, dx, dy), pen: s.pen + pen + penX });
      }
    }
    // above the shirt
    const above = p.shirt.y - 2 - s.r.h - s.r.y;
    out.push({ kind: s.kind, dx: 0, dy: above, r: move(s.r, 0, above), pen: s.pen + 1.5 });
  }
  return out;
}

/** Where each player, plate and tags block goes (same order as `players`). */
export function placePitch(players: readonly PitchPlayer[], W: number, H: number): PitchPlace[] {
  const base = (p: PitchPlayer): PitchPlace => ({ plate: "one", plateDx: 0, plateDy: 0, nx: 0, ny: 0, tags: p.shirt.x + p.shirt.w / 2 > W * 0.6 ? "l" : "r", cols: 1, chips: "full", tagsAt: null });
  if (!W || !H) return players.map(base);
  const n = players.length;
  const opts = players.map(plateOptions);
  const st = players.map(() => ({ nx: 0, ny: 0, opt: 0 }));
  const shirtAt = (i: number, s = st[i]) => move(players[i].shirt, s.nx, s.ny);
  const plateAt = (i: number, s = st[i]) => move(opts[i][s.opt].r, s.nx, s.ny);

  // ── the shirts and the names: a few rounds of «each one takes its best spot given the others»
  const mx = NUDGE * W;
  const my = NUDGE * H;
  const steps = [0, -1 / 3, 1 / 3, -2 / 3, 2 / 3, -1, 1];
  const costOf = (i: number, s: { nx: number; ny: number; opt: number }) => {
    const S = shirtAt(i, s);
    const P = plateAt(i, s);
    let c = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const Sj = shirtAt(j);
      const Pj = plateAt(j);
      c += 4 * ov(S, Sj) + ov(S, Pj) + ov(P, Sj) + ov(roomy(P), Pj);
    }
    c += ov(P, S) + 3 * (outside(S, W, H) + outside(P, W, H));
    return c + opts[i][s.opt].pen + 0.06 * (Math.abs(s.nx) + Math.abs(s.ny));
  };
  const order = players.map((_, i) => i).sort((a, b) => Number(!!players[b].first) - Number(!!players[a].first));
  for (let round = 0; round < 8; round++) {
    let changed = false;
    for (const i of order) {
      let best = { ...st[i] };
      let bestC = costOf(i, best);
      for (const ky of steps)
        for (const kx of steps)
          for (let o = 0; o < opts[i].length; o++) {
            const cand = { nx: Math.round(kx * mx), ny: Math.round(ky * my), opt: o };
            const c = costOf(i, cand);
            if (c < bestC - 1e-6) {
              bestC = c;
              best = cand;
            }
          }
      if (best.nx !== st[i].nx || best.ny !== st[i].ny || best.opt !== st[i].opt) {
        st[i] = best;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // ── the marks: never on a name, a shirt or another player's marks
  const out = players.map((p, i): PitchPlace => {
    const o = opts[i][st[i].opt];
    return { ...base(p), plate: o.kind, plateDx: o.dx, plateDy: o.dy, nx: st[i].nx, ny: st[i].ny };
  });
  const shirts = players.map((_, i) => shirtAt(i));
  const plates = players.map((_, i) => plateAt(i));
  const placed: Rect[] = [];
  const tagCost = (T: Rect) => {
    let c = 3 * outside(T, W, H);
    for (const S of shirts) c += 2 * ov(T, S);
    for (const P of plates) c += 3 * ov(T, roomy(P));
    for (const R of placed) c += 2 * ov(T, R);
    return c;
  };
  /** Free room beside the shirt on a side (to the edge or the nearest box in its band). */
  const room = (i: number, side: "l" | "r", h: number) => {
    const S = shirts[i];
    let free = side === "r" ? W - (S.x + S.w) : S.x;
    for (const [k, R] of [...shirts.map((r, j) => [j, r] as const), ...plates.map((r, j) => [j, r] as const)]) {
      if (k === i || R.y > S.y + h || R.y + R.h < S.y) continue;
      if (side === "r" && R.x >= S.x + S.w) free = Math.min(free, R.x - (S.x + S.w));
      if (side === "l" && R.x + R.w <= S.x) free = Math.min(free, S.x - (R.x + R.w));
    }
    return free;
  };
  const byTags = players.map((_, i) => i).sort((a, b) => (players[b].tags?.n ?? 0) - (players[a].tags?.n ?? 0));
  for (const i of byTags) {
    const t = players[i].tags;
    if (!t || !t.w) continue;
    const S = shirts[i];
    const sides: ("l" | "r")[] = room(i, "l", t.h) > room(i, "r", t.h) ? ["l", "r"] : ["r", "l"];
    const found: { tags: "l" | "r" | "b"; cols: 1 | 2; chips: "full" | "icon"; r: Rect; c: number }[] = [];
    const consider = (tags: "l" | "r" | "b", cols: 1 | 2, chips: "full" | "icon", r: Rect, pen: number) => {
      const c = tagCost(r) + pen;
      if (!found.length || c < found[0].c) found[0] = { tags, cols, chips, r, c };
      return c < 1 + pen;
    };
    // a column beside the shirt (one, then folded in two); both sides full: a row under the name; then the same
    // with icon-only chips
    const attempts: readonly (readonly ["side", 1 | 2, "full" | "icon"] | readonly ["row", 1, "full" | "icon"])[] = [
      ["side", 1, "full"],
      ["side", 2, "full"],
      ["row", 1, "full"],
      ["side", 1, "icon"],
      ["side", 2, "icon"],
      ["row", 1, "icon"],
    ];
    search: for (const [how, cols, chips] of attempts) {
      if (how === "side" && cols === 2 && t.n < 3) continue;
      const pen = (cols === 2 ? 0.5 : 0) + (chips === "icon" ? 0.75 : 0) + (how === "row" ? 1 : 0);
      if (how === "row") {
        for (const dy of [0, 3, 6]) if (consider("b", 1, chips, rowBox(S, plates[i], t, chips, dy), pen + 0.05 * dy)) break search;
        continue;
      }
      const size = tagsSize(t, cols, chips);
      const reach = Math.max(S.h, size.h);
      const dys = [0];
      for (let d = 4; d <= reach; d += 4) dys.push(d, -d);
      for (const side of sides) for (const dy of dys) if (consider(side, cols, chips, tagsBox(S, size, side, dy), pen + 0.01 * Math.abs(dy))) break search;
    }
    const b = found[0];
    if (!b) continue;
    out[i].tags = b.tags;
    out[i].cols = b.cols;
    out[i].chips = b.chips;
    out[i].tagsAt = b.r;
    placed.push(b.r);
  }
  return out;
}
