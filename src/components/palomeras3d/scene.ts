// What the still and the WebGL scene share: the ground's measures, where each figure stands, how bright
// each mast is, and the broadcast name plates (DOM). No three.js here.
import type { PalomerasFigure, PalomerasState } from "./types";

/** Fútbol 7 pitch in metres: 56 × 36 (half-length, half-width). x along the pitch (we attack +x), z across. */
export const PITCH = { L: 56, W: 36, HL: 28, HW: 18 } as const;

export const SPONSORS: readonly string[] = ["Bar Casa Paco", "Ferretería Palomeras", "Pinturas Vallecas", "Autoescuela Mirasierra"];

/** The four masts (x, z), in the order they ignite. */
export const MASTS: readonly (readonly [number, number])[] = (() => {
  const MX = PITCH.HL + 4.5;
  const MZ = PITCH.HW + 6.8;
  return [
    [-MX, MZ],
    [-MX, -MZ],
    [MX, -MZ],
    [MX, MZ],
  ];
})();
export const MAST_H = 20;
/** Seconds after ignite() at which each mast comes on. */
export const IGNITE_AT: readonly number[] = [0, 0.35, 0.7, 1.05];

/** Pitch % (x across from our left, y from our goal) → world metres. */
export function pitchToWorld(x: number, y: number): { x: number; z: number } {
  const cx = Math.max(-4, Math.min(104, x));
  const cy = Math.max(-4, Math.min(104, y));
  return { x: -PITCH.HL + (cy / 100) * PITCH.L, z: (cx / 100 - 0.5) * PITCH.W };
}

/** World metres → pitch % (inverse of pitchToWorld). */
export function worldToPitch(wx: number, wz: number): { x: number; y: number } {
  return { x: (wz / PITCH.W + 0.5) * 100, y: ((wx + PITCH.HL) / PITCH.L) * 100 };
}

export interface SceneFigure {
  id: string;
  num: string;
  name: string;
  x: number;
  z: number;
  gk: boolean;
  plate: "full" | "mini" | "none";
  tag: PalomerasFigure["tag"] | undefined;
  leaving: boolean;
}

/** Where the half-time huddle forms: by the bench, on our half. */
export const HUDDLE = { x: -6, z: 12, rx: 3.4, rz: 2.8 } as const;

/** Places the figures: pitch % to metres, the huddle as a ring by the bench (without plates). */
export function placeFigures(figures: readonly PalomerasFigure[] | undefined): SceneFigure[] {
  const list = figures ?? [];
  const huddlers = list.filter((f) => f.huddle && !f.leaving);
  return list.map((f) => {
    let { x, z } = pitchToWorld(f.x, f.y);
    let plate = f.plate ?? "full";
    if (f.huddle && !f.leaving) {
      const i = huddlers.indexOf(f);
      const a = (i / huddlers.length) * Math.PI * 2;
      x = HUDDLE.x + Math.cos(a) * HUDDLE.rx;
      z = HUDDLE.z + Math.sin(a) * HUDDLE.rz;
      plate = "none";
    }
    return { id: f.id, num: f.num, name: f.name, x, z, gk: !!f.gk, plate, tag: f.tag, leaving: !!f.leaving };
  });
}

export interface MastLevels {
  /** Power of each mast, 0..1. */
  power: [number, number, number, number];
  /** Lamps warming before the match (dim glow, a hint of flare). */
  pre: number;
}

/** The floodlights' steady state (ignite() animates over it). */
export function floodLevels(mode: PalomerasState["floodlights"]): MastLevels {
  if (mode === "on") return { power: [1, 1, 1, 1], pre: 0 };
  if (mode === "glow") return { power: [0, 0, 0, 0], pre: 1 };
  return { power: [0, 0, 0, 0], pre: 0 };
}

/** Power of each mast `t` seconds into ignite(): each snaps on over 0.12 s at its own beat. */
export function ignitePower(t: number): [number, number, number, number] {
  const p = IGNITE_AT.map((b) => (t < b ? 0 : Math.min(1, (t - b) / 0.12)));
  return [p[0], p[1], p[2], p[3]];
}

/* ---------- broadcast name plates (DOM, decorative) ---------- */

export interface PlateLook {
  cls: string;
  num: string;
  name: string | null;
  tu: boolean;
  card: "A" | "R" | null;
}

/** The plate of a figure: classes and contents. `celebrating` lights it gold (a goal, an MVP). */
export function plateLook(f: SceneFigure, celebrating: boolean): PlateLook {
  const mini = f.plate === "mini";
  const gold = celebrating || f.tag === "gol";
  const mvp = f.tag === "mvp";
  const cls =
    "pm-pl" + (mini ? " mini" : "") + (f.gk ? " gk" : "") + (f.tag === "tu" ? " tu" : "") + (mvp ? " mvp" : "") + (gold ? " gol" : "");
  return {
    cls,
    num: f.num,
    name: mini ? null : (mvp ? "MVP " : "") + f.name,
    tu: f.tag === "tu" && !mini,
    card: f.tag === "amarilla" ? "A" : f.tag === "roja" ? "R" : null,
  };
}

/** Writes a plate's contents into its node (only when they changed). */
export function fillPlate(node: HTMLElement, look: PlateLook): void {
  const key = `${look.num}|${look.name ?? ""}|${look.tu}|${look.card ?? ""}`;
  if (node.dataset.k === key) return;
  node.dataset.k = key;
  node.replaceChildren();
  const b = document.createElement("b");
  b.textContent = look.num;
  node.appendChild(b);
  if (look.name !== null) {
    const s = document.createElement("span");
    s.textContent = look.name;
    node.appendChild(s);
  }
  if (look.tu) {
    const i = document.createElement("i");
    i.textContent = "tú";
    node.appendChild(i);
  }
  if (look.card) {
    const em = document.createElement("em");
    em.className = look.card === "A" ? "y" : "r";
    em.textContent = look.card;
    node.appendChild(em);
  }
}

/** Plates keep 60 px from the sides so they never clip. */
export function plateX(x: number, w: number): number {
  return w > 160 ? Math.max(60, Math.min(w - 60, x)) : x;
}
