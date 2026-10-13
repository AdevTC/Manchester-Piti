// La pizarra «Noche de partido» — el encaje: the exact position of each slot, how well a player fits
// it (positions.fitGrade), and the best seven a squad can put on a system. Pure (no React).
import { systemDef } from "../../../lib/formations";
import { fitGrade, isPosCode, LINE_NAMES, POS_CODES, POSITIONS, type FitGrade, type PosCode } from "../../../lib/positions";
import type { FormationName, Lineup } from "../formations";
import { normPlaysAs } from "../positions";
import { planeDist2, slotZone, SYSTEMS } from "./geometry";
import type { Cromo, Squad } from "./model";

const OUTFIELD = POS_CODES.filter((c) => c !== "POR");

/** The slot's exact position: the system's code, or in free mode the nearest catalogue position to
 *  where the slot stands among those of the board's own line for it (slotZone's depth bands), so the
 *  printed code, the fit and the line logic agree (slot 0 is always the keeper's; an outfield slot never is). */
export function slotCode(L: Lineup, i: number): PosCode {
  if (i === 0) return "POR";
  const s = L.slots[i];
  if (L.freeMode && s) {
    const line = slotZone(L, i);
    const codes = OUTFIELD.filter((c) => POSITIONS[c].line === line);
    let best: PosCode = codes[0] ?? OUTFIELD[0];
    let bd = Infinity;
    for (const c of codes) {
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

const resolved = (c: Cromo) => c.ps ?? { main: null, also: [], line: c.pos ?? null };
const exactOf = (c: Cromo | undefined): boolean => !!c?.ps && (!!c.ps.main || c.ps.also.length > 0);

/** A cromo's grade at a position, with no board: `shown` as his cromo shows it (shownFit) — a line
 *  alone gives no grade on its line —; `logic` as the board's logic counts it (logicGrade) — a line
 *  alone is 3 on its line (a POR line in goal too) and 0 off it; null = no data. */
function gradeOf(c: Cromo | undefined, code: PosCode): { shown: FitGrade | null; logic: FitGrade | null } {
  if (!c) return { shown: null, logic: null };
  const raw = fitGrade(resolved(c), code);
  const known = raw == null || raw === 0 || exactOf(c);
  return { shown: known ? raw : null, logic: known ? raw : 3 };
}

/** How well a player fits slot i of this lineup: 3 preferida · 2 también · 1 adaptado · 0 fuera ·
 *  null sin datos. A per-board «Jugar de» by code is también at that code and, elsewhere, judged as if
 *  it were his only position (his line or a neighbour adapted, else fuera); a legacy «Jugar de» line
 *  counts as también on that line and fuera elsewhere.
 *  What is only known as a line is compared with the board's own line for the slot (slotZone: in free
 *  mode its depth bands, which near the middle are not the nearest code's line). */
export function fitAt(L: Lineup, sq: Squad, id: string, i: number): FitGrade | null {
  const zone = slotZone(L, i);
  const over = normPlaysAs(L.playerPositions[id]);
  if (over && isPosCode(over)) {
    const code = slotCode(L, i);
    return over === code ? 2 : fitGrade({ main: over, also: [] }, code);
  }
  if (over) return over === zone ? 2 : 0;
  const c = sq.byId.get(id);
  if (!c) return null;
  const ps = resolved(c);
  if (!ps.main && !ps.also.length) {
    if (!ps.line) return null;
    if (zone === "POR") return ps.line === "POR" ? 2 : 0;
    return ps.line !== "POR" && ps.line === zone ? 1 : 0;
  }
  return fitGrade(ps, slotCode(L, i));
}

/** A player's fit at slot i as the board shows it (the cromo's mark, the hand's tints, «Fuera de
 *  posición»): a grade only from what is known exactly (his positions or a per-board «Jugar de»); a
 *  line alone only ever says «fuera». */
export function shownFit(L: Lineup, sq: Squad, id: string, i: number): FitGrade | null {
  const g = fitAt(L, sq, id, i);
  if (g == null || g === 0) return g;
  return normPlaysAs(L.playerPositions[id]) || exactOf(sq.byId.get(id)) ? g : null;
}

/** The grade the board's logic reasons with (química, diamonds, «siete listo»), consistent with the
 *  cromo: exact data (his positions, or a per-board «Jugar de») → fitAt's grade; a line alone → 3 on
 *  his line (slotZone) and 0 off it (a POR line in goal is 3); no data → null (unknown: never
 *  rewarded, never penalised). For a squad known only by lines this is exactly the old natural/fits. */
export function logicGrade(L: Lineup, sq: Squad, id: string, i: number): FitGrade | null {
  const c = sq.byId.get(id);
  if (normPlaysAs(L.playerPositions[id]) || exactOf(c)) return fitAt(L, sq, id, i);
  const line = c ? resolved(c).line : null;
  if (!line) return null;
  return line === slotZone(L, i) ? 3 : 0;
}

/** In his place: preferida or también (or a line alone on its line). Unknown is not. */
export const inPlace = (g: FitGrade | null): boolean => g != null && g >= 2;
/** Adapted: his line or a neighbouring position. */
export const adapted = (g: FitGrade | null): boolean => g === 1;
/** Out of his place. Unknown is not. */
export const out = (g: FitGrade | null): boolean => g === 0;

/** A grade in a sentence's words: «en su sitio» (preferida or también) · «adaptado» · «fuera de su
 *  sitio»; «» when unknown. */
export const fitWord = (g: FitGrade | null): string => (inPlace(g) ? "en su sitio" : adapted(g) ? "adaptado" : out(g) ? "fuera de su sitio" : "");

/** The slot's exact position by name, lower-case for a sentence («interior izquierdo»). */
export const slotName = (L: Lineup, i: number): string => POSITIONS[slotCode(L, i)].name.toLowerCase();

/** Where a player is at home, lower-cased for a sentence: a per-board «Jugar de» (a code or a line),
 *  his preferida, his first también, else his line («punta», «interior izquierdo», «defensa»); null
 *  without data. */
export function homeName(L: Lineup, sq: Squad, id: string): string | null {
  const over = normPlaysAs(L.playerPositions[id]);
  if (over) return (isPosCode(over) ? POSITIONS[over].name : LINE_NAMES[over].name).toLowerCase();
  const c = sq.byId.get(id);
  if (!c) return null;
  const ps = resolved(c);
  const code = ps.main ?? ps.also[0];
  if (code) return POSITIONS[code].name.toLowerCase();
  return ps.line ? LINE_NAMES[ps.line].name.toLowerCase() : null;
}

/** The best seven of a squad on a system. */
export interface Encaje {
  /** Slots whose player is in his place (logicGrade ≥ 2: preferida, también, or a line alone on its
   *  line — the química's «en su sitio»). */
  inPlace: number;
  /** Per slot: the grade of who is there as his cromo shows it (shownFit; null = no data, a line
   *  alone on its line, or nobody). */
  grades: (FitGrade | null)[];
  /** Per slot: who is there (null = nobody). */
  ids: (string | null)[];
  /** The codes of the slots nobody fits (not in place, or empty), in slot order, once each. An unknown
   *  fit (no data) is not «missing». */
  missing: PosCode[];
}

// (a forbidden placement's cost: it must stay far above 7 × the heaviest allowed weight of any caller —
// «Sugerir siete» with the convocatoria's own reaches < 1e4 a slot, 7 × that < 1e6 — or the assignment
// could prefer it)
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
 * The best seven `candidates` can put on `system`: first as many in their place as possible (as the
 * board's logic counts it, logicGrade: a line alone on its line is in place), then the most Σgrade (no
 * grade counts as 1, an empty slot 0); the keeper's slot only takes a player in his place there
 * whenever one of the candidates is. Grades are reported as the cromos show them (shownFit): a player
 * known only by his line has none on his line (no tint, yet counted in place) and is 0 off it.
 */
export function bestEncaje(system: FormationName, candidates: string[], sq: Squad): Encaje {
  const codes = systemDef(system).spots.map((s) => s[0]);
  const ids = [...new Set(candidates)].filter((id) => sq.byId.has(id));
  const g = codes.map((code) => ids.map((id) => gradeOf(sq.byId.get(id), code)));
  const keeper = g[0]?.some((x) => inPlace(x.logic)) ?? false;
  // weight: 100 when in place (7 slots of ≤ 3 points never outweigh one more in place) + the grade
  const weight = (x: FitGrade | null) => 100 * (inPlace(x) ? 1 : 0) + (x ?? 1);
  const n = Math.max(codes.length, ids.length);
  const cost = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      if (r >= codes.length) return 0; // a bench seat
      const x = c < ids.length ? g[r][c] : null;
      if (r === 0 && keeper && !inPlace(x?.logic ?? null)) return FORBIDDEN;
      return x ? -weight(x.logic) : 0; // an empty slot
    }),
  );
  const rowTo = assign(cost);
  const out: Encaje = { inPlace: 0, grades: [], ids: [], missing: [] };
  codes.forEach((code, r) => {
    const c = rowTo[r];
    const id = c >= 0 && c < ids.length ? ids[c] : null;
    const x = id ? g[r][c] : null;
    out.ids.push(id);
    out.grades.push(x ? x.shown : null);
    if (inPlace(x?.logic ?? null)) out.inPlace++;
    else if ((!id || x?.logic != null) && !out.missing.includes(code)) out.missing.push(code);
  });
  return out;
}

/**
 * The max-weight placement of `ids` on `slots` slots (each slot at most one player, each player at most
 * once): `weight(i, id)` is what having him in slot i is worth, null = he may not take it. Give every
 * allowed placement a positive weight to have every slot filled while there are players. Per slot: who.
 */
export function placeByWeight(slots: number, ids: readonly string[], weight: (i: number, id: string) => number | null): (string | null)[] {
  const w = Array.from({ length: slots }, (_, r) => ids.map((id) => weight(r, id)));
  const n = Math.max(slots, ids.length);
  const cost = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      if (r >= slots || c >= ids.length) return 0; // a bench seat, or an empty slot
      const x = w[r][c];
      return x == null ? FORBIDDEN : -x;
    }),
  );
  const rowTo = assign(cost);
  return Array.from({ length: slots }, (_, r) => {
    const c = rowTo[r];
    return c >= 0 && c < ids.length && w[r][c] != null ? ids[c] : null;
  });
}

/** How many of the board's own seven are in their place (inPlace(logicGrade): preferida, también or a
 *  «Jugar de» at the slot's code, a legacy one on the slot's line, or a line alone on its line) — the
 *  same count as the química's «en su sitio» and Comparar's. */
export function boardInPlace(L: Lineup, sq: Squad): number {
  return L.slots.reduce((n, s, i) => n + (s.playerId && inPlace(logicGrade(L, sq, s.playerId, i)) ? 1 : 0), 0);
}

/** The best seven of the candidates on every system of the catalogue (for the Sistema tiles). */
export function encajeBySystem(candidates: string[], sq: Squad): Record<FormationName, Encaje> {
  return Object.fromEntries(SYSTEMS.map((k) => [k, bestEncaje(k, candidates, sq)])) as Record<FormationName, Encaje>;
}

/** Someone among the candidates has an exact OUTFIELD position (a preferida or a también): only then
 *  do the counts mean anything — a line alone (the old «Defensa») says nobody is «en su sitio», and a
 *  keeper's POR alone is what every old «Portero» parses to. With the board `L`, an outfield «Jugar
 *  de» by code on it counts too (the captain said exactly where he plays). */
export function hasFitData(candidates: string[], sq: Squad, L?: Lineup): boolean {
  return candidates.some((id) => {
    const over = L ? normPlaysAs(L.playerPositions[id]) : undefined;
    if (over && isPosCode(over) && over !== "POR") return true;
    const ps = sq.byId.get(id)?.ps;
    return !!ps && ((!!ps.main && ps.main !== "POR") || ps.also.length > 0);
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
