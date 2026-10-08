// The match list of «Partidos y actas» (pure, tested): groups Por hacer / Publicados / Por jugar, the
// filters with their counts, the search (a rival, or a jornada as «J8» / «8») and each row's words —
// jornada · date, rival, the state chip (icon + word, never colour alone) and the score or the time.
import { dateMillis, matchPhase } from "../../../../functions/src/matchEngine";
import { normalize } from "../palette/search";
import { clockTime, convocatoriaState, matchGroup, type ActaReview, type AdminMatch, type AdminMatchState } from "../data/adminLogic";
import type { AdIconName } from "../ui/icons";
import type { ChipTone } from "../ui/controls";

export type ListFilter = "todo" | "hacer" | "publicados" | "jugar";
export const FILTERS: { key: ListFilter; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "hacer", label: "Por hacer" },
  { key: "publicados", label: "Publicados" },
  { key: "jugar", label: "Por jugar" },
];
const GROUP_TITLE: Record<Exclude<ListFilter, "todo">, string> = { hacer: "Por hacer", publicados: "Publicados", jugar: "Por jugar" };

export interface ListRow {
  id: string;
  /** «J7» (— without season). */
  j: string;
  /** «1 nov». */
  day: string;
  rival: string;
  chip: { tone: ChipTone; icon: AdIconName | null; text: string };
  /** «3–1», or the kick-off time when there is no result. */
  score: string;
  dim: boolean;
  where: string;
  aria: string;
}
export interface ListGroup {
  key: Exclude<ListFilter, "todo">;
  title: string;
  rows: ListRow[];
}
export interface ListContext {
  stateOf: (m: AdminMatch) => AdminMatchState;
  reviewOf: (m: AdminMatch) => ActaReview;
  /** The season's player ids of a match (for its convocatoria state). */
  rosterIds: (m: AdminMatch) => string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dayOf = (ms: number) => {
  if (!Number.isFinite(ms)) return "sin fecha";
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.day} ${String(p.month).replace(".", "")}`;
};

/** The state chip of a row. */
export function rowChip(m: AdminMatch, state: AdminMatchState, review: ActaReview, rosterIds: string[]): ListRow["chip"] {
  switch (state) {
    case "draft":
      if (!review.finished) return { tone: "warn", icon: "alert", text: "Borrador · sin publicar" };
      if (review.cuadra) return { tone: "warn", icon: "alert", text: "Borrador · cuadra" };
      if (review.missingScorers) return { tone: "warn", icon: "alert", text: `Borrador · falta ${plural(review.missingScorers, "goleador", "goleadores")}` };
      return { tone: "warn", icon: "alert", text: "Borrador · no cuadra" };
    case "acta":
      return { tone: "warn", icon: "alert", text: "Acta por hacer" };
    case "published":
      return { tone: "ok", icon: "check", text: "Publicada" };
    case "cancelled":
      return { tone: "", icon: "x", text: "Cancelado" };
    case "postponed":
      return { tone: "", icon: "clock", text: "Aplazado" };
    case "next": {
      const c = convocatoriaState(m, rosterIds, m.published && !m.draft);
      return { tone: "sky", icon: "clock", text: c.published ? "Próximo · convocados" : c.unassigned ? `Próximo · ${c.unassigned} sin convocar` : c.ready ? "Próximo · convocatoria lista" : "Próximo · sin convocatoria" };
    }
    default:
      return { tone: "", icon: "clock", text: "Programado" };
  }
}

export function toRow(m: AdminMatch, ctx: ListContext): ListRow {
  const state = ctx.stateOf(m);
  const review = ctx.reviewOf(m);
  const t = dateMillis(m.date);
  const hasScore = (state === "published" || state === "draft" || state === "acta") && review.finished && typeof m.goalsFor === "number";
  const chip = rowChip(m, state, review, ctx.rosterIds(m));
  const j = m.jornada ? `J${m.jornada}` : "—";
  const rival = m.rival?.trim() || "Rival por confirmar";
  const score = hasScore ? `${m.goalsFor}–${m.goalsAgainst ?? 0}` : clockTime(t);
  return {
    id: m.id,
    j,
    day: dayOf(t),
    rival,
    chip,
    score,
    dim: !hasScore,
    where: m.home === false ? "Fuera" : "En casa",
    aria: `${m.jornada ? `Jornada ${m.jornada}` : "Partido"}, ${rival}, ${chip.text}${hasScore ? `, ${score}` : ""}`,
  };
}

/** Does a match answer the search: part of the rival's name, or its jornada («J8», «j 8», «8»). */
export function matchesQuery(m: AdminMatch, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const compact = q.replace(/\s/g, "");
  const jm = /^j?(\d+)$/.exec(compact);
  if (jm && m.jornada === Number(jm[1])) return true;
  if (/^j\d+$/.test(compact)) return false;
  return normalize(m.rival ?? "").includes(q);
}

export interface MatchListModel {
  groups: ListGroup[];
  counts: Record<ListFilter, number>;
}
export function buildMatchList(matches: readonly AdminMatch[], ctx: ListContext, filter: ListFilter, query: string): MatchListModel {
  const by: Record<Exclude<ListFilter, "todo">, AdminMatch[]> = { hacer: [], publicados: [], jugar: [] };
  for (const m of matches) by[matchGroup(ctx.stateOf(m))].push(m);
  const asc = (a: AdminMatch, b: AdminMatch) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0);
  by.hacer.sort(asc);
  by.jugar.sort(asc);
  by.publicados.sort((a, b) => asc(b, a));
  const counts = { todo: matches.length, hacer: by.hacer.length, publicados: by.publicados.length, jugar: by.jugar.length };
  const keys = (["hacer", "publicados", "jugar"] as const).filter((k) => filter === "todo" || filter === k);
  const groups = keys
    .map((k) => ({ key: k, title: GROUP_TITLE[k], rows: by[k].filter((m) => matchesQuery(m, query)).map((m) => toRow(m, ctx)) }))
    .filter((g) => g.rows.length);
  return { groups, counts };
}

/** Same rival already in the season: the return match (or a duplicate still to play). */
export function returnOf(matches: readonly AdminMatch[], seasonId: string, rival: string, now: number): { match: AdminMatch; played: boolean } | null {
  const r = normalize(rival);
  if (!r) return null;
  const same = matches.filter((m) => m.seasonId === seasonId && normalize(m.rival ?? "") === r);
  if (!same.length) return null;
  const m = same.sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
  return { match: m, played: dateMillis(m.date) <= now };
}


/** The matches to call up (Convocatorias): the next three still to play, plus the one asked for. */
export function upcomingMatches(matches: readonly AdminMatch[], now: number, wanted?: string): AdminMatch[] {
  const next = matches
    .filter((m) => m.status !== "cancelled" && ["scheduled", "playing"].includes(matchPhase(m, now)))
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))
    .slice(0, 3);
  const w = wanted ? matches.find((m) => m.id === wanted) : undefined;
  return w && !next.includes(w) ? [...next, w].sort((a, b) => dateMillis(a.date) - dateMillis(b.date)) : next;
}
