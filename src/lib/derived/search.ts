// The one matching model for searching the club: the admin palette (src/pages/admin/palette/search.ts) and
// the public «Buscar» (components/celeste/SearchDialog) read text the same way — accents, case and spaces
// folded, a dorsal or a jornada only when typed exactly, «J 8» as «J8». The public search adds a score on
// top (exact > prefix > word prefix > contains > subsequence) to rank and cap its results. Pure.

/** Lower-case, no accents, collapsed spaces ("ADRIÁN  T.C." → "adrian t.c."). */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const JORNADA = /^j\d+$/;
const compactOf = (s: string) => s.replace(/\s/g, "");

/** What a searchable thing offers: its text (title, details, keywords) and the tokens that find it only exactly. */
export interface Searchable {
  text: string;
  /** Tokens that find it only when typed exactly (a dorsal: "9" must not match "19"; a jornada: «J1» not J10). */
  exact?: readonly string[];
}

/** The admin palette's rule, for a non-empty query: an exact token, or the text containing the query
 *  (spaces ignored) or every one of its words. A jornada query only finds the jornada it names. */
export function textMatches(item: Searchable, query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  const compact = compactOf(q);
  if (item.exact?.some((t) => compactOf(normalize(t)) === compact)) return true;
  if (JORNADA.test(compact) && item.exact?.some((t) => JORNADA.test(normalize(t)))) return false;
  const hay = normalize(item.text);
  if (compactOf(hay).includes(compact)) return true;
  return q.split(" ").every((w) => hay.includes(w));
}

/** `needle` read in order inside `hay` (letters may sit apart): the span it takes, or null. */
function subsequenceSpan(needle: string, hay: string): number | null {
  let at = 0;
  let start = -1;
  for (let i = 0; i < hay.length && at < needle.length; i++) {
    if (hay[i] !== needle[at]) continue;
    if (start < 0) start = i;
    at++;
    if (at === needle.length) return i - start + 1;
  }
  return null;
}

/** What a search result is made of: a title (shown and weighed most) and extra words (not shown). */
export interface ScoredSearchable {
  title: string;
  keywords?: string;
  exact?: readonly string[];
}

/**
 * How well `query` finds `item` (0: it does not). Exact token 100 · title starts with it 90 · a title word
 * starts with it 80 · every query word starts a word 70 · contained (spaces ignored) 60 · every word
 * contained 50 · fuzzy-lite: the letters in order inside the title (2+ letters, not for numbers) 10–30.
 */
export function matchScore(item: ScoredSearchable, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const compact = compactOf(q);
  if (item.exact?.some((t) => compactOf(normalize(t)) === compact)) return 100;
  if (JORNADA.test(compact) && item.exact?.some((t) => JORNADA.test(normalize(t)))) return 0;
  const title = normalize(item.title);
  const hay = normalize(`${item.title} ${item.keywords ?? ""}`);
  const words = hay.split(/[\s·.,/()-]+/).filter(Boolean);
  const qWords = q.split(" ");
  if (title.startsWith(q)) return 90;
  if (title.split(/[\s·.,/()-]+/).some((w) => w.startsWith(q))) return 80;
  if (qWords.every((w) => words.some((h) => h.startsWith(w)))) return 70;
  if (/^\d+$/.test(compact)) return 0; // a number is a dorsal, a day or a jornada: never a loose match
  if (compactOf(hay).includes(compact)) return 60;
  if (qWords.every((w) => hay.includes(w))) return 50;
  if (compact.length < 2) return 0;
  const span = subsequenceSpan(compact, compactOf(title));
  if (span === null) return 0;
  return 10 + Math.round(20 * (compact.length / span));
}

// ---------- the public search: what it finds, and how the results are ranked and grouped

export type SearchKind = "jugador" | "partido" | "rival" | "temporada" | "seccion";
/** The word each result carries (its kind is never told by colour alone). */
export const KIND_LABEL: Record<SearchKind, string> = {
  jugador: "Jugador",
  partido: "Partido",
  rival: "Rival",
  temporada: "Temporada",
  seccion: "Sección",
};
/** The group headings, in their tie order: players and matches first. */
export const KIND_GROUP: Record<SearchKind, string> = {
  jugador: "Jugadores",
  partido: "Partidos",
  rival: "Rivales",
  temporada: "Temporadas",
  seccion: "Secciones",
};
const KIND_ORDER: SearchKind[] = ["jugador", "partido", "rival", "temporada", "seccion"];

/** Where a result leads (the dialog turns it into a typed navigation). */
export type SearchTarget =
  | { to: "jugador"; playerId: string; season?: string }
  | { to: "partido"; matchId: string }
  | { to: "partidos"; season?: string; view?: "tabla" }
  | { to: "stats"; view?: StatsView }
  | { to: "plantilla" }
  | { to: "club" }
  | { to: "vestuario"; hash?: string }
  | { to: "profile" }
  | { to: "pizarra" };
export type StatsView = "summary" | "players" | "game" | "minutes" | "positions" | "rivals" | "compare" | "explore";

export interface SearchEntry extends ScoredSearchable {
  id: string;
  kind: SearchKind;
  /** The second line (dorsal, date and result…). */
  detail?: string;
  /** Added to the score (the next match, this season's players). */
  boost?: number;
  target: SearchTarget;
}

export interface SearchGroup {
  kind: SearchKind;
  title: string;
  items: SearchEntry[];
}

/** At most this many results in all, and per kind (so «rayo» keeps room for the rival next to its matches). */
export const SEARCH_LIMIT = 8;
const KIND_LIMIT: Record<SearchKind, number> = { jugador: 5, partido: 5, rival: 3, temporada: 3, seccion: 4 };

/** The results for `query`: ranked by score (ties: players, matches, rivals, seasons, sections, then the
 *  entries' own order), capped, then grouped by kind — the group with the best hit first. */
export function searchEntries(entries: readonly SearchEntry[], query: string): SearchGroup[] {
  const ranked = entries
    .map((e, i) => {
      const s = matchScore(e, query);
      return { e, i, s: s ? s + (e.boost ?? 0) : 0 };
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || KIND_ORDER.indexOf(a.e.kind) - KIND_ORDER.indexOf(b.e.kind) || a.i - b.i);
  const perKind = new Map<SearchKind, number>();
  const kept: SearchEntry[] = [];
  for (const { e } of ranked) {
    if (kept.length >= SEARCH_LIMIT) break;
    const n = perKind.get(e.kind) ?? 0;
    if (n >= KIND_LIMIT[e.kind]) continue;
    perKind.set(e.kind, n + 1);
    kept.push(e);
  }
  const groups: SearchGroup[] = [];
  for (const e of kept) {
    const g = groups.find((x) => x.kind === e.kind);
    if (g) g.items.push(e);
    else groups.push({ kind: e.kind, title: KIND_GROUP[e.kind], items: [e] });
  }
  return groups;
}

/** The flat option list, in keyboard order. */
export const flattenGroups = (groups: readonly SearchGroup[]): SearchEntry[] => groups.flatMap((g) => g.items);

// ---------- dates as people type them («12 oct», «12 octubre», «12/10»)

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const madridParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", day: "numeric", month: "numeric", year: "numeric" });

/** The day of `ms` in Madrid: { day, month (0–11), year }. */
export function madridDay(ms: number): { day: number; month: number; year: number } {
  const parts = madridParts.formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year") };
}

/** «12 oct» (shown). */
export const shortDate = (ms: number): string => {
  const d = madridDay(ms);
  return `${d.day} ${SHORT[d.month]}`;
};

/** The words a date is found by: «12 oct 12 octubre 12/10 2026». */
export function dateKeywords(ms: number): string {
  const d = madridDay(ms);
  return `${d.day} ${SHORT[d.month]} ${d.day} ${MONTHS[d.month]} ${d.day}/${d.month + 1} ${d.year}`;
}
