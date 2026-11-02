// r14 «La pizarra»: the app's data → the store's world (pure adapters). The squad comes from the board's cromos
// (v2/ratings buildSquad: GLOBAL = the same season rating as Tú's La carta and the cromo), the calendar from the
// season's matches, the boards from useLineups' docs with the session's unsaved edits over the board on screen.
import type { Lineup } from "../../formations";
import type { LineupDoc } from "../../lineupDoc";
import type { CalMatch } from "../../v2/boards";
import { pairOf, type Cromo, type Squad } from "../../v2/model";
import { tierOf, TIER_NAME } from "../../../../lib/derived/card";
import { currentSeasonId } from "../../../../lib/vestuario";
import { playerPositions } from "../../../../lib/positionStats";
import type { ClubMatch } from "../../../../lib/clubData";
import type { PzBoard, PzMatch, PzPlayer, PzWorld } from "./types";

/** A cromo as the pizarra reads him. */
export function playerOf(c: Cromo, jornadaOf: (matchId: string) => number | null = () => null): PzPlayer {
  const g = c.global;
  const value = g?.value ?? (c.unrated ? null : c.rt);
  return {
    id: c.id,
    shirt: c.name,
    num: c.num || null,
    first: "",
    last: "",
    line: c.ps?.line ?? c.pos ?? null,
    main: c.ps?.main ?? null,
    also: c.ps?.also ?? [],
    global: value,
    forma: g?.form ?? null,
    provisional: g?.status === "provisional",
    type: value != null ? TIER_NAME[tierOf(value)] : "Por estrenar",
    pj: c.stats.played,
    starts: c.stats.starts,
    min: c.stats.minutes,
    goals: c.stats.goals,
    assists: c.stats.assists,
    mvp: c.stats.mvps,
    notas: (g?.notes ?? [])
      .slice()
      .sort((a, b) => a.date - b.date)
      .map((n) => ({ j: jornadaOf(n.matchId), matchId: n.matchId, rival: n.rival, n: n.nota, min: n.minutes })),
    playedAt: {},
    ...(c.baja ? { baja: c.baja } : {}),
  };
}

/** The live phase of a match (la mesa's clock). */
export function phaseOf(m: CalMatch): PzMatch["phase"] {
  if (m.played) return "jugado";
  const ph = m.clock?.phase;
  if (ph === "first" || ph === "second") return "juego";
  if (ph === "halftime") return "descanso";
  if (ph === "ended") return "jugado";
  return "antes";
}

export const matchOf = (m: CalMatch): PzMatch => ({ id: m.id, j: m.j, rival: m.rival, home: m.home, at: m.dateMs, played: m.played, gf: m.gf, ga: m.ga, venue: m.venue, phase: phaseOf(m), cal: m });

/** A stored board (the lineup given = the session's unsaved one for the board on screen). */
export function boardOf(d: LineupDoc, lineup: Lineup = d): PzBoard {
  return {
    id: d.id,
    name: d.name,
    ownerUid: d.ownerUid,
    ownerNick: d.ownerNickname,
    matchId: d.matchId ?? null,
    isOfficial: d.isOfficial,
    draft: false,
    createdAt: d.createdAt ?? 0,
    updatedAt: d.updatedAt ?? 0,
    lineup: stripMeta(lineup),
  };
}
/** Only the Lineup's fields (a LineupDoc carries its meta too). */
function stripMeta(L: Lineup): Lineup {
  const { formation, freeMode, slots, bench, roles, tactics, playerPositions, pinned, subs, takers, rival, drawings, plays, variants, shapeOff, condPlan, style, tags, plan, seasonPlays } = L;
  return { formation, freeMode, slots, bench, roles, tactics, playerPositions, pinned, subs, takers, rival, drawings, plays, variants, shapeOff, condPlan, style, tags, plan, seasonPlays };
}

/** Minutes per F7 puesto this season, from the actas (positionStats: the official board of each match, or his
 *  preferida when the acta can't place him), by player. */
export function playedAtOf(ids: readonly string[], games: ClubMatch[]): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const id of ids) {
    const p = playerPositions(id, games);
    if (p.lines.length) out.set(id, Object.fromEntries(p.lines.map((l) => [l.code, Math.round(l.minutes)])));
  }
  return out;
}

/** A guest of the board's match (the acta's «invitados»: a name only) as a player. */
export function guestOf(g: { id: string; name: string }): PzPlayer {
  return { id: g.id, shirt: g.name.toLocaleUpperCase("es"), num: null, first: g.name, last: "", line: null, main: null, also: [], global: null, forma: null, provisional: true, type: "Invitado", pj: 0, starts: 0, min: 0, goals: 0, assists: 0, mvp: 0, notas: [], playedAt: {}, guest: true };
}

export interface WorldInputs {
  now: number;
  /** Minutes per puesto by player (playedAtOf). */
  playedAt?: Map<string, Record<string, number>>;
  /** The guests of the board's match. */
  guests?: { id: string; name: string }[];
  /** The team's absences (vestuario useAbsences). */
  absences?: { playerId: string | null; from: string; to: string; note: string }[];
  /** The answers of the board's match that an absence wrote (player ids). */
  byAbsence?: Set<string>;
  season: { id: string; name: string };
  squad: Squad;
  calendar: CalMatch[];
  next: CalMatch | null;
  docs: LineupDoc[];
  /** The board on screen (null = the session's draft) and its lineup with unsaved edits. */
  session: { id: string | null; name: string; lineup: Lineup; uid: string; nick: string; matchId: string | null; official: boolean } | null;
  official: LineupDoc | null;
}

export function buildWorld(i: WorldInputs): PzWorld {
  const jornada = new Map(i.calendar.map((c) => [c.id, c.j] as const));
  const squad = i.squad.list.map((c) => {
    const p = playerOf(c, (id) => jornada.get(id) ?? null);
    const at = i.playedAt?.get(c.id);
    return at ? { ...p, playedAt: at } : p;
  });
  const boards = i.docs.map((d) => (i.session && d.id === i.session.id ? boardOf(d, i.session.lineup) : boardOf(d)));
  const s = i.session;
  if (s && !s.id) boards.unshift({ id: "nuevo", name: s.name, ownerUid: s.uid, ownerNick: s.nick, matchId: s.matchId, isOfficial: false, draft: true, createdAt: i.now, updatedAt: i.now, lineup: s.lineup });
  else if (s?.id && !boards.some((b) => b.id === s.id)) boards.unshift({ id: s.id, name: s.name, ownerUid: s.uid, ownerNick: s.nick, matchId: s.matchId, isOfficial: s.official, draft: false, createdAt: i.now, updatedAt: i.now, lineup: s.lineup });
  // the answers of the board's match: the convocatoria's (useConvocatoria → cromo.cv)
  const rsvp: PzWorld["rsvp"] = {};
  i.squad.list.forEach((c) => {
    if (c.cv === "voy") rsvp[c.id] = { v: "yes" };
    else if (c.cv === "duda") rsvp[c.id] = { v: "maybe" };
    else if (c.cv === "no") rsvp[c.id] = { v: "no", ...(i.byAbsence?.has(c.id) ? { why: "Puso una ausencia" } : {}) };
  });
  return {
    now: i.now,
    season: i.season,
    squad,
    guests: (i.guests ?? []).map(guestOf),
    absences: (i.absences ?? []).flatMap((a) => (a.playerId ? [{ pid: a.playerId, from: a.from, to: a.to, note: a.note }] : [])),
    matches: i.calendar.map(matchOf),
    next: i.next?.id ?? null,
    boards,
    official: i.official ? { boardId: i.official.id, matchId: i.official.matchId ?? null } : null,
    rsvp,
    together: (a, b) => {
      const p = pairOf(i.squad, a, b);
      return p.known ?? p.min ?? 0;
    },
    games: i.squad.games,
  };
}

/**
 * The season the pizarra shows: the one asked for, else (none, «all», or one that isn't there) the current one —
 * the next match's, else the latest played, else the newest season. A board always belongs to one season, so «all»
 * would show none.
 */
export function pizarraSeason(asked: string | undefined, seasons: readonly { id: string }[], next: Parameters<typeof currentSeasonId>[0], matches: Parameters<typeof currentSeasonId>[1]): string {
  if (asked && asked !== "all" && seasons.some((s) => s.id === asked)) return asked;
  return currentSeasonId(next, matches, seasons as { id: string }[]) || (asked && asked !== "all" ? asked : "");
}
