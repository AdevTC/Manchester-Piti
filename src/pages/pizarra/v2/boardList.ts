// La pizarra · Bloque 5 — Mis tableros, organizados: buscar por nombre, rival o etiqueta, filtrar por una
// etiqueta, ordenar (recientes / nombre / partido) y la tira «Recientes» (los últimos abiertos en este
// dispositivo). Pure, apart from the device's memory of what was opened (localStorage, never required).

export type BoardSort = "recientes" | "nombre" | "partido";
export const SORTS: { k: BoardSort; l: string }[] = [
  { k: "recientes", l: "Recientes" },
  { k: "nombre", l: "Nombre" },
  { k: "partido", l: "Partido" },
];

/** What the list needs of a board to search, filter and sort it. */
export interface Organizable {
  id: string;
  name: string;
  rival?: string;
  tags?: readonly string[];
  /** Last change (ms; 0 = unknown). */
  at?: number;
  /** The linked match's date (ms) and name («J8 · MAD SKY»); absent = no match. */
  matchMs?: number;
  matchTxt?: string;
}

/** Lower case, no accents, spaces folded: «Atlético  B» ~ «atletico b». */
export const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Whether a board matches the search: every word somewhere in its name, rival, match or tags. */
export function matches(b: Organizable, q: string): boolean {
  const words = fold(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = fold([b.name, b.rival ?? "", b.matchTxt ?? "", ...(b.tags ?? [])].join(" "));
  return words.every((w) => hay.includes(w));
}

const hasTag = (b: Organizable, tag: string): boolean => (b.tags ?? []).some((t) => fold(t) === fold(tag));

const byName = (a: Organizable, b: Organizable): number => a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
const byAt = (a: Organizable, b: Organizable): number => (b.at ?? 0) - (a.at ?? 0);

/** The list as shown: searched, filtered by a tag (null = all) and sorted. Never mutates `rows`. */
export function organize<T extends Organizable>(rows: readonly T[], o: { q: string; tag: string | null; sort: BoardSort }): T[] {
  const out = rows.filter((b) => matches(b, o.q) && (!o.tag || hasTag(b, o.tag)));
  if (o.sort === "nombre") return out.sort((a, b) => byName(a, b) || byAt(a, b));
  if (o.sort === "partido")
    // the latest match first; boards without a match at the end, newest first
    return out.sort((a, b) => (a.matchMs == null ? (b.matchMs == null ? byAt(a, b) : 1) : b.matchMs == null ? -1 : b.matchMs - a.matchMs || byAt(a, b)));
  return out.sort(byAt);
}

/** «3 de 7 tableros» while searching or filtering; null when the whole list is shown. */
export function countTxt(shown: number, total: number, filtering: boolean): string | null {
  if (!filtering) return null;
  if (!shown) return "Ningún tablero coincide";
  return shown + " de " + total + (total === 1 ? " tablero" : " tableros");
}

// ── «Recientes»: what was opened last on this device ──
const KEY = "mp_pizarra_recientes";
/** How many the device remembers per season, and how many the strip shows. */
export const RECENT_KEEP = 6;
export const RECENT_SHOW = 4;

function read(): Record<string, string[]> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** The boards opened on this device this season, the latest first. */
export function recentIds(seasonId: string): string[] {
  const l = read()[seasonId];
  return Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : [];
}

/** A board was opened (private mode: nothing is remembered, nothing breaks). */
export function noteOpened(seasonId: string, id: string): void {
  try {
    const all = read();
    const next = [id, ...recentIds(seasonId).filter((x) => x !== id)].slice(0, RECENT_KEEP);
    localStorage.setItem(KEY, JSON.stringify({ ...all, [seasonId]: next }));
  } catch {
    /* private mode */
  }
}

/**
 * The «Recientes» strip: the boards opened last on this device that still exist, then (to fill it) the
 * latest changed; never the board on screen. Empty with fewer than two boards (nothing to jump to).
 */
export function recentRows<T extends Organizable>(rows: readonly T[], opened: readonly string[], onId: string | null): T[] {
  if (rows.length < 2) return [];
  const out: T[] = [];
  const push = (b: T | undefined) => {
    if (b && b.id !== onId && !out.includes(b) && out.length < RECENT_SHOW) out.push(b);
  };
  opened.forEach((id) => push(rows.find((b) => b.id === id)));
  rows.slice().sort(byAt).forEach(push);
  return out;
}

// ── the sort, remembered on this device ──
const SORT_KEY = "mp_pizarra_orden";
export function readSort(): BoardSort {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return v === "nombre" || v === "partido" ? v : "recientes";
  } catch {
    return "recientes";
  }
}
export function writeSort(s: BoardSort): void {
  try {
    localStorage.setItem(SORT_KEY, s);
  } catch {
    /* private mode */
  }
}
