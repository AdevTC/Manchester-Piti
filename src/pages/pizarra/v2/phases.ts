// La pizarra · Bloque 4 — the plan's phases on the pitch. «Con balón · Sin balón · Transición»: the board's
// second shape (`shapeOff`: the system without the ball and each slot's nudge) and the way between both, with
// who has too far to run between them. «Fases» (Salida · Progresión · Bloque bajo · Presión): where the
// consignas take each cromo, as deterministic offsets from the plan's own geometry. The pitch shows a phase
// through a view of the lineup (`phaseAt`, never stored), so the cromos glide there and back. Pure.
import type { FormationName, Lineup } from "../formations";
import { systemDef } from "../../../lib/formations";
import type { ShapeOff, ShapeOffset } from "../../../lib/tacticaSchemas";
import { TACTICA_LIMITS } from "../../../lib/tacticaSchemas";
import { defaultTactics } from "../tactics";
import { CAMS, f1, FORM, planeDist2, proj, slotPos, slotZone, type CamName, type UV } from "./geometry";
import type { PlanArrow } from "./plan";

export type ShapeView = "con" | "sin" | "trans";
export const SHAPE_VIEWS: { id: ShapeView; l: string }[] = [
  { id: "con", l: "Con balón" },
  { id: "sin", l: "Sin balón" },
  { id: "trans", l: "Transición" },
];

export type FaseId = "plan" | "salida" | "progresion" | "bloque" | "presion";
/** The «Fases» scrubber's stops: the plan as it is, then the four moments of the match. */
export const FASES: { id: FaseId; l: string; d: string }[] = [
  { id: "plan", l: "El plan", d: "Cada uno en su sitio del sistema." },
  { id: "salida", l: "Salida", d: "Sacamos desde atrás: los centrales se abren." },
  { id: "progresion", l: "Progresión", d: "Subimos juntos hacia su campo." },
  { id: "bloque", l: "Bloque bajo", d: "Juntos atrás, cerca del área." },
  { id: "presion", l: "Presión", d: "Saltamos a por el balón." },
];

/** A player who runs more than this between «con balón» and «sin balón» (plane units, ~ % of the pitch) is warned. */
export const RUN_MAX = 35;
/** The pitch of a fútbol 7 match, in metres (length × width), for the distances said in words. */
export const PITCH_M = { len: 60, wid: 40 } as const;

const r1 = (n: number): number => Math.round(n * 10) / 10;
const clampU = (u: number): number => Math.max(5, Math.min(95, u));
const clampV = (v: number): number => Math.max(5, Math.min(97, v));
const clampOff = (n: number): number => Math.max(-TACTICA_LIMITS.off, Math.min(TACTICA_LIMITS.off, r1(n)));

/** The lineup without any phase view on it (the plan's own spots). */
const bare = (L: Lineup): Lineup => (L.phaseAt ? { ...L, phaseAt: undefined } : L);

/** Where each slot stands with the ball: the plan as the board has it. */
export function conPositions(L: Lineup): UV[] {
  const B = bare(L);
  return B.slots.map((_, i) => slotPos(B, i));
}

/** The system's own spot for slot i of the shape without the ball (before its nudge), with the board's plan. */
function offBase(L: Lineup, formation: FormationName, i: number): UV {
  return slotPos({ ...bare(L), formation, freeMode: false }, i);
}

/** «Sin balón» when the board has none yet: the same system a step back and a touch narrower. */
export function defaultShapeOff(L: Lineup): ShapeOff {
  const formation = L.formation;
  const offs: ShapeOffset[] = L.slots.map((_, i) => {
    if (i === 0) return { du: 0, dv: 0 };
    const b = offBase(L, formation, i);
    return { du: clampOff(-(b.u - 50) * 0.12), dv: 6 };
  });
  return { formation, offs };
}

/** The board's shape without the ball (its own, else the default one). */
export const shapeOffOf = (L: Lineup): ShapeOff => L.shapeOff ?? defaultShapeOff(L);

/** Where each slot stands without the ball. */
export function sinPositions(L: Lineup): UV[] {
  const off = shapeOffOf(L);
  return L.slots.map((_, i) => {
    const b = offBase(L, off.formation, i);
    if (i === 0) return b;
    const o = off.offs[i] ?? { du: 0, dv: 0 };
    return { u: clampU(b.u + o.du), v: clampV(b.v + o.dv) };
  });
}

/** Halfway between both shapes: the moment the ball is lost (or won). */
export function transPositions(L: Lineup): UV[] {
  const a = conPositions(L);
  const b = sinPositions(L);
  return a.map((p, i) => ({ u: r1((p.u + b[i].u) / 2), v: r1((p.v + b[i].v) / 2) }));
}

const WIDE_FOCUS: Record<string, number> = { Bandas: 1.2, Centro: 0.85, Equilibrado: 1.05 };
const BLOCK_DROP: Record<string, number> = { Baja: 14, Media: 11, Alta: 8 };
const BLOCK_NARROW: Record<string, number> = { Estrecha: 0.72, Media: 0.8, Amplia: 0.88 };
const PRESS_UP: Record<string, [def: number, rest: number]> = { Alta: [12, 16], Media: [6, 8], Repliegue: [2, 3] };

/** Where the consignas take each slot in a phase of the match (from the plan with the ball). */
export function fasePositions(L: Lineup, fase: FaseId): UV[] {
  const con = conPositions(L);
  if (fase === "plan") return con;
  const t = { ...defaultTactics(), ...L.tactics };
  return con.map((p, i) => {
    const z = slotZone(bare(L), i);
    let { u, v } = p;
    if (fase === "salida") {
      // the centrales open and drop to receive; the medios come short as the salida asks; in largo the 9 goes
      if (z === "DEF") {
        v += 6;
        u = 50 + (u - 50) * 1.18;
      } else if (z === "MED") v += t.buildup === "Corta" ? 8 : t.buildup === "Mixta" ? 4 : 0;
      else if (z === "DEL") v -= t.buildup === "En largo" ? 6 : 0;
    } else if (fase === "progresion") {
      if (z !== "POR") {
        v -= (z === "DEF" ? 10 : z === "MED" ? 12 : 8) + (t.tempo === "Rápido" ? 3 : 0);
        if (z !== "DEF") u = 50 + (u - 50) * (WIDE_FOCUS[t.attackFocus] ?? 1);
      }
    } else if (fase === "bloque") {
      if (z !== "POR") {
        v += BLOCK_DROP[t.defLine] ?? 11;
        u = 50 + (u - 50) * (BLOCK_NARROW[t.width] ?? 0.8);
      }
    } else if (fase === "presion") {
      const [d, r] = PRESS_UP[t.press] ?? PRESS_UP.Media;
      if (z === "POR") v -= t.press === "Alta" && t.mentality === "Ofensiva" ? 6 : 0;
      else {
        v -= z === "DEF" ? d : r;
        u = 50 + (u - 50) * 0.9;
      }
    }
    return { u: r1(clampU(u)), v: r1(clampV(v)) };
  });
}

/** The lineup as the pitch shows it in a phase (null positions = the plan as it is). */
export const phaseView = (L: Lineup, at: UV[] | null): Lineup => (at ? { ...L, phaseAt: at } : bare(L));

/** What the pitch shows for the toggle and the scrubber (null = the plan itself). Sin balón / transición win. */
export function phaseAt(L: Lineup, shape: ShapeView, fase: FaseId): UV[] | null {
  if (shape === "sin") return sinPositions(L);
  if (shape === "trans") return transPositions(L);
  return fase === "plan" ? null : fasePositions(L, fase);
}

/** The arrows of a phase: from each placed player's spot in the plan to where the phase takes him. */
export function phaseArrows(L: Lineup, to: UV[], cam: CamName, sky = false): PlanArrow[] {
  const C = CAMS[cam];
  const from = conPositions(L);
  const out: PlanArrow[] = [];
  L.slots.forEach((s, i) => {
    if (!s.playerId || !to[i]) return;
    const a = from[i];
    const b = to[i];
    if (Math.sqrt(planeDist2(a, b)) < 3) return;
    const A = proj(C, a.u, a.v);
    const B = proj(C, b.u, b.v);
    const ax = A.x * 10;
    const ay = A.y * 10;
    const bx = B.x * 10;
    const by = B.y * 10;
    const mx = (ax + bx) / 2 - (by - ay) * 0.12;
    const my = (ay + by) / 2 + (bx - ax) * 0.12;
    out.push({ key: "ph" + i, c: sky ? "sky" : "", d: "M" + f1(ax) + " " + f1(ay) + "Q" + f1(mx) + " " + f1(my) + " " + f1(bx) + " " + f1(by) });
  });
  return out;
}

export interface Runner {
  id: string;
  /** Plane units between his two spots. */
  d: number;
  /** The same in metres on a 60 × 40 m pitch. */
  m: number;
}

/** The distance in metres between two plane points (u across 40 m, v along 60 m). */
export const metres = (a: UV, b: UV): number => Math.round(Math.hypot(((a.u - b.u) / 100) * PITCH_M.wid, ((a.v - b.v) / 100) * PITCH_M.len));

/** Who runs too much between «con balón» and «sin balón» (> RUN_MAX), the longest first. */
export function runners(L: Lineup): Runner[] {
  const a = conPositions(L);
  const b = sinPositions(L);
  return L.slots
    .flatMap((s, i) => {
      if (!s.playerId) return [];
      const d = Math.sqrt(planeDist2(a[i], b[i]));
      return d > RUN_MAX ? [{ id: s.playerId, d: r1(d), m: metres(a[i], b[i]) }] : [];
    })
    .sort((x, y) => y.d - x.d);
}

/** «ALCIDES corre demasiado entre fases (24 m)». */
export const runnerTxt = (name: string, r: Runner): string => name + " corre demasiado entre fases (" + r.m + " m)";

// ── editing the shape without the ball ──
const withOff = (L: Lineup, off: ShapeOff): Lineup => ({ ...L, shapeOff: off });

/** Another system without the ball (the nudges stay). */
export function setOffFormation(L: Lineup, formation: FormationName): Lineup {
  const off = shapeOffOf(L);
  if (!FORM[formation] || (L.shapeOff && off.formation === formation)) return L;
  return withOff(L, { formation, offs: off.offs.map((o) => ({ ...o })) });
}

/** The block a step (4 % of the length) back (+1) or up (−1); unchanged at the limit. */
export function shiftOffBlock(L: Lineup, d: 1 | -1): Lineup {
  const off = shapeOffOf(L);
  let moved = false;
  const offs = off.offs.map((o, i) => {
    if (i === 0) return { ...o };
    const dv = clampOff(o.dv + 4 * d);
    if (dv !== o.dv) moved = true;
    return { du: o.du, dv };
  });
  return moved ? withOff(L, { formation: off.formation, offs }) : L;
}

/** The block a touch wider (+1) or narrower (−1). */
export function widenOff(L: Lineup, d: 1 | -1): Lineup {
  const off = shapeOffOf(L);
  let moved = false;
  const offs = off.offs.map((o, i) => {
    if (i === 0) return { ...o };
    const b = offBase(L, off.formation, i);
    const du = clampOff(o.du + (b.u - 50) * 0.1 * d);
    if (du !== o.du) moved = true;
    return { du, dv: o.dv };
  });
  return moved ? withOff(L, { formation: off.formation, offs }) : L;
}

/** No shape of its own without the ball (the default one shows again). */
export const clearShapeOff = (L: Lineup): Lineup => (L.shapeOff ? { ...L, shapeOff: null } : L);

/** How far the block drops (+) or climbs (−) without the ball, in metres (the mean of the outfield nudges). */
export function blockMetres(off: ShapeOff): number {
  const o = off.offs.slice(1);
  if (!o.length) return 0;
  const dv = o.reduce((a, x) => a + x.dv, 0) / o.length;
  return Math.round((dv / 100) * PITCH_M.len);
}

/** «Sin balón: 3-2-1 · el bloque baja 4 m». */
export function shapeOffTxt(L: Lineup): string {
  const off = shapeOffOf(L);
  const m = blockMetres(off);
  return systemDef(off.formation).label + (m > 0 ? " · el bloque baja " + m + " m" : m < 0 ? " · el bloque sube " + -m + " m" : " · a la misma altura");
}

/** La charla's card for the shape without the ball (null while the board has none of its own). */
export function charlaShape(L: Lineup, name: (id: string) => string): { t: string; d: string } | null {
  if (!L.shapeOff) return null;
  const rs = runners(L);
  return {
    t: "Sin balón · " + systemDef(L.shapeOff.formation).label,
    d: "Al perderla, " + shapeOffTxt(L).replace(/^[^·]*· /, "") + "." + (rs[0] ? " Ojo: " + runnerTxt(name(rs[0].id), rs[0]) + "." : ""),
  };
}
