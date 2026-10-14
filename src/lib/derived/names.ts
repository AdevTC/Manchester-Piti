// The one way a player is named: the shirt name he wears that season, else his shirt name, else his
// first and last name, else «Jugador». Every page (home, partidos, the match page, stats, jugador, the
// admin…) names players through nameFor; the match pages pass the match's own season.

export interface NameSource {
  shirtName?: string;
  firstName?: string;
  lastName?: string;
  /** Per-season overrides ({ [seasonId]: { shirtName?, number? } }), as stored on players/{id}. */
  seasonDetails?: Record<string, unknown>;
}

/** The shirt name a season gives him (seasonDetails[seasonId].shirtName), when it has one. */
export function seasonShirtName(p: NameSource | null | undefined, seasonId: string | null | undefined): string | undefined {
  if (!p || !seasonId || seasonId === "all") return undefined;
  const raw = p.seasonDetails?.[seasonId];
  if (!raw || typeof raw !== "object") return undefined;
  const name = (raw as Record<string, unknown>).shirtName;
  return typeof name === "string" && name.trim() ? name : undefined;
}

/** A player's name: the season's shirt name, then shirtName, then first + last, then «Jugador». */
export function nameFor(p: NameSource | null | undefined, seasonId?: string | null): string {
  return seasonShirtName(p, seasonId) || p?.shirtName || [p?.firstName, p?.lastName].filter(Boolean).join(" ") || "Jugador";
}

/** A piece of a sentence: plain text, or a player's name (with his id). */
export interface NameSegment {
  text: string;
  id?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A sentence cut around the players it names, so each name can become his link: «PEPE marca, con
 * asistencia de LUIS» → [PEPE·p1, « marca, con asistencia de », LUIS·p2].
 * - Whole words only: «MARIO» is not found inside «MARIONETAS FC», nor «Ana» inside «Anabel».
 * - Where two names start at the same place, the longer wins («ANA MARÍA» before «ANA»).
 * - A name only one person has: every occurrence is his. A name two people share: its occurrences go to
 *   them in the order of `people` (the first to the first…); any further occurrence is ambiguous and
 *   stays text.
 */
export function nameSegments(text: string, people: readonly { id: string; name: string }[]): NameSegment[] {
  // the people behind each name, in order (one entry per id)
  const byName = new Map<string, string[]>();
  for (const p of people) {
    if (!p.name) continue;
    const ids = byName.get(p.name) ?? [];
    if (!ids.includes(p.id)) ids.push(p.id);
    byName.set(p.name, ids);
  }
  const hits: { at: number; name: string }[] = [];
  for (const name of byName.keys()) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "gu");
    for (const m of text.matchAll(re)) hits.push({ at: m.index, name });
  }
  hits.sort((a, b) => a.at - b.at || b.name.length - a.name.length);

  const out: NameSegment[] = [];
  const pushText = (t: string) => {
    if (!t) return;
    const last = out.at(-1);
    if (last && !last.id) last.text += t;
    else out.push({ text: t });
  };
  const seen = new Map<string, number>();
  let pos = 0;
  for (const h of hits) {
    if (h.at < pos) continue; // inside a longer name already taken
    pushText(text.slice(pos, h.at));
    const ids = byName.get(h.name)!;
    const n = seen.get(h.name) ?? 0;
    seen.set(h.name, n + 1);
    const id = ids.length === 1 ? ids[0] : ids[n];
    if (id) out.push({ text: h.name, id });
    else pushText(h.name);
    pos = h.at + h.name.length;
  }
  pushText(text.slice(pos));
  return out;
}
