// La pizarra «Noche de partido» — every change the board makes to a lineup, as pure functions over the
// stored Lineup (formations.ts) built on lineupOps. No React. The design's slot table (geometry.ts FORM)
// places the cromos; free mode keeps each slot's own spot in slots[i].x/y.
import { applyFormation, type FormationName, type Lineup, type RoleKey, type Zone } from "../formations";
import { placeIntoSlot, sendToBench, swapPlayers, XI } from "../lineupOps";
import { defaultTactics } from "../tactics";
import { DEF_LINE_VALUES, planeDist2, slotPos, slotZone, SYSTEMS } from "./geometry";
import { isAvailable, natOf, type Squad } from "./model";

const cloneSlots = (L: Lineup) => L.slots.map((s) => ({ ...s }));

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
  return {
    ...L,
    slots,
    bench: squadIds.filter((id) => !onPitch.has(id)),
    roles: { ...L.roles },
    tactics: { ...defaultTactics(), ...L.tactics },
    playerPositions: { ...L.playerPositions },
  };
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

/** A galón goes to `id`, or comes off him if he already wore it. */
export function toggleRole(L: Lineup, key: RoleKey, id: string): Lineup {
  const roles = { ...L.roles };
  if (roles[key] === id) delete roles[key];
  else roles[key] = id;
  return { ...L, roles };
}

/** «Jugar de»: a per-board position; choosing his natural one clears the override. */
export function setPlaysAs(L: Lineup, sq: Squad, id: string, zone: Zone): Lineup {
  const playerPositions = { ...L.playerPositions };
  if (sq.byId.get(id)?.pos === zone) delete playerPositions[id];
  else playerPositions[id] = zone;
  return { ...L, playerPositions };
}

export { placeIntoSlot as place, sendToBench as toBench, swapPlayers as swap };

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
        return { lineup: sendToBench(L, src.id) };
      case "gslot":
      case "slot":
        return t.i === i ? null : { lineup: placeIntoSlot(L, src.id, t.i) };
      case "tok":
        if (t.id === src.id) return null;
        if (t.from === "pitch") return { lineup: swapPlayers(L, src.id, t.id) };
        if (!isAvailable(sq, t.id)) return { toast: name(t.id) + " está de baja" };
        return { lineup: placeIntoSlot(L, t.id, i) };
      case "pitch": {
        if (L.freeMode) {
          const [x, y] = freeSpot(t.u, t.v, grid);
          const slots = cloneSlots(L);
          slots[i] = { ...slots[i], x, y };
          return { lineup: { ...L, slots } };
        }
        const k = nearestSlot(L, t.u, t.v);
        return k === i || k < 0 ? null : { lineup: placeIntoSlot(L, src.id, k) };
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
  let next = placeIntoSlot(L, src.id, k);
  if (next.freeMode && t.k === "pitch") {
    const [x, y] = freeSpot(t.u, t.v, grid);
    const slots = cloneSlots(next);
    slots[k] = { ...slots[k], x, y };
    next = { ...next, slots };
  }
  return { lineup: next };
}

// ── Auto-colocar: every cromo to his natural zone (the pitch first, then the best of the bench) ──
export function autoPlace(L: Lineup, sq: Squad): Lineup {
  const ok = (id: string) => isAvailable(sq, id) && sq.byId.get(id)?.cv !== "no";
  const pool = L.slots.map((s) => s.playerId).filter((id): id is string => !!id && ok(id));
  const benchAv = sq.list.filter((c) => !pool.includes(c.id) && ok(c.id) && !L.slots.some((s) => s.playerId === c.id)).sort((a, b) => b.rt - a.rt).map((c) => c.id);
  const cand = pool.concat(benchAv);
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
  return { ...L, slots: L.slots.map((s, i) => ({ ...s, playerId: out[i] })) };
}
