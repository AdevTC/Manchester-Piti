// «Plantilla» (the PL- boards): the squad of a season as the boards read it (their PLD helpers), over production's
// data. Players in dorsal order with their ficha (age, birthday, sign, height, missing fields, positions, availability),
// and per period (the season or every season) what each one did: the acta's numbers, his jornadas, his positions, the
// radar, his partners, the narrated analysis, the album and the medals. Pure: the page hands it the club's data.
import type { ClubMatch } from "../../../lib/clubData";
import { playerForSeason } from "../../../lib/clubData";
import { analysePlayer, chronological, playerGame, type PlayerAnalysis } from "../../../lib/clubAnalytics";
import { nameFor } from "../../../lib/derived/names";
import { niceName } from "../../../lib/derived/words";
import { LINE_NAMES, POSITIONS, isPosCode, resolvePositions, type Line, type PosCode } from "../../../lib/positions";
import { radarScores } from "../../../lib/statsView";
import { bestPartner, mvpWinners, type MvpResult } from "../../../lib/vestuario";
import { achievements, nextToChase, type Achievement } from "../../../lib/derived/achievements";
import { albumOf } from "../../../lib/derived/album";
import { playerPositions, type PosLine } from "../../../lib/positionStats";
import { mvpOfFrom, type MvpOf } from "../../../lib/derived/mvpOf";
import { technicalAnalysis } from "../../../lib/technicalAnalysis";
import { jornadaNumbers } from "../../../lib/derived/jornada";
import { resultLetter } from "../../../lib/derived/result";
import { eventMetaOf, settled } from "../../../lib/eventMeta";
import { dateMillis, isVisibleMatch } from "../../../../functions/src/matchEngine";
import { emptyTechnical, type TechnicalStats } from "../../../../functions/src/matchAnalysis";
import { minutesOf } from "../../../lib/derived/minutesOf";
import type { PlayerDoc } from "../../../lib/schemas";

const DAY = 86_400_000;
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** The spot of each exact position on a half pitch (x, y in %, our goal at the bottom): the boards' POS. */
export const SPOTS: Record<PosCode, { x: number; y: number }> = {
  POR: { x: 50, y: 92 },
  DFC: { x: 50, y: 72 },
  LIB: { x: 50, y: 83 },
  LI: { x: 15, y: 66 },
  LD: { x: 85, y: 66 },
  MCD: { x: 50, y: 59 },
  MC: { x: 50, y: 45 },
  MI: { x: 17, y: 42 },
  MD: { x: 83, y: 42 },
  MCO: { x: 50, y: 30 },
  EI: { x: 18, y: 19 },
  ED: { x: 82, y: 19 },
  DC: { x: 50, y: 12 },
};
export const LINE_ONE: Record<Line, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
export const LINE_MANY: Record<Line, string> = { POR: "Porteros", DEF: "Defensas", MED: "Medios", DEL: "Delanteros" };
const LINE_ORDER: Record<Line, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** The position's name as the boards write it («Lateral derecho»). */
export const posLabel = (c: PosCode): string => {
  const n = POSITIONS[c].name;
  return n.charAt(0).toLocaleUpperCase("es") + n.slice(1);
};
/** «Lateral derecho (LD)», or «Por definir». */
export const posName = (c: PosCode | null | undefined): string => (c ? `${posLabel(c)} (${c})` : "Por definir");

export interface PSanction {
  games: number;
  untilMatchId?: string;
  reason?: string;
}
export interface PPlayer {
  id: string;
  /** The season's dorsal (null without one). */
  n: number | null;
  num: string;
  /** The name printed on his back («ADRIÁN T.C.»). */
  shirt: string;
  /** The running-text name («Adrián T.C.»). */
  name: string;
  full: string;
  main: PosCode | null;
  also: PosCode[];
  natural: Line | null;
  birth: string | null;
  h: number | null;
  w: number | null;
  /** Seasons in the club (the visible ones). */
  seasons: number;
  injured: boolean;
  sanction: PSanction | null;
  sanctionClearedAt: number | null;
  review: { status: "aprobada" | "ajustada" | "rechazada"; at: number | null } | null;
  photo: string | null;
  active: boolean;
  quote: string;
  bio: string;
}

const msOf = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "seconds" in v) {
    const s = Number((v as { seconds: unknown }).seconds);
    return Number.isFinite(s) ? s * 1000 : null;
  }
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return null;
};
const validBirth = (b: string | undefined): string | null => {
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const [y, m, d] = b.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d ? b : null;
};

/** A player as the boards read him, with the season's shirt (dorsal and name). */
export function toPlayer(raw: PlayerDoc, seasonId: string, seasons: readonly { id: string }[]): PPlayer {
  const p = playerForSeason(raw, seasonId, [...seasons]);
  const printed = nameFor(p, seasonId);
  const name = niceName(printed);
  const pos = resolvePositions(p);
  const natural = pos.main ? POSITIONS[pos.main].line : pos.line ?? null;
  const visible = new Set(seasons.map((s) => s.id));
  const sanction = raw.sanction ? { games: raw.sanction.games, ...(raw.sanction.untilMatchId ? { untilMatchId: raw.sanction.untilMatchId } : {}), ...(raw.sanction.reason ? { reason: raw.sanction.reason } : {}) } : null;
  return {
    id: raw.id,
    n: typeof p.number === "number" ? p.number : null,
    num: typeof p.number === "number" ? String(p.number) : "",
    shirt: printed.toLocaleUpperCase("es"),
    name,
    full: [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() || name,
    main: pos.main,
    also: pos.also,
    natural,
    birth: validBirth(raw.birthDate),
    h: raw.height || null,
    w: raw.weight || null,
    seasons: (raw.seasons ?? []).filter((s) => visible.has(s)).length,
    injured: raw.injured === true,
    sanction,
    sanctionClearedAt: typeof raw.sanctionClearedAt === "number" ? raw.sanctionClearedAt : null,
    review: raw.positionsReview ? { status: raw.positionsReview.status, at: msOf(raw.positionsReview.at) } : null,
    photo: raw.photoUrl || null,
    active: raw.active !== false,
    quote: raw.quote?.trim() ?? "",
    bio: raw.bio?.trim() ?? "",
  };
}

// ── the ficha
const parts = (b: string) => {
  const [y, m, d] = b.split("-").map(Number);
  return { y, m: m - 1, d };
};
const madridDay = (now: number) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts(f);
};
const dayNum = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d) / DAY);
export function age(p: Pick<PPlayer, "birth">, now: number): number | null {
  if (!p.birth) return null;
  const B = parts(p.birth);
  const N = madridDay(now);
  let a = N.y - B.y;
  if (N.m < B.m || (N.m === B.m && N.d < B.d)) a--;
  return a >= 0 && a < 110 ? a : null;
}
export interface Birthday {
  label: string;
  long: string;
  days: number;
  when: string;
  turns: number;
}
export function birthday(p: Pick<PPlayer, "birth">, now: number): Birthday | null {
  if (!p.birth) return null;
  const B = parts(p.birth);
  const N = madridDay(now);
  let y = N.y;
  let days = dayNum(y, B.m, B.d) - dayNum(N.y, N.m, N.d);
  if (days < 0) {
    y++;
    days = dayNum(y, B.m, B.d) - dayNum(N.y, N.m, N.d);
  }
  const when = days === 0 ? "¡hoy!" : days === 1 ? "mañana" : `en ${days} días`;
  return { label: `${B.d} ${MONTHS[B.m]}`, long: `${B.d} de ${MONTHS_L[B.m]}`, days, when, turns: y - B.y };
}
const SIGNS: [number, string][] = [[120, "Capricornio"], [219, "Acuario"], [320, "Piscis"], [420, "Aries"], [520, "Tauro"], [621, "Géminis"], [722, "Cáncer"], [822, "Leo"], [922, "Virgo"], [1022, "Libra"], [1121, "Escorpio"], [1221, "Sagitario"], [1231, "Capricornio"]];
export function sign(p: Pick<PPlayer, "birth">): string | null {
  if (!p.birth) return null;
  const B = parts(p.birth);
  const md = (B.m + 1) * 100 + B.d;
  return SIGNS.find(([to]) => md <= to)?.[1] ?? "Capricornio";
}
/** «1,78 m». */
export const heightText = (h: number | null): string | null => (h ? `${Math.floor(h / 100)},${String(h % 100).padStart(2, "0")} m` : null);
export function missing(p: Pick<PPlayer, "birth" | "h" | "w">): string[] {
  const m: string[] = [];
  if (!p.birth) m.push("cumpleaños");
  if (!p.h) m.push("altura");
  if (!p.w) m.push("peso");
  return m;
}
export const joinY = (xs: readonly string[]): string => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** Where he plays: the exact position when the ficha has one, else his line, else «Por definir». */
export function posOf(p: Pick<PPlayer, "main" | "natural">): { name: string; line: Line; code: string; exact: boolean } {
  if (p.main) return { name: posLabel(p.main), line: POSITIONS[p.main].line, code: p.main, exact: true };
  if (p.natural) return { name: LINE_ONE[p.natural], line: p.natural, code: p.natural, exact: false };
  return { name: "Por definir", line: "MED", code: "", exact: false };
}
export const lineOrder = (l: Line) => LINE_ORDER[l];
export const lineName = (l: Line, n: number) => (n === 1 ? LINE_ONE[l] : LINE_MANY[l]).toLocaleLowerCase("es");
export { LINE_NAMES };

export interface Avail {
  k: "injured" | "sanction";
  status: string;
  text: string;
}
/** Lesionado, or sancionado until a jornada (with the reason), or free (null). */
export function avail(p: Pick<PPlayer, "injured" | "sanction">, jornadaOf: (matchId: string) => number | undefined): Avail | null {
  if (p.injured) return { k: "injured", status: "Lesionado", text: "Lesionado: no está disponible" };
  const s = p.sanction;
  if (!s) return null;
  const j = s.untilMatchId ? jornadaOf(s.untilMatchId) : undefined;
  const until = j ? `J${j}` : "";
  const games = `${s.games} ${s.games === 1 ? "partido" : "partidos"}`;
  return { k: "sanction", status: `Sancionado · ${until || games}`, text: `Sancionado ${games}${until ? `, hasta la ${until}` : ""}${s.reason ? ` · ${s.reason}` : ""}` };
}

// ── a period: the season's games (or every season's), and what each player did in them
export interface Ctx {
  /** The finished, visible games of the period, oldest first. */
  games: ClubMatch[];
  rows: Map<string, PlayerAnalysis>;
  mvpOf: MvpOf;
  /** Narrated analysis of the period (null when none of its actas carries any). */
  tech: ReturnType<typeof technicalAnalysis>;
  /** Pass links completed (from → to) of the narration. */
  passes: Map<string, number>;
  jornada: Map<string, number>;
  results: ReadonlyMap<string, MvpResult>;
  now: number;
}
export function periodCtx(players: readonly PlayerDoc[], matches: readonly ClubMatch[], seasonId: string | "all", seasons: readonly { id: string }[], results: ReadonlyMap<string, MvpResult>, now: number): Ctx {
  const games = chronological(matches.filter((m) => isVisibleMatch(m) && (seasonId === "all" || m.seasonId === seasonId)));
  const rows = new Map<string, PlayerAnalysis>();
  for (const raw of players) rows.set(raw.id, analysePlayer(playerForSeason(raw, seasonId, [...seasons]), games));
  const winners = mvpOfFrom(results, games, now);
  const tech = technicalAnalysis(games);
  const passes = new Map<string, number>();
  for (const l of tech.links) passes.set(`${l.from}>${l.to}`, (passes.get(`${l.from}>${l.to}`) ?? 0) + l.count);
  return { games, rows, mvpOf: winners, tech, passes, jornada: jornadaNumbers(matches as ClubMatch[]), results, now };
}

export interface PStats {
  pj: number;
  g: number;
  a: number;
  /** Known minutes (null when no acta of the period knows his time). */
  min: number | null;
  tit: number;
  sup: number;
  nc: number;
  inn: number;
  out: number;
  am: number;
  rojas: number;
  ocas: number;
  palo: number;
  paradas: number;
  fh: number;
  fr: number;
  pen: number;
  gpen: number;
  gfal: number;
  pcom: number;
  prec: number;
  mvp: number;
  wins: number;
  /** Goals by ten-minute bins (0′, 10′, 20′, 30′, 40′+). */
  goalMin: number[];
  /** Whether the period's actas carry a ledger for him (titular, cambios…). */
  tracked: boolean;
}
const ZERO: PStats = { pj: 0, g: 0, a: 0, min: null, tit: 0, sup: 0, nc: 0, inn: 0, out: 0, am: 0, rojas: 0, ocas: 0, palo: 0, paradas: 0, fh: 0, fr: 0, pen: 0, gpen: 0, gfal: 0, pcom: 0, prec: 0, mvp: 0, wins: 0, goalMin: [0, 0, 0, 0, 0], tracked: false };
const eventMinute = (e: { elapsedSeconds?: number; minute?: number }) => (typeof e.elapsedSeconds === "number" ? e.elapsedSeconds / 60 : typeof e.minute === "number" ? e.minute : null);

export function stats(id: string, ctx: Ctx): PStats {
  const r = ctx.rows.get(id);
  if (!r) return ZERO;
  const goalMin = [0, 0, 0, 0, 0];
  for (const m of ctx.games)
    for (const e of settled(m.events ?? [])) {
      if (e.playerId !== id || e.type === "opponent_own_goal" || eventMetaOf(e).goal !== "for") continue;
      const t = eventMinute(e);
      if (t === null) continue;
      goalMin[Math.min(4, Math.max(0, Math.floor(Math.max(0, t - 1e-9) / 10)))]++;
    }
  const played = r.series.filter((g) => g.played);
  return {
    pj: r.matchesPlayed,
    g: r.goals,
    a: r.assists,
    min: r.tracked > 0 && (!played.length || played.some((g) => g.minutes !== null)) ? Math.round(r.minutes) : null,
    tit: r.starts,
    sup: r.bench,
    nc: r.notCalled,
    inn: r.subIn,
    out: r.subOut,
    am: r.yellowCards,
    rojas: r.redCards,
    ocas: r.chances,
    palo: r.woodwork,
    paradas: r.saves,
    fh: r.fouls,
    fr: r.foulsReceived,
    pen: r.penaltySaved,
    gpen: r.goalPenalty,
    gfal: r.goalFreekick,
    pcom: r.penaltyCommitted,
    prec: r.penaltyReceived,
    mvp: ctx.games.filter((m) => ctx.mvpOf(m.id, id) === id).length,
    wins: played.filter((g) => (g.match.goalsFor ?? 0) > (g.match.goalsAgainst ?? 0)).length,
    goalMin,
    tracked: r.tracked > 0,
  };
}

export interface AdnDay {
  j: number | null;
  id: string;
  rival: string;
  res: "G" | "E" | "P";
  sc: string;
  on: boolean;
  g: number;
  a: number;
  min: number | null;
  mvp: boolean;
  home: boolean;
  stints: { from: number; to: number }[];
  exchanges: { minute: number; with: string; direction: "in" | "out" }[];
  duration: number;
}
/** His jornadas (oldest first); the boards draw the last twelve. */
export function adn(id: string, ctx: Ctx): AdnDay[] {
  return ctx.games.map((m) => {
    const g = playerGame(id, m);
    const row = m.ledger?.[id];
    const gf = m.goalsFor ?? 0;
    const ga = m.goalsAgainst ?? 0;
    const min = g.played ? minutesOf(m, id) : 0;
    return {
      j: ctx.jornada.get(m.id) ?? null,
      id: m.id,
      rival: m.rival ?? "Rival",
      res: resultLetter(gf, ga),
      sc: `${gf}–${ga}`,
      on: g.played,
      g: g.goals,
      a: g.assists,
      min: min === null ? null : Math.round(min),
      mvp: ctx.mvpOf(m.id, id) === id,
      home: m.home !== false,
      stints: g.played && row?.stints ? row.stints : [],
      exchanges: g.played && row?.exchanges ? row.exchanges : [],
      duration: m.duration || 50,
    };
  });
}

/** Goals or assists leaders (ties share it): the most and who has it. */
export function leaders(ids: readonly string[], ctx: Ctx, key: "g" | "a"): { n: number; ids: string[] } {
  let best = 0;
  let who: string[] = [];
  for (const id of ids) {
    const v = stats(id, ctx)[key];
    if (v > best) {
      best = v;
      who = [id];
    } else if (v && v === best) who.push(id);
  }
  return { n: best, ids: best ? who : [] };
}
/** The goal podium with shared places. */
export function podium(ids: readonly string[], ctx: Ctx, numOf: (id: string) => number): { id: string; g: number; a: number; place: number }[] {
  const rows = ids.map((id) => ({ id, ...stats(id, ctx) })).filter((r) => r.g > 0);
  rows.sort((a, b) => b.g - a.g || b.a - a.a || numOf(a.id) - numOf(b.id));
  let place = 0;
  let last = -1;
  return rows.map((r, i) => {
    if (r.g !== last) {
      place = i + 1;
      last = r.g;
    }
    return { id: r.id, g: r.g, a: r.a, place };
  });
}

/** Matches in a row with a goal: now (ending at his last match) and his best. */
export function scoring(id: string, ctx: Ctx): { now: number; best: number } {
  let run = 0;
  let best = 0;
  for (const d of adn(id, ctx)) {
    if (!d.on) continue;
    if (d.g > 0) {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  return { now: run, best };
}

/** The radar's six axes, 0–100 over the squad (statsView radarScores). */
export function radar(id: string, ids: readonly string[], ctx: Ctx): number[] {
  const me = ctx.rows.get(id);
  const rows = ids.map((x) => ctx.rows.get(x)).filter((r): r is PlayerAnalysis => !!r);
  if (!me) return [0, 0, 0, 0, 0, 0];
  return radarScores(me, rows, ctx.games.length).map((v) => Math.round(v * 100));
}
export function radarAvg(ids: readonly string[], ctx: Ctx): number[] {
  const sum = [0, 0, 0, 0, 0, 0];
  let n = 0;
  for (const id of ids) {
    if (!stats(id, ctx).pj) continue;
    n++;
    radar(id, ids, ctx).forEach((v, i) => (sum[i] += v));
  }
  return sum.map((v) => (n ? Math.round(v / n) : 0));
}

export const passesBetween = (ctx: Ctx, a: string, b: string): number => ctx.passes.get(`${a}>${b}`) ?? 0;
/** Minutes two players shared on the pitch (their stints, every match of the period). */
export function overlap(ctx: Ctx, a: string, b: string): number {
  let t = 0;
  for (const m of ctx.games) {
    const A = m.ledger?.[a]?.stints ?? [];
    const B = m.ledger?.[b]?.stints ?? [];
    for (const x of A) for (const y of B) t += Math.max(0, Math.min(x.to, y.to) - Math.max(x.from, y.from));
  }
  return Math.round(t);
}

export interface PartnerView {
  id: string;
  games: number;
  wins: number;
  /** Passes (narrated) or goal passes from him to the partner, and back. */
  toHim: number;
  fromHim: number;
  together: number;
  /** The numbers are the narration's completed passes (else goal passes). */
  passes: boolean;
}
/** His best partner: with narrated passes, whom he passes with most (then minutes together); else the one he
 *  shared most matches with (then wins, then goal passes). */
export function partner(id: string, ids: readonly string[], ctx: Ctx): PartnerView | null {
  const me = ctx.rows.get(id);
  if (!me || !me.matchesPlayed) return null;
  const others = ids.filter((o) => o !== id && (ctx.rows.get(o)?.matchesPlayed ?? 0) > 0);
  const withPasses = others.filter((o) => passesBetween(ctx, id, o) + passesBetween(ctx, o, id) > 0);
  if (withPasses.length) {
    let best: { id: string; score: number; ov: number } | null = null;
    for (const o of withPasses) {
      const score = passesBetween(ctx, id, o) + passesBetween(ctx, o, id);
      const ov = overlap(ctx, id, o);
      if (!best || score > best.score || (score === best.score && ov > best.ov)) best = { id: o, score, ov };
    }
    if (best) {
      const shared = ctx.games.filter((m) => m.ledger?.[id]?.played && m.ledger?.[best.id]?.played);
      return { id: best.id, games: shared.length, wins: shared.filter((m) => (m.goalsFor ?? 0) > (m.goalsAgainst ?? 0)).length, toHim: passesBetween(ctx, id, best.id), fromHim: passesBetween(ctx, best.id, id), together: best.ov, passes: true };
    }
  }
  const p = bestPartner(id, ctx.games, others);
  if (!p) return null;
  return { id: p.playerId, games: p.together, wins: p.wins, toHim: p.theirGoalsFromYou, fromHim: p.yourGoalsFromThem, together: overlap(ctx, id, p.playerId), passes: false };
}

/** The constellation: the teammates he shared a match with (eight at most), the closest first. */
export function partners(id: string, ids: readonly string[], ctx: Ctx, numOf: (id: string) => number): { id: string; games: number; links: number; together: number }[] {
  const mine = ctx.games.filter((m) => playerGame(id, m).played);
  const out: { id: string; games: number; links: number; together: number }[] = [];
  for (const o of ids) {
    if (o === id) continue;
    const games = mine.filter((m) => playerGame(o, m).played).length;
    if (!games) continue;
    const goalLinks = mine.reduce((s, m) => s + (m.events ?? []).filter((e) => eventMetaOf(e).goal === "for" && ((e.playerId === id && e.assistPlayerId === o) || (e.playerId === o && e.assistPlayerId === id))).length, 0);
    const links = passesBetween(ctx, id, o) + passesBetween(ctx, o, id) || goalLinks;
    out.push({ id: o, games, links, together: overlap(ctx, id, o) });
  }
  return out.sort((a, b) => b.links - a.links || b.together - a.together || b.games - a.games || numOf(a.id) - numOf(b.id)).slice(0, 8);
}

/** Positions by exact minutes (positionStats); with no official pizarra, his preferred one counts. */
export function positions(id: string, ctx: Ctx): { known: boolean; lines: (PosLine & { min: number | null })[] } {
  const pp = playerPositions(id, ctx.games, ctx.mvpOf);
  return { known: pp.lines.length > 0 && pp.estimatedMatches < pp.matches, lines: pp.lines.map((l) => ({ ...l, min: Math.round(l.minutes) })) };
}

/** His medals over his whole career (a milestone is won once) and the next three to chase. */
export function medals(id: string, matches: readonly ClubMatch[], ctx: Ctx, seasons: readonly { id: string; name: string }[]): { got: Achievement[]; next: Achievement[] } {
  const list = achievements(id, [...matches], { mvpResults: ctx.results, mvpOf: ctx.mvpOf, seasons, now: ctx.now });
  return { got: list.filter((a) => a.earned), next: nextToChase(list, 3) };
}

/** His album of the season: the cromo of every teammate he has played a match with. */
export function album(viewerId: string, matches: readonly ClubMatch[], ids: readonly string[], seasonId: string, jornada: Map<string, number>) {
  const a = albumOf(viewerId, matches, ids, seasonId);
  const firstWith = new Map<string, string>();
  const played = chronological(matches.filter((m) => m.seasonId === seasonId && m.ledger?.[viewerId]?.played));
  for (const m of played) for (const [pid, row] of Object.entries(m.ledger ?? {})) if (row?.played && !firstWith.has(pid)) firstWith.set(pid, jornada.has(m.id) ? `J${jornada.get(m.id)}` : "");
  const owned = ids.filter((i) => a.owned.some((o) => o.id === i));
  const left = ids.length - owned.length;
  const line = !owned.length ? "El primero llega con tu primer partido." : left === 0 ? "Los tienes todos." : left === 1 ? "Te falta uno: juega con él y lo tienes." : `Te faltan ${left}: juega con ellos y los tienes.`;
  return { owned, at: firstWith, missing: ids.filter((i) => !owned.includes(i)), total: ids.length, line };
}

/** The narrated analysis of him in the period (null when none of his actions is narrated). */
export function techOf(id: string, ctx: Ctx): TechnicalStats {
  return ctx.tech.players[id] ?? emptyTechnical();
}

/** The last finished match of the season (its acta), or null. */
export function lastMatch(matches: readonly ClubMatch[], seasonId: string): ClubMatch | null {
  const done = chronological(matches.filter((m) => m.seasonId === seasonId && isVisibleMatch(m) && m.status === "finished"));
  return done.at(-1) ?? null;
}
/** The next match of the season still to play (by date), or null. */
export function nextMatch(matches: readonly ClubMatch[], seasonId: string, now: number): ClubMatch | null {
  return (
    matches
      .filter((m) => m.seasonId === seasonId && isVisibleMatch(m) && m.status !== "finished" && m.status !== "cancelled" && dateMillis(m.date) > now)
      .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0] ?? null
  );
}

/** The MVP winners of a closed vote (empty while open). */
export const winnersOf = (m: ClubMatch, results: ReadonlyMap<string, MvpResult>, now: number): string[] => mvpWinners(m, results.get(m.id), now);

export const isCode = isPosCode;
