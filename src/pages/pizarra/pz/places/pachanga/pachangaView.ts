// r14 «La pizarra» · Pachanga: the pure part (PiPachanga.dc.html's helpers). Who came, the deal into 2 or 3 teams
// (the app's v2/pachanga makeTeams: even by GLOBAL and by lines, pairs «juntos / separados», keepers; plus the
// prototype's «fijo»: a locked player stays in his team), the balance, the keepers (fixed or by turns), the pitch
// layout (a keeper and two lines per half) and the text for the group. No store, no React: tested on its own.
import { makeTeams, MIN_PLAYERS, type Pair, type PairKind, type PPlayer } from "../../../v2/pachanga";
import type { Line } from "../../../../../lib/positions";

export type { Pair, PairKind };
export type PgN = 2 | 3;
export type PgSrc = "entreno" | "guardado" | "partido" | "todos" | "nadie" | "mano";
export type PgPat = "rayas" | "malla" | "liso";

/** Someone from outside the squad: a member without a ficha who said «voy» to the training, or typed in here. */
export interface PgGuest {
  id: string;
  name: string;
  /** Typed in here («Alguien de fuera»), not from the training's answers. */
  mine: boolean;
}

export interface PgState {
  /** The training these teams are for (null: none confirmed: marked by hand). */
  trainingId: string | null;
  /** Who came was already filled from the training (or the saved attendance): later answers don't overwrite. */
  seeded: boolean;
  comes: string[];
  src: PgSrc;
  n: PgN;
  gk: "turnos" | "fijos";
  /** Porteros fijos: the chosen keeper of each team (null = the team's own POR, else its first). */
  keepers: (string | null)[];
  pairs: Pair[];
  /** «Fijo»: the team a player stays in when Mezclar re-deals. */
  locked: Record<string, number>;
  seed: number;
  teams: string[][];
  unmet: string[];
  /** Portería por turnos: whose turn it is (each team's keeper is its order[turn % size]). */
  turn: number;
  /** With 3 teams: the two that play now (the third waits). */
  playing: [number, number];
  guests: PgGuest[];
  fmt: "post" | "historia";
}

export const PG_NAMES: Record<PgN, string[]> = { 2: ["Con petos", "Sin petos"], 3: ["Petos naranjas", "Petos amarillos", "Sin petos"] };
export const PG_SHORT: Record<PgN, string[]> = { 2: ["Con", "Sin"], 3: ["Naranjas", "Amarillos", "Sin"] };
export const PG_PATS: Record<PgN, PgPat[]> = { 2: ["rayas", "liso"], 3: ["rayas", "malla", "liso"] };
export const PAIRS_MAX = 6;
export const LSHORT: Record<string, string> = { POR: "Portero", DEF: "Defensa", MED: "Medio", DEL: "Delantero" };
const LORD: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** What the pachanga needs to know of a person (a squad player or a guest). */
export interface PgWho {
  id: string;
  shirt: string;
  num: number | null;
  line: Line | null;
  /** GLOBAL (La carta's number); null = no nota yet (counts as the median of who came). */
  global: number | null;
  guest: boolean;
  mine: boolean;
}
export type WhoFn = (id: string) => PgWho;

export const emptyPg = (): PgState => ({ trainingId: null, seeded: false, comes: [], src: "mano", n: 2, gk: "turnos", keepers: [], pairs: [], locked: {}, seed: 1, teams: [], unmet: [], turn: 0, playing: [0, 1], guests: [], fmt: "post" });

export const guestId = (name: string): string =>
  "g:" +
  (name
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "x");
export const isGuestId = (id: string): boolean => id.startsWith("g:");

/** The median GLOBAL of these people (62 when nobody has one). */
export function medianOf(who: WhoFn, ids: readonly string[]): number {
  const xs = ids
    .map((id) => who(id).global)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (!xs.length) return 62;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : Math.round((xs[m - 1] + xs[m]) / 2);
}

/** «X y Y separados / juntos» the deal could not honour. */
export function unmetOf(who: WhoFn, st: Pick<PgState, "pairs" | "comes">, T: string[][]): string[] {
  const u: string[] = [];
  st.pairs.forEach((p) => {
    if (!st.comes.includes(p.a) || !st.comes.includes(p.b)) return;
    const ta = T.findIndex((t) => t.includes(p.a));
    const tb = T.findIndex((t) => t.includes(p.b));
    if (ta < 0 || tb < 0) return;
    if (p.kind === "separados" && ta === tb) u.push(`${who(p.a).shirt} y ${who(p.b).shirt} separados`);
    if (p.kind === "juntos" && ta !== tb) u.push(`${who(p.a).shirt} y ${who(p.b).shirt} juntos`);
  });
  return u;
}

/** The deal: v2's makeTeams (even by GLOBAL and lines, pairs, keepers; seeded) and then each «fijo» back in his team
 *  (swapped with the free player of that team whose GLOBAL is closest, so the balance barely moves). Fewer than
 *  2 × n who came: no teams. */
export function deal(who: WhoFn, st: PgState): { teams: string[][]; unmet: string[] } {
  const n = st.n;
  if (st.comes.length < MIN_PLAYERS[n]) return { teams: [], unmet: [] };
  const med = medianOf(who, st.comes);
  const players: PPlayer[] = st.comes.map((id) => {
    const w = who(id);
    return { id, name: w.shirt, rt: w.global ?? med, ...(w.line ? { pos: w.line } : {}) };
  });
  const res = makeTeams({ players, teams: n, keepers: st.gk, pairs: st.pairs, seed: st.seed });
  const T = res.teams.map((t) => t.ids.slice());
  const lockTo: Record<string, number> = {};
  Object.entries(st.locked).forEach(([id, t]) => {
    if (st.comes.includes(id) && t < n) lockTo[id] = t;
  });
  if (st.gk === "fijos")
    st.keepers.slice(0, n).forEach((id, k) => {
      if (id && st.comes.includes(id) && lockTo[id] == null) lockTo[id] = k;
    });
  const rt = (id: string) => who(id).global ?? med;
  Object.entries(lockTo).forEach(([id, to]) => {
    const from = T.findIndex((t) => t.includes(id));
    if (from < 0 || from === to) return;
    const free = T[to].filter((x) => lockTo[x] == null || lockTo[x] === from);
    if (!free.length) {
      // nobody to swap: he just moves (the sizes may differ by one more)
      T[from] = T[from].filter((x) => x !== id);
      T[to].push(id);
      return;
    }
    const back = free.slice().sort((a, b) => Math.abs(rt(a) - rt(id)) - Math.abs(rt(b) - rt(id)))[0];
    T[from] = T[from].map((x) => (x === id ? back : x));
    T[to] = T[to].map((x) => (x === back ? id : x));
  });
  return { teams: T, unmet: unmetOf(who, st, T) };
}

export const ready = (st: Pick<PgState, "teams" | "n">): boolean => st.teams.length === st.n && st.teams.every((t) => t.length > 0);

export interface TeamStat {
  n: number;
  mean: number;
  media: number;
}
export function teamStats(who: WhoFn, st: Pick<PgState, "teams" | "comes">): TeamStat[] {
  const all = st.teams.flat();
  const med = medianOf(who, all.length ? all : st.comes);
  return st.teams.map((team) => {
    const vs = team.map((id) => who(id).global ?? med);
    const mean = vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : 0;
    return { n: team.length, mean, media: Math.round(mean) };
  });
}
/** Points between the best and the worst rounded media. */
export function spreadOf(stats: TeamStat[]): number {
  const ms = stats.map((x) => x.media);
  return ms.length ? Math.max(...ms) - Math.min(...ms) : 0;
}
export function balanceWord(spread: number): { word: string; head: string; tone: "is-ok" | "is-guest" | "is-warn"; icon: string } {
  if (spread <= 1) return { word: "Parejos", head: "Equipos parejos", tone: "is-ok", icon: "check" };
  if (spread <= 3) return { word: "Casi parejos", head: "Casi parejos", tone: "is-guest", icon: "swap" };
  return { word: "Descompensados", head: "Descompensados", tone: "is-warn", icon: "warn" };
}

const lineRank = (who: WhoFn, id: string, none: number) => {
  const l = who(id).line;
  return l && LORD[l] != null ? LORD[l] : none;
};
/** Portería por turnos: who goes in goal, in order (the keepers of trade first, then the back to the front). */
export function gkOrder(who: WhoFn, st: Pick<PgState, "teams">, t: number): string[] {
  const team = st.teams[t] ?? [];
  return team.slice().sort((a, b) => lineRank(who, a, 2.5) - lineRank(who, b, 2.5) || (who(a).global ?? 0) - (who(b).global ?? 0) || a.localeCompare(b));
}
/** The team's keeper now: the chosen one (fijos), its POR, its first; or whose turn it is. */
export function keeperOf(who: WhoFn, st: Pick<PgState, "teams" | "gk" | "keepers" | "turn">, t: number): string | null {
  const team = st.teams[t] ?? [];
  if (!team.length) return null;
  if (st.gk === "fijos") {
    const k = st.keepers[t];
    if (k && team.includes(k)) return k;
    return team.find((id) => who(id).line === "POR") ?? team[0];
  }
  const order = gkOrder(who, st, t);
  return order[(st.turn || 0) % order.length];
}
/** The keeper first, then by line (back to front), each line best first. */
export function orderTeam(who: WhoFn, st: Pick<PgState, "teams" | "gk" | "keepers" | "turn">, t: number): string[] {
  const k = keeperOf(who, st, t);
  const rest = (st.teams[t] ?? []).filter((id) => id !== k);
  rest.sort((a, b) => lineRank(who, a, 2) - lineRank(who, b, 2) || (who(b).global ?? 0) - (who(a).global ?? 0) || a.localeCompare(b));
  return (k ? [k] : []).concat(rest);
}

/* a half holds a keeper and two rows of shirts; row 1 keeps the centre free for the keeper's plate */
const R1: Record<number, number[]> = { 1: [50], 2: [30, 70], 3: [30, 70], 4: [22, 78], 5: [30, 70], 6: [13, 37, 63, 87], 7: [13, 37, 63, 87], 8: [13, 37, 63, 87] };
const R2: Record<number, number[]> = { 1: [], 2: [], 3: [50], 4: [38, 62], 5: [19, 50, 81], 6: [30, 70], 7: [19, 50, 81], 8: [13, 37, 63, 87] };
/** Where each shirt of a team stands (keeper first), x/y 0–100; `top` = the half by their goal. */
export function spots(count: number, top: boolean): [number, number][] {
  const pts: [number, number][] = [];
  if (!count) return pts;
  pts.push([50, top ? 9.5 : 90.5]);
  const f = count - 1;
  const y1 = top ? 25.5 : 74.5;
  const y2 = top ? 41.5 : 58.5;
  let r1 = R1[f] ?? [];
  let r2 = R2[f] ?? [];
  if (f > 8) {
    r1 = [13, 37, 63, 87];
    const k = f - 4;
    r2 = Array.from({ length: k }, (_, i) => Math.round(((i + 1) * 100) / (k + 1)));
  }
  r1.forEach((x) => pts.push([x, y1]));
  r2.forEach((x) => pts.push([x, y2]));
  return pts;
}

// ── the changes (each returns the new state; the place wraps them in an undoable slice.set) ──────────────

/** Re-deal with the next seed (locks, pairs and keepers kept). */
export function mezclar(who: WhoFn, s: PgState): PgState {
  const next = { ...s, seed: (s.seed || 1) + 1 };
  return { ...next, ...deal(who, next) };
}
/** Replace who came (from the training, the match, everybody, nobody) and deal. */
export function setComes(who: WhoFn, s: PgState, ids: string[], src: PgSrc): PgState {
  const next = { ...s, comes: [...new Set(ids)], src, locked: {} };
  return { ...next, ...deal(who, next) };
}
/** Into the team that needs him most (fewest, then the weakest). */
function addToTeams(who: WhoFn, s: PgState, id: string): string[][] {
  const stats = teamStats(who, s);
  let best = 0;
  stats.forEach((x, i) => {
    if (x.n < stats[best].n || (x.n === stats[best].n && x.mean < stats[best].mean)) best = i;
  });
  return s.teams.map((t, i) => (i === best ? [...t, id] : t));
}
/** He came / he didn't: the teams keep their shape (a newcomer joins the team that needs him; a gap is evened). */
export function tick(who: WhoFn, s: PgState, id: string): PgState {
  const on = s.comes.includes(id);
  let next: PgState = { ...s, src: "mano" };
  if (on) {
    const locked = { ...s.locked };
    delete locked[id];
    next = { ...next, comes: s.comes.filter((x) => x !== id), teams: s.teams.map((t) => t.filter((x) => x !== id)), locked };
  } else {
    next = { ...next, comes: [...s.comes, id] };
    if (ready(s)) next.teams = addToTeams(who, next, id);
    else if (next.comes.length >= MIN_PLAYERS[s.n]) next = { ...next, ...deal(who, next) };
  }
  if (next.comes.length < MIN_PLAYERS[s.n]) next.teams = [];
  else if (next.teams.length) {
    const sizes = next.teams.map((t, i) => [t.length, i] as const).sort((a, b) => b[0] - a[0]);
    const big = sizes[0];
    const small = sizes[sizes.length - 1];
    if (big[0] - small[0] > 1) {
      const from = next.teams[big[1]];
      const mv = from.filter((x) => next.locked[x] == null).slice(-1)[0];
      if (mv) next.teams = next.teams.map((t, i) => (i === big[1] ? t.filter((x) => x !== mv) : i === small[1] ? [...t, mv] : t));
    }
    if (!ready(next)) next = { ...next, ...deal(who, next) };
  }
  return { ...next, unmet: unmetOf(who, next, next.teams) };
}
/** Someone from outside joins (and came). */
export function addGuest(who: WhoFn, s: PgState, name: string): PgState {
  const t = name.trim().slice(0, 40);
  if (!t) return s;
  let id = guestId(t);
  let k = 2;
  while (s.guests.some((g) => g.id === id)) id = guestId(t) + "-" + k++;
  const guests = [...s.guests, { id, name: t, mine: true }];
  return tick(who, { ...s, guests }, id);
}
export function swap(who: WhoFn, s: PgState, a: string, b: string): PgState {
  const teams = s.teams.map((t) => t.map((x) => (x === a ? b : x === b ? a : x)));
  const locked = { ...s.locked };
  if (locked[a] != null) locked[a] = teams.findIndex((t) => t.includes(a));
  if (locked[b] != null) locked[b] = teams.findIndex((t) => t.includes(b));
  return { ...s, teams, locked, unmet: unmetOf(who, s, teams) };
}
export function move(who: WhoFn, s: PgState, id: string, to: number): PgState {
  const teams = s.teams.map((t, i) => (i === to ? [...t.filter((x) => x !== id), id] : t.filter((x) => x !== id)));
  const locked = { ...s.locked };
  if (locked[id] != null) locked[id] = to;
  return { ...s, teams, locked, unmet: unmetOf(who, s, teams) };
}
export function toggleLock(s: PgState, id: string): PgState {
  const t = s.teams.findIndex((x) => x.includes(id));
  const locked = { ...s.locked };
  if (locked[id] != null) delete locked[id];
  else if (t >= 0) locked[id] = t;
  return { ...s, locked };
}
export function setN(who: WhoFn, s: PgState, n: PgN): PgState {
  const next: PgState = { ...s, n, locked: {}, playing: [0, 1], turn: 0, keepers: [] };
  return { ...next, ...deal(who, next) };
}
export function setGk(who: WhoFn, s: PgState, mode: "turnos" | "fijos"): PgState {
  if (mode === "fijos") return { ...s, gk: mode, keepers: s.teams.map((_, i) => keeperOf(who, { ...s, gk: "turnos" }, i)) };
  return { ...s, gk: mode };
}
export function setKeeper(s: PgState, t: number, id: string): PgState {
  const keepers = s.keepers.slice();
  keepers[t] = id;
  return { ...s, keepers };
}
export function rotate(s: PgState): PgState {
  if (s.n !== 3) return s;
  const wait = [0, 1, 2].find((t) => !s.playing.includes(t)) ?? 2;
  return { ...s, playing: [s.playing[1], wait] };
}
export const waiting = (s: Pick<PgState, "n" | "playing">): number => (s.n === 3 ? ([0, 1, 2].find((t) => !s.playing.includes(t)) ?? 2) : -1);
export function addPair(who: WhoFn, s: PgState, a: string, b: string, kind: PairKind): PgState {
  const pairs = [...s.pairs.filter((p) => !((p.a === a && p.b === b) || (p.a === b && p.b === a))), { a, b, kind }].slice(-PAIRS_MAX);
  const next = { ...s, pairs };
  return { ...next, ...deal(who, next) };
}
export function removePair(who: WhoFn, s: PgState, i: number): PgState {
  const next = { ...s, pairs: s.pairs.filter((_, k) => k !== i) };
  return { ...next, unmet: unmetOf(who, next, next.teams) };
}

/** The teams written for the group (WhatsApp, the clipboard): a line per team, its keeper marked. */
export function pachangaText(who: WhoFn, s: PgState, head: string): string {
  if (!ready(s)) return head;
  const names = PG_NAMES[s.n];
  const stats = teamStats(who, s);
  const lines = s.teams.map((_, t) => {
    const k = keeperOf(who, s, t);
    return `${names[t]} (media ${stats[t].media}): ` + orderTeam(who, s, t).map((id) => who(id).shirt + (id === k ? " (portero)" : "")).join(", ");
  });
  return [head, ...lines, s.gk === "turnos" ? "Portería por turnos de 10′." : "Porteros fijos."].join("\n");
}
