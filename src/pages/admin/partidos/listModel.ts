// The match list of Partidos (pure, tested in listModel.test.ts), as on the canvas (stats-gen/ad-v2-full.mjs
// `master`, ad-v2-full-logic.js `mrow`): sticky groups Por hacer (played or being played, acta not
// published) · Por jugar · Publicados (newest first), the filter Todo / Por hacer / Por jugar / Publicados,
// the search (a rival, or a jornada as «J8» / «8») and each row — J + date, the rival's full name, a
// subtitle ONLY for exceptions (amber «Falta 1 goleador», «Sin publicar», «Convocatoria 6 de 7», «En
// juego»; otherwise where it is played) and the score with its V/E/D mark, or the kick-off time.
import { dateMillis } from "../../../../functions/src/matchEngine";
import { scoreOf } from "../../../lib/partidos";
import { normalize } from "../palette/search";
import { clockTime, type ActaReview, type AdminMatch } from "../data/adminLogic";
import { matchMoment, type MatchMoment } from "../data/moments";
import { resultLetter, resultWord, type ResultLetter } from "../kit/result";

export type ListGroupKey = "hacer" | "jugar" | "publicados";
export type ListFilter = "todo" | ListGroupKey;
export const FILTERS: readonly { key: ListFilter; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "hacer", label: "Por hacer" },
  { key: "jugar", label: "Por jugar" },
  { key: "publicados", label: "Publicados" },
];
const GROUP_TITLE: Record<ListGroupKey, string> = { hacer: "Por hacer", jugar: "Por jugar", publicados: "Publicados" };
const ORDER: readonly ListGroupKey[] = ["hacer", "jugar", "publicados"];
const SEVEN = 7;

export interface ListRow {
  id: string;
  /** «J7» (— without season). */
  j: string;
  /** «1 nov». */
  day: string;
  rival: string;
  /** The line under the rival: the exception, or where it is played. */
  sub: string;
  /** Amber: something of ours is missing. */
  warn: boolean;
  /** The result (played / being played) or null (the time is shown). */
  score: { gf: number; ga: number; r: ResultLetter } | null;
  /** «12:00» (Madrid). */
  time: string;
  aria: string;
}
export interface ListGroup {
  key: ListGroupKey;
  title: string;
  rows: ListRow[];
}
export interface ListContext {
  now: number;
  /** Matches whose end was whistled on this device. */
  whistled: ReadonlySet<string>;
  /** The next match to prepare (its convocatoria is an exception until it has seven). */
  nextId?: string | null;
  reviewOf: (m: AdminMatch) => ActaReview;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** «1 nov» (Madrid). */
export function dayOf(ms: number): string {
  if (!Number.isFinite(ms)) return "sin fecha";
  const p = Object.fromEntries(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.day} ${String(p.month).replace(".", "")}`;
}
/** «en casa» / «fuera». */
export const whereOf = (m: { home?: boolean }) => (m.home === false ? "fuera" : "en casa");

/** The match's moment on this device (the whistle counts). */
export const momentOf = (m: AdminMatch, ctx: Pick<ListContext, "now" | "whistled">): MatchMoment => matchMoment(m, ctx.now, ctx.whistled.has(m.id));

/** Its group: played (or being played) and not published → Por hacer; still to play → Por jugar. */
export function groupOf(m: AdminMatch, ctx: Pick<ListContext, "now" | "whistled">): ListGroupKey {
  if (m.status === "cancelled") return "publicados";
  if (m.status === "postponed") return "jugar";
  const mo = momentOf(m, ctx);
  return mo === "publicado" ? "publicados" : mo === "antes" ? "jugar" : "hacer";
}

export function toRow(m: AdminMatch, ctx: ListContext): ListRow {
  const t = dateMillis(m.date);
  const group = groupOf(m, ctx);
  const mo = momentOf(m, ctx);
  const rival = m.rival?.trim() || "Rival por confirmar";
  const j = m.jornada ? `J${m.jornada}` : "—";
  let sub = whereOf(m);
  let warn = false;
  if (m.status === "cancelled") sub = "Cancelado";
  else if (m.status === "postponed") sub = "Aplazado";
  else if (mo === "juego") {
    sub = "En juego";
    warn = true;
  } else if (group === "hacer") {
    const missing = ctx.reviewOf(m).missingScorers;
    sub = missing ? `${missing === 1 ? "Falta" : "Faltan"} ${plural(missing, "goleador", "goleadores")}` : "Sin publicar";
    warn = true;
  } else if (group === "jugar") {
    const n = m.starters?.length ?? 0;
    if (!m.published) {
      sub = "Sin publicar";
      warn = true;
    } else if (m.id === ctx.nextId && n < SEVEN) {
      sub = `Convocatoria ${n} de ${SEVEN}`;
      warn = true;
    }
  }
  const played = m.status !== "cancelled" && (group === "hacer" || group === "publicados");
  const s = played ? scoreOf(m) : null;
  const score = s ? { gf: s.gf, ga: s.ga, r: resultLetter(s.gf, s.ga) } : null;
  const time = clockTime(t);
  return {
    id: m.id,
    j,
    day: dayOf(t),
    rival,
    sub,
    warn,
    score,
    time,
    aria: [j, rival, sub, score ? `${resultWord(score.r)} ${score.gf}–${score.ga}` : time].join(", "),
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
/** The groups (in the canvas' order: Por hacer · Por jugar · Publicados), filtered and searched. */
export function buildMatchList(matches: readonly AdminMatch[], ctx: ListContext, filter: ListFilter, query: string): MatchListModel {
  const by: Record<ListGroupKey, AdminMatch[]> = { hacer: [], jugar: [], publicados: [] };
  for (const m of matches) by[groupOf(m, ctx)].push(m);
  const asc = (a: AdminMatch, b: AdminMatch) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0);
  by.hacer.sort(asc);
  by.jugar.sort(asc);
  by.publicados.sort((a, b) => asc(b, a));
  const counts = { todo: matches.length, hacer: by.hacer.length, jugar: by.jugar.length, publicados: by.publicados.length };
  const groups = ORDER.filter((k) => filter === "todo" || filter === k)
    .map((k) => ({ key: k, title: GROUP_TITLE[k], rows: by[k].filter((m) => matchesQuery(m, query)).map((m) => toRow(m, ctx)) }))
    .filter((g) => g.rows.length);
  return { groups, counts };
}

/** The match the desktop shows when none is in the URL: the first to do, else the next to play, else the latest. */
export function defaultMatch(matches: readonly AdminMatch[], ctx: Pick<ListContext, "now" | "whistled">): AdminMatch | null {
  const sorted = [...matches].sort((a, b) => (dateMillis(a.date) || 0) - (dateMillis(b.date) || 0));
  return sorted.find((m) => groupOf(m, ctx) === "hacer") ?? sorted.find((m) => groupOf(m, ctx) === "jugar" && m.status !== "postponed") ?? sorted.at(-1) ?? null;
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

