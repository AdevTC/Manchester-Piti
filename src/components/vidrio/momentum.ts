// The momentum ribbon's geometry, pure: who presses when (a soft area above the axis for the Piti, below for the
// rival, built from the plays: each one a gaussian bump weighted by how big a play it is, the sum eased so a
// busy match still reads as a wave, never a flat slab: its scale comes from the 95th percentile of the
// pressure, not its sum), the marks on the goals, cards, posts and saves (spread apart where they would sit on
// each other), the gold peak on our latest goal, the «now» line and the axis labels.
// The input is pulseTrack-shaped (pages/match/directoModel.ts): x in % of the match, h the play's weight.
export type RibbonKind = "gol" | "tarjeta" | "roja" | "palo" | "parada" | "ocasion" | "cambio" | "otro";

export interface RibbonItem {
  id: string;
  /** Position, % of the match (0–100). */
  x: number;
  side: "us" | "them";
  goal: boolean;
  /** The play's weight in px of the old pulse track (10–26; default 12). */
  h?: number;
  kind?: RibbonKind;
  /** What a screen reader hears for its mark («Minuto 21, gol de Adrián T.C.»). */
  label?: string;
}

export type MarkIcon = "ball" | "card" | "red" | "post" | "glove";
export interface RibbonMark {
  id: string;
  left: number;
  top: number;
  icon: MarkIcon;
  side: "us" | "them";
  gold: boolean;
  label: string;
}

export interface RibbonModel {
  us: string;
  them: string;
  /** The gold peak (path) on our latest goal, if any. */
  peak: string | null;
  marks: RibbonMark[];
  /** % where the «now» line stands (null once the match is over or before it starts). */
  now: number | null;
  labels: { left: number; text: string; align: "start" | "middle" | "end" }[];
}

export const RIBBON_W = 500;
export const RIBBON_H = 74;
const AXIS = 37;

const gauss = (m: number, c: number, w: number, a: number) => a * Math.exp(-((m - c) ** 2) / (2 * w * w));

/** The pressure (0–1) of one side at `x` (% of the match). */
export function pressureAt(items: readonly RibbonItem[], side: "us" | "them", x: number, upto = 100): number {
  let p = side === "us" ? 0.12 : 0.08;
  for (const it of items) {
    if (it.side !== side || it.x > upto) continue;
    const weight = Math.max(6, Math.min(30, it.h ?? 12)) / 26;
    p += gauss(x, it.x, it.goal ? 4 : 3.2, weight * (it.goal ? 0.85 : 0.6));
  }
  return Math.min(1, p);
}

/** The plays' raw push on a side at `x` (the bumps' sum, unbounded). */
function bumpsAt(items: readonly RibbonItem[], side: "us" | "them", x: number, upto: number): number {
  let p = 0;
  for (const it of items) {
    if (it.side !== side || it.x > upto) continue;
    const weight = Math.max(6, Math.min(30, it.h ?? 12)) / 26;
    p += gauss(x, it.x, it.goal ? 4 : 3.2, weight * (it.goal ? 0.85 : 0.6));
  }
  return p;
}

/** The scale of the push: its 95th percentile over the match (both sides), never under a lone goal's. */
function pushScale(items: readonly RibbonItem[], upto: number): number {
  const xs: number[] = [];
  const end = Math.max(0, Math.min(100, upto));
  for (let x = 0; x <= end + 1e-9; x += 1) xs.push(bumpsAt(items, "us", x, upto), bumpsAt(items, "them", x, upto));
  xs.sort((a, b) => a - b);
  const p95 = xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : 0;
  return Math.max(0.85, p95);
}

/** The eased height (0–1) of a side at `x`: a quiet floor, the push over the scale, softly capped. */
function eased(side: "us" | "them", bumps: number, scale: number): number {
  const floor = side === "us" ? 0.12 : 0.08;
  return floor + (0.94 - floor) * (1 - Math.exp((-1.6 * bumps) / scale));
}

function area(items: readonly RibbonItem[], side: "us" | "them", upto: number, scale: number): string {
  const sign = side === "us" ? -1 : 1;
  const depth = side === "us" ? 33 : 29;
  const pts: string[] = [];
  const end = Math.max(0, Math.min(100, upto));
  for (let x = 0; x <= end + 1e-9; x += 1) pts.push(`L${((x / 100) * RIBBON_W).toFixed(1)} ${(AXIS + sign * eased(side, bumpsAt(items, side, x, upto), scale) * depth).toFixed(1)}`);
  return `M0 ${AXIS} ${pts.join(" ")} L${((end / 100) * RIBBON_W).toFixed(1)} ${AXIS} Z`;
}

/** Marks on one side closer than `gap` (% of the ribbon) move apart around where they belong, as a group,
 *  inside the ribbon: none sits on another, each as near its minute as the others let it. */
export function spreadMarks<T extends { left: number }>(marks: readonly T[], gap: number): T[] {
  let groups = [...marks].sort((a, b) => a.left - b.left).map((m) => ({ items: [m], start: m.left }));
  const place = (items: readonly T[]) => {
    const mean = items.reduce((s, m) => s + m.left, 0) / items.length;
    const span = (items.length - 1) * gap;
    return Math.max(0, Math.min(100 - span, mean - span / 2));
  };
  for (let merged = true; merged; ) {
    merged = false;
    const next: typeof groups = [];
    for (const g of groups) {
      const last = next.at(-1);
      if (last && last.start + last.items.length * gap > g.start + 1e-9) {
        const items = [...last.items, ...g.items];
        next[next.length - 1] = { items, start: place(items) };
        merged = true;
      } else next.push(g);
    }
    groups = next;
  }
  return groups.flatMap((g) => g.items.map((m, k) => ({ ...m, left: Math.round((g.start + k * gap) * 10) / 10 })));
}

const ICON: Partial<Record<RibbonKind, MarkIcon>> = { gol: "ball", tarjeta: "card", roja: "red", palo: "post", parada: "glove" };

/** The ribbon for a match of `duration` minutes at minute `now` (omit it once the match is over). `goldId`:
 *  the goal that gets the gold mark and peak (default: our latest goal). `gap`: the least distance between two
 *  marks on a side, % of the ribbon (a mark is 22 px wide: MomentumRibbon passes 18 px over its own width). */
export function ribbonModel(items: readonly RibbonItem[], duration: number, now?: number, goldId?: string | null, gap = 3.6): RibbonModel {
  const total = Math.max(1, duration);
  const upto = now == null ? 100 : Math.max(0, Math.min(100, (now / total) * 100));
  const shown = items.filter((it) => it.x <= upto);
  const ourGoals = shown.filter((it) => it.goal && it.side === "us").sort((a, b) => a.x - b.x);
  const gold = goldId === undefined ? (ourGoals.at(-1)?.id ?? null) : goldId;
  const marks: RibbonMark[] = shown
    .map((it): RibbonMark | null => {
      const icon = it.goal ? "ball" : it.kind ? ICON[it.kind] : undefined;
      if (!icon) return null;
      const isGold = it.id === gold && it.goal && it.side === "us";
      return { id: it.id, left: it.x, top: it.side === "them" ? 76 : 24, icon, side: it.side, gold: isGold, label: it.label ?? "" };
    })
    .filter((m): m is RibbonMark => m !== null);
  const spread = [...spreadMarks(marks.filter((k) => k.side === "us"), gap), ...spreadMarks(marks.filter((k) => k.side === "them"), gap)];
  const at = new Map(spread.map((k) => [k.id, k.left]));
  const placed = marks.map((k) => ({ ...k, left: at.get(k.id) ?? k.left }));
  const scale = pushScale(items, upto);
  const g = gold ? shown.find((it) => it.id === gold) : undefined;
  const px = g ? (g.x / 100) * RIBBON_W : 0;
  const peak = g ? `M${px - 16} ${AXIS} C${px - 6} ${AXIS} ${px - 4} 2 ${px} 2 C${px + 4} 2 ${px + 6} ${AXIS} ${px + 16} ${AXIS} Z` : null;
  return {
    us: area(items, "us", upto, scale),
    them: area(items, "them", upto, scale),
    peak,
    marks: placed,
    now: now == null || upto >= 100 ? null : upto,
    labels: [
      { left: 0, text: "0′", align: "start" },
      { left: 50, text: "Descanso", align: "middle" },
      { left: 100, text: `${Math.round(total)}′`, align: "end" },
    ],
  };
}
