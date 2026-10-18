// The desktop picture-in-picture's pure bits: which corner a drop snaps to, the corner button's order, the size
// button's cycle, and the corner and pinned size kept in localStorage (try/catch: blocked storage just forgets).
export type PipCorner = "br" | "bl" | "tl" | "tr";
/** «auto»: it rests as the bug and unfolds to «normal» for each play; «normal» and «grande» are pinned. */
export type PipSize = "auto" | "normal" | "grande";
export interface PipPrefs {
  corner: PipCorner;
  size: PipSize;
}

export const PIP_DEFAULT: PipPrefs = { corner: "br", size: "auto" };
export const PIP_KEY = "mp:isla:pip";
const CORNERS: readonly PipCorner[] = ["br", "bl", "tl", "tr"];
const SIZES: readonly PipSize[] = ["auto", "normal", "grande"];

/** The corner nearest to the pip's centre (cx, cy) in an area w × h: the half it's in, both ways. */
export function nearestCorner(cx: number, cy: number, w: number, h: number): PipCorner {
  return `${cy < h / 2 ? "t" : "b"}${cx < w / 2 ? "l" : "r"}` as PipCorner;
}

/** The corner button (and the keyboard): clockwise from bottom right, br → bl → tl → tr → br. */
export const nextCorner = (c: PipCorner): PipCorner => CORNERS[(CORNERS.indexOf(c) + 1) % CORNERS.length];

/** The size button: auto (bug) → normal → grande → auto. */
export const nextSize = (s: PipSize): PipSize => SIZES[(SIZES.indexOf(s) + 1) % SIZES.length];

/** What the size button says it will do. */
export const sizeLabel = (s: PipSize): string => (s === "auto" ? "Fijar en normal" : s === "normal" ? "Fijar en grande" : "Volver al marcador pequeño");

/** The size drawn now: pinned, or (auto) the bug at rest and «normal» while a play is unfolded. */
export const shownSize = (s: PipSize, unfolded: boolean): "bug" | "normal" | "grande" => (s === "auto" ? (unfolded ? "normal" : "bug") : s);

const isCorner = (v: unknown): v is PipCorner => typeof v === "string" && (CORNERS as readonly string[]).includes(v);
const isSize = (v: unknown): v is PipSize => typeof v === "string" && (SIZES as readonly string[]).includes(v);

/** The prefs read back from their JSON (anything broken falls back to the default, field by field). */
export function parsePipPrefs(raw: string | null): PipPrefs {
  if (!raw) return PIP_DEFAULT;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return PIP_DEFAULT;
    const o = v as Record<string, unknown>;
    return { corner: isCorner(o.corner) ? o.corner : PIP_DEFAULT.corner, size: isSize(o.size) ? o.size : PIP_DEFAULT.size };
  } catch {
    return PIP_DEFAULT;
  }
}

export function readPipPrefs(): PipPrefs {
  try {
    return parsePipPrefs(typeof localStorage === "undefined" ? null : localStorage.getItem(PIP_KEY));
  } catch {
    return PIP_DEFAULT;
  }
}

export function writePipPrefs(p: PipPrefs): void {
  try {
    localStorage.setItem(PIP_KEY, JSON.stringify(p));
  } catch {
    // (storage blocked: the corner and size last until the page reloads)
  }
}
