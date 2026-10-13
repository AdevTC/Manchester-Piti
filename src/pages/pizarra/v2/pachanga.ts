// La pizarra · Bloque 5 — la pachanga: los que han venido, repartidos en 2 (o 3) equipos igualados por
// forma y por puestos, con los porteros fijos (uno por equipo) o la portería por turnos, y «X e Y juntos /
// separados». Deterministic for a seed (a seeded shuffle and a first-improvement search, so «Otro reparto»
// with the next seed gives another split just as even). Pure.
import type { Zone } from "../formations";
import type { Squad } from "./model";

export interface PPlayer {
  id: string;
  name: string;
  /** Form rating (unrated players get the group's median: see pachangaPlayers). */
  rt: number;
  pos?: Zone;
}
export type KeeperMode = "fijos" | "turnos";
export type PairKind = "juntos" | "separados";
export interface Pair {
  a: string;
  b: string;
  kind: PairKind;
}
export interface PachangaInput {
  players: PPlayer[];
  teams: 2 | 3;
  keepers: KeeperMode;
  pairs: Pair[];
  seed: number;
}
export interface Team {
  name: string;
  /** Keeper first, then defenders, midfielders, forwards, the rest; each line by form. */
  ids: string[];
  /** Porteros fijos: the team's keeper (null = it has none: it rotates). */
  keeper: string | null;
  /** Portería por turnos: who goes in goal, in order (empty with a fixed keeper). */
  turns: string[];
  /** Average form, rounded. */
  avg: number;
}
export interface Pachanga {
  teams: Team[];
  /** Points between the best and the worst average. */
  diff: number;
  /** The pairs that could not be honoured (a «separados» inside a «juntos» group, or no room). */
  broken: Pair[];
}

/** Players needed for 2 or 3 teams. */
export const MIN_PLAYERS: Record<2 | 3, number> = { 2: 4, 3: 6 };
/** «Juntos / separados» pairs at most. */
export const PAIRS_MAX = 6;
export const TEAM_NAMES: Record<2 | 3, string[]> = { 2: ["Con peto", "Sin peto"], 3: ["Peto naranja", "Peto amarillo", "Sin peto"] };

/** A small seeded PRNG (mulberry32): the same seed, the same numbers. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with a seeded PRNG (a new array). */
export function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The squad as the pachanga sees it: the available ones (no baja), the unrated with the median form. */
export function pachangaPlayers(sq: Squad): PPlayer[] {
  const list = sq.list.filter((c) => !c.baja);
  const rated = list.filter((c) => !c.unrated).map((c) => c.rt).sort((a, b) => a - b);
  const median = rated.length ? rated[Math.floor((rated.length - 1) / 2)] : 70;
  return list.map((c) => ({ id: c.id, name: c.name, rt: c.unrated ? median : c.rt, ...(c.pos ? { pos: c.pos } : {}) }));
}

const ZONES: Zone[] = ["DEF", "MED", "DEL"];
const LINE: Record<string, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** Union–find over the «juntos» pairs: the groups that go together. */
function groupsOf(ids: string[], pairs: Pair[]): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    parent.set(x, r);
    return r;
  };
  pairs.forEach((p) => {
    if (p.kind === "juntos") parent.set(find(p.a), find(p.b));
  });
  const g = new Map<string, string[]>();
  ids.forEach((id) => {
    const r = find(id);
    g.set(r, [...(g.get(r) ?? []), id]);
  });
  return [...g.values()];
}

/** Split the group into even teams (see the file's header). */
export function makeTeams(inp: PachangaInput): Pachanga {
  const k = inp.teams;
  const r = rng(inp.seed);
  const by = new Map(inp.players.map((p) => [p.id, p]));
  const ids = shuffle(
    inp.players.map((p) => p.id),
    r,
  );
  const n = ids.length;
  const names = TEAM_NAMES[k];
  if (n < MIN_PLAYERS[k]) return { teams: names.map((name) => ({ name, ids: [], keeper: null, turns: [], avg: 0 })), diff: 0, broken: [] };
  const cap = Math.ceil(n / k);
  const meanSize = n / k;
  const broken: Pair[] = [];
  // only pairs of people who came, once each
  const seen = new Set<string>();
  const pairs = inp.pairs.filter((p) => {
    const key = [p.a, p.b].sort().join("|");
    if (p.a === p.b || !by.has(p.a) || !by.has(p.b) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // groups that go together; one too big for a team is split up (its pairs can't be honoured)
  let groups = groupsOf(ids, pairs);
  const tooBig = new Set(groups.filter((g) => g.length > cap).flat());
  if (tooBig.size) {
    pairs.filter((p) => p.kind === "juntos" && tooBig.has(p.a)).forEach((p) => broken.push(p));
    groups = groups.flatMap((g) => (g.length > cap ? g.map((x) => [x]) : [g]));
  }
  const gOf = new Map<string, number>();
  groups.forEach((g, i) => g.forEach((id) => gOf.set(id, i)));
  // «separados» inside one group can't be honoured: «juntos» wins
  const apart = pairs.filter((p) => {
    if (p.kind !== "separados") return false;
    if (gOf.get(p.a) === gOf.get(p.b)) {
      broken.push(p);
      return false;
    }
    return true;
  });

  const keeperOf = (id: string) => by.get(id)?.pos === "POR";
  const keepers = ids.filter(keeperOf).length;
  const cost = (teams: string[][]): number => {
    const sizes = teams.map((t) => t.length);
    const sizeBad = Math.max(0, Math.max(...sizes) - Math.min(...sizes) - 1);
    const str = teams.map((t) => (t.length ? (t.reduce((s, id) => s + (by.get(id)?.rt ?? 0), 0) / t.length) * meanSize : 0));
    const strSpread = Math.max(...str) - Math.min(...str);
    const zoneSpread = ZONES.reduce((s, z) => {
      const c = teams.map((t) => t.filter((id) => by.get(id)?.pos === z).length);
      return s + Math.max(...c) - Math.min(...c);
    }, 0);
    const por = teams.map((t) => t.filter(keeperOf).length);
    const porSpread = keepers ? Math.max(...por) - Math.min(...por) : 0;
    return sizeBad * 10000 + (inp.keepers === "fijos" ? porSpread * 1000 : porSpread * 6) + zoneSpread * 6 + Math.max(0, strSpread - 1);
  };
  const clash = (team: string[], g: string[]): boolean => apart.some((p) => (g.includes(p.a) && team.includes(p.b)) || (g.includes(p.b) && team.includes(p.a)));

  // 1 · greedy: the strongest groups first (seeded order among equals), each where it costs least
  const groupRt = (g: string[]) => g.reduce((s, id) => s + (by.get(id)?.rt ?? 0), 0);
  const order = shuffle(groups, r).sort((a, b) => b.length - a.length || groupRt(b) - groupRt(a));
  const teams: string[][] = Array.from({ length: k }, () => []);
  order.forEach((g) => {
    let best = -1;
    let bestC = Infinity;
    shuffle(
      teams.map((_, i) => i),
      r,
    ).forEach((i) => {
      if (teams[i].length + g.length > cap || clash(teams[i], g)) return;
      const trial = teams.map((t, j) => (j === i ? [...t, ...g] : t));
      const c = cost(trial) + teams[i].length * 0.001;
      if (c < bestC) {
        bestC = c;
        best = i;
      }
    });
    if (best < 0) {
      // no team without a «separados» clash: the one with most room, and the clash is reported
      best = teams.reduce((bi, t, i) => (t.length < teams[bi].length ? i : bi), 0);
      apart.filter((p) => (g.includes(p.a) && teams[best].includes(p.b)) || (g.includes(p.b) && teams[best].includes(p.a))).forEach((p) => broken.push(p));
    }
    teams[best].push(...g);
  });

  // 2 · improve: move one group or swap two between teams while it gets more even (seeded order)
  const groupIn = (t: string[]) => groups.filter((g) => t.includes(g[0]));
  // (the sizes are the cost's to keep even; a «separados» already reported broken no longer binds)
  const valid = (ts: string[][]) => apart.every((p) => broken.includes(p) || !ts.some((t) => t.includes(p.a) && t.includes(p.b)));
  let cur = cost(teams);
  for (let pass = 0; pass < 40; pass++) {
    let improved = false;
    for (const i of shuffle([...Array(k).keys()], r)) {
      for (const j of shuffle([...Array(k).keys()], r)) {
        if (i === j) continue;
        for (const ga of shuffle(groupIn(teams[i]), r)) {
          // a move
          const moved = teams.map((t, x) => (x === i ? t.filter((id) => !ga.includes(id)) : x === j ? [...t, ...ga] : t));
          if (valid(moved) && cost(moved) < cur - 1e-9) {
            teams.splice(0, k, ...moved);
            cur = cost(teams);
            improved = true;
            break;
          }
          // a swap
          let swapped = false;
          for (const gb of shuffle(groupIn(teams[j]), r)) {
            const sw = teams.map((t, x) => (x === i ? [...t.filter((id) => !ga.includes(id)), ...gb] : x === j ? [...t.filter((id) => !gb.includes(id)), ...ga] : t));
            if (valid(sw) && cost(sw) < cur - 1e-9) {
              teams.splice(0, k, ...sw);
              cur = cost(teams);
              improved = swapped = true;
              break;
            }
          }
          if (swapped) break;
        }
      }
    }
    if (!improved) break;
  }

  const rt = (id: string) => by.get(id)?.rt ?? 0;
  const out: Team[] = teams.map((t, i) => {
    const keeper = inp.keepers === "fijos" ? (t.filter(keeperOf).sort((a, b) => rt(b) - rt(a))[0] ?? null) : null;
    const sorted = t.slice().sort((a, b) => (a === keeper ? -1 : b === keeper ? 1 : (LINE[by.get(a)?.pos ?? ""] ?? 4) - (LINE[by.get(b)?.pos ?? ""] ?? 4) || rt(b) - rt(a)));
    return {
      name: names[i],
      ids: sorted,
      keeper,
      turns: keeper ? [] : shuffle(sorted, r),
      avg: t.length ? Math.round(t.reduce((s, id) => s + rt(id), 0) / t.length) : 0,
    };
  });
  const avgs = out.map((t) => t.avg);
  return { teams: out, diff: Math.max(...avgs) - Math.min(...avgs), broken };
}

/** The split as text for the group (WhatsApp): a line per team, its keeper or the turns in goal. */
export function pachangaText(p: Pachanga, name: (id: string) => string, when = ""): string {
  const head = "Pachanga" + (when ? " · " + when : "") + " · " + p.teams.reduce((s, t) => s + t.ids.length, 0) + " jugadores";
  const lines = p.teams.map((t) => {
    const who = t.ids.map((id) => name(id) + (id === t.keeper ? " (portero)" : "")).join(", ");
    const turns = t.turns.length ? "\nPortería por turnos: " + t.turns.map(name).join(" › ") : "";
    return t.name.toUpperCase() + " (media " + t.avg + "): " + who + turns;
  });
  return [head, ...lines].join("\n\n");
}

/** What the announcer says of a split. */
export function pachangaSay(p: Pachanga): string {
  const sizes = p.teams.map((t) => t.ids.length).join(" contra ");
  return "Equipos hechos: " + sizes + (p.diff ? ", " + p.diff + (p.diff === 1 ? " punto" : " puntos") + " de media entre ellos" : ", misma media") + (p.broken.length ? ". Alguna condición no se ha podido cumplir" : "");
}
