// La pizarra «Noche de partido» — el encaje: the exact position of each slot, how well a player fits
// it (positions.fitGrade), and the best seven a squad can put on a system. Pure (no React).
import { systemDef } from "../../../lib/formations";
import { fitGrade, POS_CODES, POSITIONS, type FitGrade, type PosCode } from "../../../lib/positions";
import type { FormationName, Lineup } from "../formations";
import { normZone } from "../positions";
import { planeDist2, slotZone, SYSTEMS } from "./geometry";
import type { Cromo, Squad } from "./model";

const OUTFIELD = POS_CODES.filter((c) => c !== "POR");

/** The slot's exact position: the system's code, or in free mode the nearest catalogue position to
 *  where the slot stands (slot 0 is always the keeper's; an outfield slot never is). */
export function slotCode(L: Lineup, i: number): PosCode {
  if (i === 0) return "POR";
  const s = L.slots[i];
  if (L.freeMode && s) {
    let best: PosCode = OUTFIELD[0];
    let bd = Infinity;
    for (const c of OUTFIELD) {
      const d = planeDist2({ u: s.x, v: s.y }, { u: POSITIONS[c].x, v: POSITIONS[c].y });
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }
  return systemDef(L.formation).spots[i]?.[0] ?? "MC";
}

/** A cromo's grade at a position: his resolved positions, else what his line says (null = no data). */
const gradeOf = (c: Cromo | undefined, code: PosCode): FitGrade | null =>
  c ? fitGrade(c.ps ?? { main: null, also: [], line: c.pos ?? null }, code) : null;

/** How well a player fits slot i of this lineup: 3 preferida · 2 también · 1 adaptado · 0 fuera ·
 *  null sin datos. A per-board «Jugar de» (a line) counts as también on that line and fuera elsewhere.
 *  What is only known as a line is compared with the board's own line for the slot (slotZone: in free
 *  mode its depth bands, which near the middle are not the nearest code's line). */
export function fitAt(L: Lineup, sq: Squad, id: string, i: number): FitGrade | null {
  const zone = slotZone(L, i);
  const over = normZone(L.playerPositions[id]);
  if (over) return over === zone ? 2 : 0;
  const c = sq.byId.get(id);
  if (!c) return null;
  const ps = c.ps ?? { main: null, also: [], line: c.pos ?? null };
  if (!ps.main && !ps.also.length) {
    if (!ps.line) return null;
    return zone !== "POR" && ps.line !== "POR" && ps.line === zone ? 1 : 0;
  }
  return fitGrade(ps, slotCode(L, i));
}

/** The best seven of a squad on a system. */
export interface Encaje {
  /** Slots whose player plays there as preferida or también (grade ≥ 2). */
  inPlace: number;
  /** Per slot: the grade of who is there (null = no data, or nobody). */
  grades: (FitGrade | null)[];
  /** Per slot: who is there (null = nobody). */
  ids: (string | null)[];
  /** The codes of the slots nobody fits (grade < 2, or empty), in slot order, once each. An unknown
   *  fit (no data) is not «missing». */
  missing: PosCode[];
}

const FORBIDDEN = 1e6;

/**
 * Minimum-cost assignment on a square matrix (the Hungarian algorithm, O(n³)): returns, per row, the
 * column it takes. Rows and columns are 0-based; costs must be finite.
 */
export function assign(cost: number[][]): number[] {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[col] = row matched to col (1-based, 0 = none)
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const rowTo = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) rowTo[p[j] - 1] = j - 1;
  return rowTo;
}

/**
 * The best seven `candidates` can put on `system`: maximises Σgrade (no data counts as 1, an empty
 * slot 0), ties broken towards more players in place; the keeper's slot only takes a player with
 * grade ≥ 2 there whenever one of the candidates has it.
 */
export function bestEncaje(system: FormationName, candidates: string[], sq: Squad): Encaje {
  const codes = systemDef(system).spots.map((s) => s[0]);
  const ids = [...new Set(candidates)].filter((id) => sq.byId.has(id));
  const g = codes.map((code) => ids.map((id) => gradeOf(sq.byId.get(id), code)));
  const keeper = g[0]?.some((x) => x != null && x >= 2) ?? false;
  // weight: 8 per grade point (7 slots of +1 never outweigh one point) + 1 when in place
  const weight = (x: FitGrade | null) => 8 * (x ?? 1) + (x != null && x >= 2 ? 1 : 0);
  const n = Math.max(codes.length, ids.length);
  const cost = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      if (r >= codes.length) return 0; // a bench seat
      const x = c < ids.length ? g[r][c] : null;
      if (r === 0 && keeper && (c >= ids.length || x == null || x < 2)) return FORBIDDEN;
      return c < ids.length ? -weight(x) : 0; // an empty slot
    }),
  );
  const rowTo = assign(cost);
  const out: Encaje = { inPlace: 0, grades: [], ids: [], missing: [] };
  codes.forEach((code, r) => {
    const c = rowTo[r];
    const id = c >= 0 && c < ids.length ? ids[c] : null;
    const x = id ? g[r][c] : null;
    out.ids.push(id);
    out.grades.push(x);
    if (x != null && x >= 2) out.inPlace++;
    else if ((!id || x != null) && !out.missing.includes(code)) out.missing.push(code);
  });
  return out;
}

/** How many of the board's own seven are in their place (fitAt ≥ 2: preferida, también or a «Jugar de»
 *  on the slot's line). */
export function boardInPlace(L: Lineup, sq: Squad): number {
  return L.slots.reduce((n, s, i) => {
    const x = s.playerId ? fitAt(L, sq, s.playerId, i) : null;
    return n + (x != null && x >= 2 ? 1 : 0);
  }, 0);
}

/** The best seven of the candidates on every system of the catalogue (for the Sistema tiles). */
export function encajeBySystem(candidates: string[], sq: Squad): Record<FormationName, Encaje> {
  return Object.fromEntries(SYSTEMS.map((k) => [k, bestEncaje(k, candidates, sq)])) as Record<FormationName, Encaje>;
}

/** Someone among the candidates has an exact position (a preferida or a también): only then do the
 *  counts mean anything — a line alone (the old «Defensa») says nobody is «en su sitio». */
export function hasFitData(candidates: string[], sq: Squad): boolean {
  return candidates.some((id) => {
    const ps = sq.byId.get(id)?.ps;
    return !!ps && (!!ps.main || ps.also.length > 0);
  });
}

/** «Falta: un extremo derecho» · «Faltan: un central, un pivote y un punta» («» when nothing is missing). */
export function faltaTxt(missing: PosCode[]): string {
  const names = [...new Set(missing)].map((c) => "un " + POSITIONS[c].name.toLowerCase());
  if (!names.length) return "";
  // (bench's andList, inline: bench → view → encaje would make an import cycle)
  return names.length === 1 ? "Falta: " + names[0] : "Faltan: " + names.slice(0, -1).join(", ") + " y " + names[names.length - 1];
}

/** Who the board can count on: the seven on the pitch and the bench, without bajas or a «no voy». */
export function encajeCandidates(L: Lineup, sq: Squad): string[] {
  const all = [...L.slots.map((s) => s.playerId), ...L.bench].filter((id): id is string => !!id);
  return [...new Set(all)].filter((id) => {
    const c = sq.byId.get(id);
    return !!c && !c.baja && c.cv !== "no";
  });
}
