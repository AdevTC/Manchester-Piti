// La pizarra «Noche de partido» — the cromos: each player's season GLOBAL, his season line and the
// pair stats the química reads (minutes on the pitch together, goals assisted to each other). Everything
// is derived from the season's finished matches already loaded by the app (no extra reads). Pure.
import type { ClubMatch } from "../../../lib/clubData";
import { isVisibleMatch } from "../../../../functions/src/matchEngine";
import { concededOnPitch, durationOf, stintsOf } from "../../../lib/form";
import { GLOBAL_MAX as FORM_MAX, GLOBAL_MIN as FORM_MIN, ratingMatches, seasonRatingFrom, seasonRatings } from "../../../lib/seasonRating";
import type { Standings } from "../../../lib/standings";
import { goalLinks, playerGame } from "../../../lib/clubAnalytics";
import { minutesOf, presenceMinutes, timedGames, totalMinutes } from "../../../lib/derived/minutesOf";
import type { Zone } from "../formations";
import { normZone } from "../positions";
import { resolvePositions } from "../../../lib/positions";
import { bajaOf, type Sanction, type Suspension } from "../chemistry";
import { pairKey, type Baja, type Convocatoria, type Cromo, type FormGame, type PairStats, type Squad } from "./model";
import { plural } from "./plural";

// The per-match pieces the química and the tests read stay in lib/form.ts.
export { FORM_MAX, FORM_MIN, concededOnPitch, durationOf };

/** How many recent matches inform the «sobre» (Sugerir siete); GLOBAL never weights them twice. */
export const RECENT_GAMES = 3;

// Encaje and form in balance (the user's «Equilibrio encaje + forma»): when Auto-colocar (ops.ts
// autoByEncaje) and «Sugerir siete» (pack.ts sevenByEncaje) place by exact positions, a slot is worth
// its fit tier + the player's GLOBAL (rt, FORM_MIN–FORM_MAX) + small terms:
//  · fuera 0 · adaptado or unknown FIT_ADAPTED · in place FIT_ADAPTED + FIT_FORM_STEP: an adaptado
//    takes an in-place player's slot only with a GLOBAL at least FIT_FORM_STEP (10) points higher, a
//    tier of the card (plata 65, oro 75);
//  · the small terms — the answer (≤ 2 a step, ≤ 4 in all), familiarity (≤ 5, adaptado or unknown
//    only), the grade and the order (< 1) — stay under the step: on their own they never cross it
//    (so the step can't go under 10 unless they shrink too);
//  · Auto-colocar arranges the seven, it doesn't re-pick it: those on the pitch get FIT_STICK (9,
//    just under the step), so a bench player of the same fit comes in only with about 10 more GLOBAL
//    (≥ 10 for a «Duda»; his answer lowers it: no answer yet ≥ 8, «Voy» ≥ 6);
//  · FIT_ADAPTED is above 7 × a slot's whole spread (form + step + all the small terms, stickiness
//    included: FIT_SMALL_MAX), so in place or adaptado always beat fuera, even summed over the seven.
// (the convocatoria's own siete stays above all of it in «Sugerir siete», pack.ts OWN)
export const FIT_FORM_STEP = 10;
export const FIT_STICK = FIT_FORM_STEP - 1;
export const FIT_SMALL_MAX = 4 + 5 + FIT_STICK;
export const FIT_ADAPTED = 7 * (FORM_MAX - FORM_MIN + FIT_FORM_STEP + FIT_SMALL_MAX + 1) + 10;
export const FIT_IN_PLACE = FIT_ADAPTED + FIT_FORM_STEP;

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

interface Recent {
  played: number;
  goals: number;
  assists: number;
  mvps: number;
  clean: number;
  /** His known minutes in them (derived/minutesOf) and in how many of them they are known. */
  minutes: number;
  timed: number;
}

/** Why the form is what it is, in a few words, from his part in the team's last RECENT_GAMES matches. */
export function whyOf(r: Recent, role: Zone | undefined, played: number): string {
  if (!played) return "Sin partidos esta temporada";
  if (!r.played) return "Sin jugar en los " + RECENT_GAMES + " últimos partidos";
  const last = r.played === 1 ? "en su último partido" : "en sus " + r.played + " últimos";
  if (r.goals || r.assists) return [r.goals ? plural(r.goals, "gol", "goles") : "", r.assists ? plural(r.assists, "asistencia") : ""].filter(Boolean).join(" y ") + " " + last;
  if (r.mvps) return (r.mvps === 1 ? "MVP " : r.mvps + " veces MVP ") + last;
  if ((role === "POR" || role === "DEF") && r.clean) return "Portería a cero " + (r.clean === r.played ? last : "en " + r.clean + " de sus " + r.played + " últimos");
  // (a legacy acta does not know his minutes: no invented number; the known ones say how many they cover)
  if (!r.timed) return "Jugó " + last + ", sin goles";
  const some = r.timed < r.played ? " (" + r.timed + " con minutos)" : "";
  return plural(Math.round(r.minutes), "minuto") + " " + last + some + ", sin goles";
}

/** The «why» of a player's form (the ficha and the cromo's label), «—» if he is not in the squad. */
export function formWhy(sq: Squad, id: string): string {
  return sq.byId.get(id)?.why ?? "—";
}

/** How many of the last matches the ficha's form bars show. */
export const FORM_GAMES = 5;

/** A player's last `n` matches of `games` (the season's finished ones, oldest first), oldest first. */
export function formGames(playerId: string, games: readonly ClubMatch[], jornada: ReadonlyMap<string, number>, n = FORM_GAMES): FormGame[] {
  return games.filter(isVisibleMatch).slice(-n).map((m) => {
    const g = playerGame(playerId, m);
    return { j: jornada.get(m.id) ?? null, played: g.played, min: minutesOf(m, playerId), ga: g.ga };
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
  /** Every season's current league table (useAllStandings): the rival's strength in GLOBAL. Every caller
   *  passes the same, so the card, the cromos and the mesa print the same number. */
  standings: readonly Standings[];
  convocatoria?: Map<string, Convocatoria>;
}

export function buildSquad({ players, games, jornada, suspended, mvps, standings, convocatoria }: SquadInput): Squad {
  games = ratingMatches(games);
  const ratings = seasonRatings(games, standings);
  const recent = games.slice(-RECENT_GAMES);
  const recentFrom = games.length - recent.length;
  const teamMin = games.reduce((s, m) => s + durationOf(m), 0);
  // match index → who played: his presence minutes (internal) and his known ones (null = unknown)
  const playedBy: Map<string, { est: number; known: number | null }>[] = games.map(() => new Map());
  const list: Cromo[] = players.map((p) => {
    const role = normZone(p.naturalPosition);
    let played = 0, goals = 0, assists = 0, starts = 0, mv = 0, recentMin = 0, recentGA = 0, presenceMin = 0;
    const r: Recent = { played: 0, goals: 0, assists: 0, mvps: 0, clean: 0, minutes: 0, timed: 0 };
    games.forEach((m, gi) => {
      const g = playerGame(p.id, m);
      const row = m.ledger?.[p.id];
      const isRecent = gi >= recentFrom;
      const mvp = mvps.get(m.id)?.includes(p.id) ? 1 : 0;
      // the form (and the chemistry's pairs) read his presence: the known minutes, or on a legacy acta the
      // whole match when he played (presenceMinutes, internal: never printed); what the cromo prints is
      // the one minutes rule (derived/minutesOf), the same number as /stats, /jugadores and the perfil card
      const known = minutesOf(m, p.id);
      const min = presenceMinutes(m, p.id, g.played);
      goals += g.goals;
      assists += g.assists;
      if (row?.started) starts++;
      mv += mvp;
      if (isRecent) {
        recentMin += min;
        recentGA += g.ga;
      }
      if (!g.played) return;
      played++;
      playedBy[gi].set(p.id, { est: min, known });
      presenceMin += min;
      const conc = concededOnPitch(m, p.id, min);
      if (isRecent) {
        r.played++;
        r.goals += g.goals;
        r.assists += g.assists;
        r.mvps += mvp;
        r.minutes += known ?? 0;
        if (known !== null) r.timed++;
        if (conc === 0) r.clean++;
      }
    });
    const baja: Baja | undefined = bajaOf(p, suspended);
    const susp = "get" in suspended ? suspended.get(p.id) : undefined;
    const global = seasonRatingFrom(p, ratings, games);
    const form = global.value;
    return {
      id: p.id,
      num: p.number,
      // Printed in capitals, like the cromos of the design (the stored name is left as it is).
      name: (p.shirtName || p.firstName || "Jugador").toLocaleUpperCase("es"),
      pos: role,
      ps: resolvePositions({ positions: p.positions, naturalPosition: p.naturalPosition }),
      rt: form ?? FORM_MIN,
      ...(form == null ? { unrated: true } : {}),
      global,
      why: whyOf(r, role, played),
      stats: { played, goals, assists, minutes: totalMinutes(games, p.id), timed: timedGames(games, p.id), starts, mvps: mv },
      presenceMin,
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
        const a = set.get(ids[i])!;
        const b = set.get(ids[j])!;
        const t = minutesTogether(games[gi], ids[i], ids[j], a.est, b.est);
        if (t <= 0) continue;
        const ps = pair(ids[i], ids[j]);
        ps.tog++;
        ps.min += t;
        // what may be printed: the minutes the actas know (a legacy acta: matches together only)
        if (a.known === null || b.known === null) ps.unk = true;
        else ps.known = (ps.known ?? 0) + minutesTogether(games[gi], ids[i], ids[j], a.known, b.known);
      }
  });
  goalLinks(games).forEach((l) => {
    if (l.from !== l.to) pair(l.from, l.to).ast += l.n;
  });
  const js = recent.map((m) => jornada.get(m.id)).filter((n): n is number => typeof n === "number");
  const recentLabel = js.length ? (js.length === 1 ? `J${js[0]}` : `J${js[0]}–J${js[js.length - 1]}`) : "";
  return { list, byId: new Map(list.map((c) => [c.id, c])), pairs, recentLabel, games: games.length, teamMin };
}
