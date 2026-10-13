// La pizarra «Noche de partido» — every change the board makes to a lineup, as pure functions over the
// stored Lineup (formations.ts) built on lineupOps. No React. The design's slot table (geometry.ts FORM)
// places the cromos; free mode keeps each slot's own spot in slots[i].x/y.
import { applyFormation, type FormationName, type Lineup, type RoleKey, type Zone } from "../formations";
import { placeIntoSlot, sendToBench, swapPlayers, XI } from "../lineupOps";
import { defaultTactics } from "../tactics";
import { DEF_LINE_VALUES, planeDist2, slotPos, slotZone, SYSTEMS } from "./geometry";
import { hasFitData, inPlace, logicGrade, placeByWeight } from "./encaje";
import { isAvailable, natOf, type Squad } from "./model";
import { knownTakers, ROLE_TAKER, rolesFor, syncRoles, takersOf, toggleFirst } from "./takers";
import { tacticaSig } from "./tacticaData";

const cloneSlots = (L: Lineup) => L.slots.map((s) => ({ ...s }));

// ── the galones belong to the seven: whoever leaves the pitch leaves his galones (the dead-ball ones
// pass to the next of their list on the pitch, see takers.ts) ──
const ROLE_KEYS: RoleKey[] = ["captainId", "penaltiesId", "freekicksId", "cornersId"];
/** «la capitanía», «los penaltis»… (for «X deja la capitanía»). */
const ROLE_WORD: Record<Exclude<RoleKey, "viceId">, string> = { captainId: "la capitanía", penaltiesId: "los penaltis", freekicksId: "las faltas", cornersId: "los córners" };
/** The lineup with only the galones of those on the pitch (the same object when nothing changes). */
export const dropBenchedRoles = (L: Lineup): Lineup => syncRoles(L);
/** What a change took off the pitch's galones: «KEVIN deja la capitanía y los penaltis» (null = nothing). */
export function rolesLost(before: Lineup, after: Lineup, name: (id: string) => string): string | null {
  const by = new Map<string, string[]>();
  ROLE_KEYS.forEach((k) => {
    const h = before.roles[k];
    // (only who wore it on the pitch: a stale galón of someone already on the bench says nothing)
    if (k !== "viceId" && h && after.roles[k] !== h && before.slots.some((s) => s.playerId === h) && !after.slots.some((s) => s.playerId === h)) by.set(h, [...(by.get(h) ?? []), ROLE_WORD[k]]);
  });
  if (!by.size) return null;
  const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);
  return Array.from(by, ([id, ws]) => name(id) + " deja " + and(ws)).join(" · ");
}

/** Make a stored lineup safe to edit: seven slots of its system, every player known and only once,
 *  and the bench = the rest of the squad. */
export function normalize(L: Lineup, squadIds: string[]): Lineup {
  const known = new Set(squadIds);
  let slots = L.slots.length === XI ? cloneSlots(L) : applyFormation(L.slots, L.formation);
  const seen = new Set<string>();
  slots = slots.map((s) => {
    const id = s.playerId;
    if (!id || (known.size && !known.has(id)) || seen.has(id)) return { ...s, playerId: null };
    seen.add(id);
    return s;
  });
  const onPitch = new Set(slots.map((s) => s.playerId).filter((x): x is string => !!x));
  const vice = L.roles.viceId && (!known.size || known.has(L.roles.viceId)) ? L.roles.viceId : undefined;
  const base = { ...L.roles, viceId: vice };
  if (!vice) delete base.viceId;
  const takers = L.takers ? knownTakers(L.takers, known) : undefined;
  const subs = L.subs ? L.subs.filter((x) => !known.size || (known.has(x.out) && known.has(x.in))) : undefined;
  return {
    ...L,
    slots,
    bench: squadIds.filter((id) => !onPitch.has(id)),
    roles: rolesFor({ slots, roles: base, takers }),
    ...(takers ? { takers } : {}),
    ...(subs ? { subs } : {}),
    tactics: { ...defaultTactics(), ...L.tactics },
    playerPositions: { ...L.playerPositions },
  };
}

/** What the lineup's undo rewinds, as a comparable string (the strokes, the jugadas and the stored bench
 *  left out; keys in a fixed order): a lineup with another one came from somewhere else. */
export function editSig(L: Lineup): string {
  const sorted = (o: object | undefined) => Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify([L.formation, !!L.freeMode, L.slots.map((s) => [s.playerId ?? null, s.x, s.y]), sorted(L.roles), sorted(L.tactics), sorted(L.playerPositions), (L.subs ?? []).map((x) => [x.id, x.min, x.out, x.in]), takersOf(L), tacticaSig(L)]);
}

/** Keep the stored bench in step with the pitch (the old board reads it). */
export function withBench(L: Lineup, squadIds: string[]): Lineup {
  const onPitch = new Set(L.slots.map((s) => s.playerId).filter(Boolean));
  return { ...L, bench: squadIds.filter((id) => !onPitch.has(id)) };
}

export function setSystem(L: Lineup, name: FormationName): Lineup {
  return { ...L, formation: name, freeMode: false, slots: applyFormation(L.slots, name) };
}

export function stepSystem(L: Lineup, d: 1 | -1): Lineup {
  const i = SYSTEMS.indexOf(L.formation);
  return setSystem(L, SYSTEMS[(i + d + SYSTEMS.length) % SYSTEMS.length]);
}

/** Libre: every slot keeps the spot it had (rounded), and from now on moves freely. */
export function goFree(L: Lineup): Lineup {
  if (L.freeMode) return L;
  const slots = L.slots.map((s, i) => {
    const p = slotPos(L, i);
    return { ...s, x: Math.round(p.u), y: Math.round(p.v) };
  });
  return { ...L, freeMode: true, slots };
}

/** Reset de posiciones: free mode stays, every slot goes back to its system spot. */
export function resetFree(L: Lineup): Lineup {
  const sys = { ...L, freeMode: false };
  const slots = L.slots.map((s, i) => {
    const p = slotPos(sys, i);
    return { ...s, x: Math.round(p.u), y: Math.round(p.v) };
  });
  return { ...L, slots };
}

export const snapGrid = (n: number): number => Math.round(n / 5) * 5;

/** A free spot from a drop point: inside the pitch, on the 5% grid when it is on. */
export function freeSpot(u: number, v: number, grid: boolean): [number, number] {
  const cu = Math.max(4, Math.min(96, u));
  const cv = Math.max(4, Math.min(96, v));
  return grid ? [snapGrid(cu), snapGrid(cv)] : [Math.round(cu), Math.round(cv)];
}

/** Turning the grid on snaps every free spot to it. */
export function snapAll(L: Lineup): Lineup {
  if (!L.freeMode) return L;
  return { ...L, slots: L.slots.map((s) => ({ ...s, x: snapGrid(s.x), y: snapGrid(s.y) })) };
}

export function setDefLine(L: Lineup, value: string): Lineup {
  return { ...L, tactics: { ...L.tactics, defLine: value } };
}
export function cycleDefLine(L: Lineup): Lineup {
  const o = DEF_LINE_VALUES as readonly string[];
  const i = o.indexOf(L.tactics?.defLine);
  return setDefLine(L, o[(i < 0 ? 1 : i + 1) % 3]);
}

/** A galón goes to `id`, or comes off him if he already wore it. The dead-ball ones put him 1º of their
 *  list (see takers.ts); the brazalete and the vice-capitanía never go to the same player. */
export function toggleRole(L: Lineup, key: RoleKey, id: string): Lineup {
  const kind = ROLE_TAKER[key];
  if (kind) return toggleFirst(L, kind, id);
  const roles = { ...L.roles };
  if (roles[key] === id) delete roles[key];
  else {
    roles[key] = id;
    const other: RoleKey = key === "captainId" ? "viceId" : "captainId";
    if (roles[other] === id) delete roles[other];
  }
  return { ...L, roles };
}

/** «Jugar de»: a per-board position; choosing his natural one clears the override. */
export function setPlaysAs(L: Lineup, sq: Squad, id: string, zone: Zone): Lineup {
  const playerPositions = { ...L.playerPositions };
  if (sq.byId.get(id)?.pos === zone) delete playerPositions[id];
  else playerPositions[id] = zone;
  return { ...L, playerPositions };
}

/** A player into slot i (whoever was there goes where he came from; off the pitch, without his galones). */
export const place = (L: Lineup, id: string, i: number): Lineup => dropBenchedRoles(placeIntoSlot(L, id, i));
/** Off to the bench, galones and all. */
export const toBench = (L: Lineup, id: string): Lineup => dropBenchedRoles(sendToBench(L, id));
export const swap = (L: Lineup, a: string, b: string): Lineup => dropBenchedRoles(swapPlayers(L, a, b));

/** The nearest slot to a plane point (optionally only the empty ones; -1 if none). */
export function nearestSlot(L: Lineup, u: number, v: number, emptyOnly = false): number {
  let best = -1;
  let bd = Infinity;
  for (let k = 0; k < L.slots.length; k++) {
    if (emptyOnly && L.slots[k].playerId) continue;
    const d = planeDist2(slotPos(L, k), { u, v });
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

// ── drop: what a released cromo does, by where it lands ──
export type DragSource = { id: string; from: "pitch" | "bench" };
export type DropTarget =
  | { k: "gslot"; i: number }
  | { k: "tok"; id: string; from: "pitch" | "bench" }
  | { k: "slot"; i: number }
  | { k: "bench" }
  | { k: "pitch"; u: number; v: number };
export type DropResult = { lineup: Lineup } | { toast: string } | null;

export function resolveDrop(L: Lineup, sq: Squad, src: DragSource, t: DropTarget | null, grid: boolean): DropResult {
  if (!t) return null;
  const name = (id: string) => sq.byId.get(id)?.name ?? "Ese jugador";
  const i = L.slots.findIndex((s) => s.playerId === src.id);
  if (src.from === "pitch") {
    if (i < 0) return null;
    switch (t.k) {
      case "bench":
        return { lineup: toBench(L, src.id) };
      case "gslot":
      case "slot":
        return t.i === i ? null : { lineup: place(L, src.id, t.i) };
      case "tok":
        if (t.id === src.id) return null;
        if (t.from === "pitch") return { lineup: swap(L, src.id, t.id) };
        if (!isAvailable(sq, t.id)) return { toast: name(t.id) + " está de baja" };
        return { lineup: place(L, t.id, i) };
      case "pitch": {
        if (L.freeMode) {
          const [x, y] = freeSpot(t.u, t.v, grid);
          const slots = cloneSlots(L);
          slots[i] = { ...slots[i], x, y };
          return { lineup: { ...L, slots } };
        }
        const k = nearestSlot(L, t.u, t.v);
        return k === i || k < 0 ? null : { lineup: place(L, src.id, k) };
      }
    }
  }
  if (t.k === "bench") return null;
  if (!isAvailable(sq, src.id)) return { toast: name(src.id) + " está de baja: no se puede colocar" };
  let k = -1;
  if (t.k === "gslot" || t.k === "slot") k = t.i;
  else if (t.k === "tok" && t.from === "pitch") k = L.slots.findIndex((s) => s.playerId === t.id);
  else if (t.k === "pitch") {
    k = nearestSlot(L, t.u, t.v, true);
    if (k < 0) k = nearestSlot(L, t.u, t.v);
  }
  if (k < 0) return null;
  let next = place(L, src.id, k);
  if (next.freeMode && t.k === "pitch") {
    const [x, y] = freeSpot(t.u, t.v, grid);
    const slots = cloneSlots(next);
    slots[k] = { ...slots[k], x, y };
    next = { ...next, slots };
  }
  return { lineup: next };
}

// ── who can come in from the bench ──
/** Can be dealt from the bench: not a baja, didn't say no, and called (when the match has a convocatoria). */
export function canCome(sq: Squad, id: string, called: ReadonlySet<string> | null): boolean {
  return isAvailable(sq, id) && sq.byId.get(id)?.cv !== "no" && (!called || called.has(id));
}
/** The answer's rank: «Voy» first, then no answer yet, then «Duda». */
export function answerRank(sq: Squad, id: string): number {
  const cv = sq.byId.get(id)?.cv;
  return cv === "voy" ? 0 : cv === "duda" ? 2 : 1;
}

// ── Auto-colocar: every cromo to his place (the pitch first, then the best of the bench) ──
export function autoPlace(L: Lineup, sq: Squad, called: ReadonlySet<string> | null = null): Lineup {
  const { pool, bench } = autoCandidates(L, sq, called);
  const cand = pool.concat(bench);
  const out = hasFitData(cand, sq) ? autoByEncaje(L, sq, pool, bench) : autoByLine(L, sq, pool, cand);
  return dropBenchedRoles({ ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: out[i] })) });
}

/** Who Auto-colocar places: the pitch (without bajas or a «no voy»), then the bench that can come
 *  («Voy», no answer, «Duda», each by form). */
function autoCandidates(L: Lineup, sq: Squad, called: ReadonlySet<string> | null): { pool: string[]; bench: string[] } {
  const ok = (id: string) => isAvailable(sq, id) && sq.byId.get(id)?.cv !== "no";
  const pool = L.slots.map((s) => s.playerId).filter((id): id is string => !!id && ok(id));
  const bench = sq.list
    .filter((c) => !pool.includes(c.id) && canCome(sq, c.id, called) && !L.slots.some((s) => s.playerId === c.id))
    .sort((a, b) => answerRank(sq, a.id) - answerRank(sq, b.id) || b.rt - a.rt)
    .map((c) => c.id);
  return { pool, bench };
}

/** Whether Auto-colocar places by exact encaje (someone it can place has a preferida or a también)
 *  rather than by lines — for the words that tell what it did. */
export function autoByEncajeOn(L: Lineup, sq: Squad, called: ReadonlySet<string> | null = null): boolean {
  const { pool, bench } = autoCandidates(L, sq, called);
  return hasFitData(pool.concat(bench), sq);
}

/**
 * Auto-colocar with exact positions (someone has a preferida or a también): the best placement of the
 * pitch and the bench, an exact max-weight assignment — in place first (logicGrade ≥ 2), then the grade
 * (unknown counts as adaptado), the form only breaking ties. The pitch keeps its places against an
 * equal bench (a bench player comes in where he is in place and nobody of the pitch is, or to fill a
 * gap) and each stays in his own slot when nothing is gained; the bench in its usual order («Voy», no
 * answer, «Duda»). The keeper's slot only to a declared keeper while there is one.
 */
function autoByEncaje(L: Lineup, sq: Squad, pool: string[], bench: string[]): (string | null)[] {
  const cand = pool.concat(bench);
  const onPitch = new Set(pool);
  const keeper = cand.some((id) => inPlace(logicGrade(L, sq, id, 0)));
  return placeByWeight(L.slots.length, cand, (i, id) => {
    const g = logicGrade(L, sq, id, i);
    if (i === 0 && keeper && !inPlace(g)) return null;
    // (1000: every slot filled while there is someone; 50 for the pitch < 100 in place, > 10·grade steps)
    const prio = onPitch.has(id) ? 50 + (L.slots[i]?.playerId === id ? 0.001 : 0) : 2 - answerRank(sq, id);
    return 1000 + 100 * (inPlace(g) ? 1 : 0) + 10 * (g ?? 1) + (sq.byId.get(id)?.rt ?? 0) / 100 + prio;
  });
}

/** Auto-colocar by lines (nobody with an exact position): natural zone first, the pitch first. */
function autoByLine(L: Lineup, sq: Squad, pool: string[], cand: string[]): (string | null)[] {
  const out: (string | null)[] = L.slots.map(() => null);
  const used = new Set<string>();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      if (out[i]) continue;
      const z = slotZone(L, i);
      for (let c = 0; c < cand.length; c++) {
        const id = cand[c];
        if (used.has(id)) continue;
        if (pass === 0 && natOf(L, sq, id) !== z) continue;
        if (pass === 1 && i === 0) continue;
        if (pass === 1 && c >= pool.length && pool.length >= XI) break;
        out[i] = id;
        used.add(id);
        break;
      }
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    const id = cand.find((x) => !used.has(x));
    if (id) {
      out[i] = id;
      used.add(id);
    }
  }
  return out;
}
