// La pizarra «Noche de partido» — the cromos: each player's form rating, his season line and the
// pair stats the química reads (matches together, goals assisted to each other). Everything is
// derived from the season's finished matches already loaded by the app (no extra reads). Pure.
import type { ClubMatch } from "../../../lib/clubData";
import { playerGame } from "../../../lib/clubAnalytics";
import { goalLinks } from "../../../lib/statsView";
import type { Zone } from "../formations";
import { normZone } from "../positions";
import { pairKey, type Baja, type Convocatoria, type Cromo, type PairStats, type Squad } from "./model";

/** How many recent matches make the «sobre» (Sugerir siete). */
export const RECENT_GAMES = 3;
const DEFAULT_DURATION = 50;

export interface FormInput {
  played: number;
  ga: number;
  recentMin: number;
  /** Minutes on offer over the recent window (their durations). */
  recentMax: number;
  saves: number;
  mvps: number;
  /** Matches the team has played (the scale; never below 7, the design's half season). */
  games: number;
}

/** The cromo's rating chip (48–96): presence, goals+assists, recent minutes, saves and MVPs.
 *  With seven matches played it is exactly the design's formula; longer seasons are scaled to it. */
export function formRating(f: FormInput): number {
  const k = 7 / Math.max(7, f.games);
  const recent = f.recentMax > 0 ? (f.recentMin / f.recentMax) * 12 : 0;
  const raw = 55 + 2 * f.played * k + Math.min(16, f.ga * 1.6 * k) + recent + (f.saves * 2 + f.mvps * 1.5) * k;
  return Math.max(48, Math.min(96, Math.round(raw)));
}

export interface SquadPlayer {
  id: string;
  shirtName: string;
  firstName: string;
  number: number;
  /** As stored: a code or a word («Portero»…); normalized here. */
  naturalPosition?: Zone | string;
  injured: boolean;
  active: boolean;
}

export interface SquadInput {
  players: SquadPlayer[];
  /** The season's finished matches, oldest first. */
  games: ClubMatch[];
  /** Jornada number of each match id (its order in the season calendar). */
  jornada: Map<string, number>;
  suspended: Set<string>;
  /** MVP winners per match id. */
  mvps: Map<string, string[]>;
  convocatoria?: Map<string, Convocatoria>;
}

export function buildSquad({ players, games, jornada, suspended, mvps, convocatoria }: SquadInput): Squad {
  const recent = games.slice(-RECENT_GAMES);
  const recentMax = recent.reduce((s, m) => s + (typeof m.duration === "number" && m.duration > 0 ? m.duration : DEFAULT_DURATION), 0);
  const playedBy = new Map<string, Set<string>>(); // match id → who played
  const list: Cromo[] = players.map((p) => {
    let played = 0, goals = 0, assists = 0, minutes = 0, starts = 0, saves = 0, mv = 0, recentMin = 0, recentGA = 0;
    games.forEach((m, gi) => {
      const g = playerGame(p.id, m);
      const row = m.ledger?.[p.id];
      if (g.played) {
        played++;
        let set = playedBy.get(m.id);
        if (!set) playedBy.set(m.id, (set = new Set()));
        set.add(p.id);
      }
      goals += g.goals;
      assists += g.assists;
      saves += g.penaltySaved;
      const min = g.minutes ?? (g.played ? (typeof m.duration === "number" ? m.duration : DEFAULT_DURATION) : 0);
      minutes += min;
      if (row?.started) starts++;
      if (mvps.get(m.id)?.includes(p.id)) mv++;
      if (gi >= games.length - recent.length) {
        recentMin += min;
        recentGA += g.ga;
      }
    });
    const baja: Baja | undefined = !p.active ? "Inactivo" : p.injured ? "Lesionado" : suspended.has(p.id) ? "Sancionado" : undefined;
    const rt = formRating({ played, ga: goals + assists, recentMin, recentMax, saves, mvps: mv, games: games.length });
    return {
      id: p.id,
      num: p.number,
      // Printed in capitals, like the cromos of the design (the stored name is left as it is).
      name: (p.shirtName || p.firstName || "Jugador").toLocaleUpperCase("es"),
      pos: normZone(p.naturalPosition),
      rt,
      stats: { played, goals, assists, minutes, starts, mvps: mv },
      recentMin,
      recentGA,
      baja,
      cv: convocatoria?.get(p.id),
    };
  });
  const pairs = new Map<string, PairStats>();
  const bump = (a: string, b: string, k: keyof PairStats, n = 1) => {
    if (a === b) return;
    const key = pairKey(a, b);
    const cur = pairs.get(key) ?? { tog: 0, ast: 0 };
    cur[k] += n;
    pairs.set(key, cur);
  };
  playedBy.forEach((set) => {
    const ids = [...set];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) bump(ids[i], ids[j], "tog");
  });
  goalLinks(games).forEach((l) => bump(l.from, l.to, "ast", l.n));
  const js = recent.map((m) => jornada.get(m.id)).filter((n): n is number => typeof n === "number");
  const recentLabel = js.length ? (js.length === 1 ? `J${js[0]}` : `J${js[0]}–J${js[js.length - 1]}`) : "";
  return { list, byId: new Map(list.map((c) => [c.id, c])), pairs, recentLabel, games: games.length };
}
