// La pizarra «Noche de partido» — the cromos: each player's form rating, his season line and the
// pair stats the química reads (minutes on the pitch together, goals assisted to each other). Everything
// is derived from the season's finished matches already loaded by the app (no extra reads). Pure.
import type { ClubMatch, MatchEvent } from "../../../lib/clubData";
import { playerGame } from "../../../lib/clubAnalytics";
import { goalLinks } from "../../../lib/statsView";
import type { Zone } from "../formations";
import { normZone } from "../positions";
import { resolvePositions } from "../../../lib/positions";
import type { Sanction, Suspension } from "../chemistry";
import { pairKey, type Baja, type Convocatoria, type Cromo, type FormGame, type PairStats, type Squad } from "./model";
import { plural } from "./plural";

/** How many recent matches make the «sobre» (Sugerir siete) and weigh double in the form. */
export const RECENT_GAMES = 3;
const DEFAULT_DURATION = 50;
/** The form's range: wide enough that differences show on the cromo. */
export const FORM_MIN = 45;
export const FORM_MAX = 95;

/**
 * One player's season, weighted: each team match counts 1, the last RECENT_GAMES count 2 (form is
 * what he has done lately). Sums over the team's matches, played or not (missing one lowers his share).
 */
export interface FormInput {
  /** His natural position (the role decides what counts: goals conceded for POR / DEF). */
  role?: Zone;
  /** Σ weight of the team's matches, and Σ weight of those he played. */
  teamW: number;
  playedW: number;
  /** Σ weight · his share of the match's minutes (0–1 each). */
  shareW: number;
  /** Σ weight · minutes he played. */
  minW: number;
  /** Σ weight · goals + assists. */
  gaW: number;
  /** Σ weight · goals the team conceded while he was on the pitch. */
  concW: number;
  /** Σ weight · MVPs. */
  mvpW: number;
  /** Σ weight · cards (a yellow 1, a red or a second yellow 2). */
  cardsW: number;
  /** Σ weight · penalties saved. */
  savesW: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The form rating (FORM_MIN–FORM_MAX), or null before his first match. The formula:
 *
 *   presence = Σw·minutes share / Σw (team matches)                       — is he playing?
 *   attack   = min(1, G+A per 90 / 1.5), per 90 = Σw·(G+A)·90 / (Σw·min + 90)
 *              (90 pseudo-minutes with nothing: a goal in a cameo is not a hat-trick a match)
 *   defence  = 1 − conceded per 90 / 6, per 90 = (Σw·conceded + 3)·90 / (Σw·min + 90)
 *              (the prior: 3 per 90, a neutral 0.5; only for POR / DEF)
 *   role     = POR: defence + 0.15 per penalty saved a match (≤ 1) · DEF: 0.6·defence + 0.4·attack ·
 *              MED / DEL / unknown: attack
 *   mvp      = Σw·MVPs / Σw played · cards = min(1, Σw·cards / Σw played)
 *   rating   = 45 + 50 · clamp(0.35·presence + 0.45·role + 0.20·mvp − 0.15·cards, 0, 1)
 *
 * A regular who plays everything and contributes nothing sits in the low 60s; a scorer in form reaches
 * the high 80s and the MVPs take him to 95; a bench player with a cameo stays near 45.
 */
export function formRating(f: FormInput): number | null {
  if (f.playedW <= 0 || f.teamW <= 0) return null;
  const presence = clamp01(f.shareW / f.teamW);
  const per90 = (x: number) => (x * 90) / (f.minW + 90);
  const attack = clamp01(per90(f.gaW) / 1.5);
  const defence = clamp01(1 - per90(f.concW + 3) / 6);
  const role =
    f.role === "POR" ? clamp01(defence + (0.15 * f.savesW) / f.playedW) : f.role === "DEF" ? 0.6 * defence + 0.4 * attack : attack;
  const mvp = clamp01(f.mvpW / f.playedW);
  const cards = clamp01(f.cardsW / f.playedW);
  const raw = clamp01(0.35 * presence + 0.45 * role + 0.2 * mvp - 0.15 * cards);
  return Math.round(FORM_MIN + (FORM_MAX - FORM_MIN) * raw);
}

const durationOf = (m: ClubMatch): number => (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION);
const oppGoals = (m: ClubMatch): MatchEvent[] => (m.events ?? []).filter((e) => e.type === "opponent_goal");

/** When a player was on the pitch in a match: the ledger's stints (null = no stints recorded). */
function stintsOf(m: ClubMatch, id: string): { from: number; to: number }[] | null {
  const st = m.ledger?.[id]?.stints;
  return st && st.length ? st : null;
}

const inStint = (minute: number, s: { from: number; to: number }, d: number) => minute >= s.from && (minute < s.to || (minute === s.to && s.to >= d));

/** Goals the team conceded while he was on the pitch (the stints; without them, his share of the match). */
export function concededOnPitch(m: ClubMatch, id: string, minutes: number): number {
  const d = durationOf(m);
  const st = stintsOf(m, id);
  const opp = oppGoals(m);
  if (st) return opp.filter((e) => typeof e.minute === "number" && st.some((s) => inStint(e.minute as number, s, d))).length;
  const total = opp.length || (typeof m.goalsAgainst === "number" ? m.goalsAgainst : 0);
  return total * Math.min(1, minutes / d);
}

/** Minutes two players were on the pitch at the same time in a match (their stints; without them, the
 *  shorter of their minutes when both played). */
export function minutesTogether(m: ClubMatch, a: string, b: string, minA: number, minB: number): number {
  const sa = stintsOf(m, a);
  const sb = stintsOf(m, b);
  if (sa && sb) {
    let t = 0;
    for (const x of sa) for (const y of sb) t += Math.max(0, Math.min(x.to, y.to) - Math.max(x.from, y.from));
    return t;
  }
  return Math.min(minA, minB);
}

/** A match's cards as the form reads them: a yellow 1, a sending-off (red or second yellow) 2. */
export function cardPoints(g: { yellowCards: number; redCards: number; doubleYellows: number }): number {
  // (a second yellow is stored as two yellows and a sending-off: it counts once, as the sending-off)
  return Math.max(0, g.yellowCards - 2 * g.doubleYellows) + 2 * Math.max(g.redCards, g.doubleYellows);
}

interface Recent {
  played: number;
  goals: number;
  assists: number;
  mvps: number;
  clean: number;
  minutes: number;
}

/** Why the form is what it is, in a few words, from his part in the team's last RECENT_GAMES matches. */
export function whyOf(r: Recent, role: Zone | undefined, played: number): string {
  if (!played) return "Sin partidos esta temporada";
  if (!r.played) return "Sin jugar en los " + RECENT_GAMES + " últimos partidos";
  const last = r.played === 1 ? "en su último partido" : "en sus " + r.played + " últimos";
  if (r.goals || r.assists) return [r.goals ? plural(r.goals, "gol", "goles") : "", r.assists ? plural(r.assists, "asistencia") : ""].filter(Boolean).join(" y ") + " " + last;
  if (r.mvps) return (r.mvps === 1 ? "MVP " : r.mvps + " veces MVP ") + last;
  if ((role === "POR" || role === "DEF") && r.clean) return "Portería a cero " + (r.clean === r.played ? last : "en " + r.clean + " de sus " + r.played + " últimos");
  return plural(Math.round(r.minutes), "minuto") + " " + last + ", sin goles";
}

/** The «why» of a player's form (the ficha and the cromo's label), «—» if he is not in the squad. */
export function formWhy(sq: Squad, id: string): string {
  return sq.byId.get(id)?.why ?? "—";
}

/** How many of the last matches the ficha's form bars show. */
export const FORM_GAMES = 5;

/** A player's last `n` matches of `games` (the season's finished ones, oldest first), oldest first. */
export function formGames(playerId: string, games: readonly ClubMatch[], jornada: ReadonlyMap<string, number>, n = FORM_GAMES): FormGame[] {
  return games.slice(-n).map((m, k) => {
    const g = playerGame(playerId, m);
    const min = g.minutes ?? (g.played ? durationOf(m) : 0);
    return { j: jornada.get(m.id) ?? games.length - Math.min(n, games.length) + k + 1, played: g.played, min, ga: g.ga };
  });
}

export interface SquadPlayer {
  id: string;
  shirtName: string;
  firstName: string;
  number: number;
  /** His line, always POR/DEF/MED/DEL now (resolvePositions' line, set by the callers); normZone is only a guard. */
  naturalPosition?: Zone | string;
  /** His positions ({main, also}; the callers pass resolvePositions' set so the code of an old text
   *  survives), read with resolvePositions; absent = only the line is known. */
  positions?: unknown;
  injured: boolean;
  active: boolean;
  /** A sanction set by hand and the last «Levantar la sanción» (chemistry.suspensions reads them). */
  sanction?: Sanction | null;
  sanctionClearedAt?: number | null;
}

export interface SquadInput {
  players: SquadPlayer[];
  /** The season's finished matches, oldest first. */
  games: ClubMatch[];
  /** Jornada number of each match id (its order in the season calendar). */
  jornada: Map<string, number>;
  /** Who is suspended: the ids, or chemistry.suspensions() with what is left and why. */
  suspended: ReadonlySet<string> | ReadonlyMap<string, Suspension>;
  /** MVP winners per match id. */
  mvps: Map<string, string[]>;
  convocatoria?: Map<string, Convocatoria>;
}

export function buildSquad({ players, games, jornada, suspended, mvps, convocatoria }: SquadInput): Squad {
  const recent = games.slice(-RECENT_GAMES);
  const recentFrom = games.length - recent.length;
  const teamMin = games.reduce((s, m) => s + durationOf(m), 0);
  // match index → who played and his minutes
  const playedBy: Map<string, number>[] = games.map(() => new Map());
  const list: Cromo[] = players.map((p) => {
    const role = normZone(p.naturalPosition);
    let played = 0, goals = 0, assists = 0, minutes = 0, starts = 0, mv = 0, recentMin = 0, recentGA = 0;
    const f: FormInput = { role, teamW: 0, playedW: 0, shareW: 0, minW: 0, gaW: 0, concW: 0, mvpW: 0, cardsW: 0, savesW: 0 };
    const r: Recent = { played: 0, goals: 0, assists: 0, mvps: 0, clean: 0, minutes: 0 };
    games.forEach((m, gi) => {
      const g = playerGame(p.id, m);
      const row = m.ledger?.[p.id];
      const d = durationOf(m);
      const isRecent = gi >= recentFrom;
      const w = isRecent ? 2 : 1;
      const mvp = mvps.get(m.id)?.includes(p.id) ? 1 : 0;
      const min = g.minutes ?? (g.played ? d : 0);
      f.teamW += w;
      goals += g.goals;
      assists += g.assists;
      minutes += min;
      if (row?.started) starts++;
      mv += mvp;
      if (isRecent) {
        recentMin += min;
        recentGA += g.ga;
      }
      if (!g.played) return;
      played++;
      playedBy[gi].set(p.id, min);
      const conc = concededOnPitch(m, p.id, min);
      f.playedW += w;
      f.shareW += w * Math.min(1, min / d);
      f.minW += w * min;
      f.gaW += w * g.ga;
      f.concW += w * conc;
      f.mvpW += w * mvp;
      f.cardsW += w * cardPoints(g);
      f.savesW += w * g.penaltySaved;
      if (isRecent) {
        r.played++;
        r.goals += g.goals;
        r.assists += g.assists;
        r.mvps += mvp;
        r.minutes += min;
        if (conc === 0) r.clean++;
      }
    });
    const baja: Baja | undefined = !p.active ? "Inactivo" : p.injured ? "Lesionado" : suspended.has(p.id) ? "Sancionado" : undefined;
    const susp = "get" in suspended ? suspended.get(p.id) : undefined;
    const form = formRating(f);
    return {
      id: p.id,
      num: p.number,
      // Printed in capitals, like the cromos of the design (the stored name is left as it is).
      name: (p.shirtName || p.firstName || "Jugador").toLocaleUpperCase("es"),
      pos: role,
      ps: resolvePositions({ positions: p.positions, naturalPosition: p.naturalPosition }),
      rt: form ?? FORM_MIN,
      ...(form == null ? { unrated: true } : {}),
      why: whyOf(r, role, played),
      stats: { played, goals, assists, minutes, starts, mvps: mv },
      recentMin,
      recentGA,
      baja,
      ...(susp && baja === "Sancionado" ? { sancion: susp.reason ? { left: susp.left, reason: susp.reason } : { left: susp.left } } : {}),
      cv: convocatoria?.get(p.id),
      // the ficha's form bars: his last matches
      form: formGames(p.id, games, jornada),
    };
  });
  const pairs = new Map<string, PairStats>();
  const pair = (a: string, b: string): PairStats => {
    const key = pairKey(a, b);
    let cur = pairs.get(key);
    if (!cur) pairs.set(key, (cur = { tog: 0, ast: 0, min: 0 }));
    return cur;
  };
  playedBy.forEach((set, gi) => {
    const ids = [...set.keys()];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const t = minutesTogether(games[gi], ids[i], ids[j], set.get(ids[i]) ?? 0, set.get(ids[j]) ?? 0);
        if (t <= 0) continue;
        const ps = pair(ids[i], ids[j]);
        ps.tog++;
        ps.min += t;
      }
  });
  goalLinks(games).forEach((l) => {
    if (l.from !== l.to) pair(l.from, l.to).ast += l.n;
  });
  const js = recent.map((m) => jornada.get(m.id)).filter((n): n is number => typeof n === "number");
  const recentLabel = js.length ? (js.length === 1 ? `J${js[0]}` : `J${js[0]}–J${js[js.length - 1]}`) : "";
  return { list, byId: new Map(list.map((c) => [c.id, c])), pairs, recentLabel, games: games.length, teamMin };
}
