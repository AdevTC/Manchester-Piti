// The momentum ribbon's geometry, pure: who presses when (a soft area above the axis for the Piti, below for the
// rival, built from the plays: each one a gaussian bump weighted by how big a play it is), the marks on the
// goals, cards, posts and saves, the gold peak on our latest goal, the «now» line and the axis labels.
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

function area(items: readonly RibbonItem[], side: "us" | "them", upto: number): string {
  const sign = side === "us" ? -1 : 1;
  const depth = side === "us" ? 33 : 29;
  const pts: string[] = [];
  const end = Math.max(0, Math.min(100, upto));
  for (let x = 0; x <= end + 1e-9; x += 1) pts.push(`L${((x / 100) * RIBBON_W).toFixed(1)} ${(AXIS + sign * pressureAt(items, side, x, upto) * depth).toFixed(1)}`);
  return `M0 ${AXIS} ${pts.join(" ")} L${((end / 100) * RIBBON_W).toFixed(1)} ${AXIS} Z`;
}

const ICON: Partial<Record<RibbonKind, MarkIcon>> = { gol: "ball", tarjeta: "card", roja: "red", palo: "post", parada: "glove" };

/** The ribbon for a match of `duration` minutes at minute `now` (omit it once the match is over). `goldId`:
 *  the goal that gets the gold mark and peak (default: our latest goal). */
export function ribbonModel(items: readonly RibbonItem[], duration: number, now?: number, goldId?: string | null): RibbonModel {
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
  const g = gold ? shown.find((it) => it.id === gold) : undefined;
  const px = g ? (g.x / 100) * RIBBON_W : 0;
  const peak = g ? `M${px - 16} ${AXIS} C${px - 6} ${AXIS} ${px - 4} 2 ${px} 2 C${px + 4} 2 ${px + 6} ${AXIS} ${px + 16} ${AXIS} Z` : null;
  return {
    us: area(items, "us", upto),
    them: area(items, "them", upto),
    peak,
    marks,
    now: now == null || upto >= 100 ? null : upto,
    labels: [
      { left: 0, text: "0′", align: "start" },
      { left: 50, text: "Descanso", align: "middle" },
      { left: 100, text: `${Math.round(total)}′`, align: "end" },
    ],
  };
}
