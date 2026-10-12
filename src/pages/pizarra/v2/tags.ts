// La pizarra · Bloque 5 — las etiquetas de un tablero («Liga», «Copa», «Entreno»): texto libre, como
// mucho TAGS_MAX por tablero y TAG_MAX letras cada una. Read leniently from the store (an invalid one is
// dropped and reported, never the board), written back plain. Pure.
import { z } from "zod";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

/** Tags per board, and letters per tag (the same caps as firestore.rules). */
export const TAGS_MAX = 3;
export const TAG_MAX = 20;
/** What the field suggests before anything is written. */
export const TAG_SUGGEST = ["Liga", "Copa", "Entreno"] as const;

export const tagSchema = z.string().trim().min(1).max(TAG_MAX);

/** One tag as typed: spaces folded, trimmed, cut to TAG_MAX ("" = nothing to add). */
export const cleanTag = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, TAG_MAX).trim();

const same = (a: string, b: string): boolean => a.localeCompare(b, "es", { sensitivity: "base" }) === 0;

/** The board's tags as stored: the valid ones, once each (case and accents aside), at most TAGS_MAX. */
export function parseTags(raw: unknown, docId: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    reportDroppedDoc("lineups.tags", docId, []);
    return [];
  }
  const out: string[] = [];
  raw.forEach((x) => {
    const r = tagSchema.safeParse(x);
    if (!r.success) {
      reportDroppedDoc("lineups.tags", docId, r.error.issues);
      return;
    }
    if (out.length < TAGS_MAX && !out.some((t) => same(t, r.data))) out.push(r.data);
  });
  return out;
}

/** Why a tag can't be added (null = it can). */
export function tagError(tag: string, tags: readonly string[]): string | null {
  const t = cleanTag(tag);
  if (!t) return "Escribe la etiqueta.";
  if (tags.some((x) => same(x, t))) return "Ya lleva «" + t + "».";
  if (tags.length >= TAGS_MAX) return "Como mucho " + TAGS_MAX + " etiquetas por tablero.";
  return null;
}

/** The tags with one more (unchanged when it can't go: see tagError). */
export const addTag = (tags: readonly string[], tag: string): string[] => (tagError(tag, tags) ? [...tags] : [...tags, cleanTag(tag)]);
export const removeTag = (tags: readonly string[], tag: string): string[] => tags.filter((t) => t !== tag);

/** Every tag used on these boards, most used first (then A–Z), for the filter and the suggestions. */
export function tagsInUse(rows: readonly { tags?: readonly string[] }[]): string[] {
  const n = new Map<string, number>();
  rows.forEach((r) => (r.tags ?? []).forEach((t) => {
    const k = [...n.keys()].find((x) => same(x, t)) ?? t;
    n.set(k, (n.get(k) ?? 0) + 1);
  }));
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([t]) => t);
}

/** The suggestions under the field: the usual ones and the ones in use, minus the board's own. */
export function tagSuggestions(own: readonly string[], inUse: readonly string[]): string[] {
  const out: string[] = [];
  [...TAG_SUGGEST, ...inUse].forEach((t) => {
    if (!own.some((x) => same(x, t)) && !out.some((x) => same(x, t))) out.push(t);
  });
  return out.slice(0, 6);
}
