// r14 «La pizarra» · PiCampo's geometry (pure): how big the 2:3 pitch plane is inside its box for each camera, where it
// sits, the shirt size, and the transforms of Foco and the flat zoom. Ported from the prototype's PiCampo.geometry():
// Grada/Foco fit the tilted plane by projecting it (the far shirts' tops, standing up, and the near edge, wider by
// perspective, must sit inside the box with a margin).
import type { Camera, LayerId, Layout, PzView } from "../store/types";

/** The layers of the pitch and their keys (0–5). */
export const CAMPO_LAYERS: { id: LayerId; t: string; key: string }[] = [
  { id: "nada", t: "Nada", key: "0" },
  { id: "media", t: "Media", key: "1" },
  { id: "nota", t: "Nota", key: "2" },
  { id: "quimica", t: "Química", key: "3" },
  { id: "forma", t: "Forma", key: "4" },
  { id: "minutos", t: "Minutos", key: "5" },
];

/** The plane's tilt per camera (degrees). */
export const RX: Record<Camera, number> = { pizarra: 0, grada: 50, foco: 34 };

export interface Geometry {
  w: number;
  h: number;
  /** The plane's width and height (px, 2:3). */
  pw: number;
  ph: number;
  persp: number;
  rx: number;
  ty: number;
  /** The shirt's width (px). */
  s: number;
}

export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** The shirt width for a plane width: ≈ 12.6 % on the big pitch, 13 % in a mini (crisp at a glance). */
export function shirtSize(pw: number, mini: boolean): number {
  return Math.max(mini ? 9 : 26, Math.min(66, pw * (mini ? 0.13 : 0.126)));
}

export function fitGeometry(cam: Camera, layout: Layout, mini: boolean, boxW: number, boxH: number, gradaPad = 0): Geometry {
  const w = boxW || (layout === "phone" ? 358 : 560);
  const h = boxH || (layout === "phone" ? 540 : 760);
  const chrome = !mini;
  const padT = chrome ? (layout === "phone" ? 8 : 52) : 4;
  const padB = chrome ? (layout === "phone" ? 52 : 56) : 4;
  const padX = mini ? 4 : layout === "phone" ? 6 : 16;
  const rx = RX[cam] ?? 0;
  if (cam === "grada" || cam === "foco") {
    const a = (rx * Math.PI) / 180;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const py = h * 0.32;
    const T0 = padT + 10 + gradaPad;
    const B0 = h - padB - 8;
    const proj = (d: number, y: number, z: number, t: number) => {
      const Y = h / 2 + t + y * cs - z * sn;
      const Z = y * sn + z * cs;
      return { y: py + ((Y - py) * d) / (d - Z), k: d / (d - Z) };
    };
    const pw0 = (w - padX * 2) * (mini ? 0.94 : 0.96);
    let best: { pw: number; ph: number; d: number; ty: number } | null = null;
    for (let k = 0; k < 40 && !best; k++) {
      const pw = pw0 * (1 - k * 0.022);
      const ph = pw * 1.5;
      const d = Math.max(900, ph * 1.7);
      const s = shirtSize(pw, mini);
      const hTop = mini ? s * 1.4 : s * 1.327 + s * 0.5 + 22;
      let t = 0;
      for (let it = 0; it < 6; it++) {
        const top = proj(d, -0.45 * ph, hTop, t).y;
        const bot = proj(d, 0.52 * ph, 0, t).y;
        t += ((T0 + B0) / 2 - (top + bot) / 2) * 0.85;
      }
      const top = proj(d, -0.45 * ph, hTop, t).y;
      const nb = proj(d, 0.5 * ph, 0, t);
      const bot = proj(d, 0.52 * ph, 0, t).y;
      const halfW = (pw / 2) * nb.k;
      if (top >= T0 - 1 && bot <= B0 + 1 && halfW <= w / 2 - padX) best = { pw, ph, d, ty: t };
    }
    if (!best) {
      const pw = pw0 * 0.1;
      best = { pw, ph: pw * 1.5, d: 900, ty: 0 };
    }
    return { w, h, pw: best.pw, ph: best.ph, persp: best.d, rx, ty: best.ty, s: shirtSize(best.pw, mini) };
  }
  // flat: keep the plates of the bottom row inside the box (they hang below the shirts' centre)
  const hang = mini ? 0 : 0.05;
  const ph = Math.max(10, Math.min((h - padT - padB) / (1 + hang), (w - padX * 2) * 1.5));
  const pw = ph / 1.5;
  let ty = (padT - padB) / 2 - (ph * hang) / 2;
  // (tablet: the pitch sits right under the layer switch, never under it)
  if (layout === "tablet") ty = padT + 4 - (h - ph) / 2;
  return { w, h, pw, ph, persp: 1200, rx, ty, s: shirtSize(pw, mini) };
}

/** The plane's transform: Foco dollies to a player or a spot (clamped near the far goal); a flat zoom scales and
 *  translates without tilting (tokens are counter-scaled by 1/s so the people keep their size). */
export function planeTransform(cam: Camera, G: Geometry, view: Pick<PzView, "focus" | "zoom" | "slots">): { sc: number; tx: number; ty: number; zs: number } {
  let focus: { x: number; y: number } | null = null;
  const f = view.focus;
  if (f && f.pid) {
    const s = view.slots.find((x) => x.pid === f.pid);
    focus = s ? { x: s.x, y: s.y } : null;
  } else if (f && typeof f.x === "number" && typeof f.y === "number") focus = { x: f.x, y: f.y };
  if (cam === "foco" && focus) {
    const fy = Math.max(28, Math.min(80, focus.y));
    const sc = 1.9;
    const tx = ((50 - focus.x) / 100) * G.pw * sc + (f && f.dx ? (f.dx / 100) * G.w : 0);
    const ty = ((50 - fy) / 100) * G.ph * sc * 0.62 - G.h * 0.05;
    return { sc, tx, ty, zs: 1 };
  }
  const z = view.zoom;
  if (cam === "pizarra" && z && z.s > 1) {
    const sc = z.s;
    const tx = (-((z.x ?? 50) - 50) / 100) * G.pw * sc;
    const ty = G.ty - (((z.y ?? 50) - 50) / 100) * G.ph * sc;
    return { sc, tx, ty, zs: round2(1 / sc) };
  }
  return { sc: 1, tx: 0, ty: G.ty, zs: 1 };
}

const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/** The slot an arrow key moves the focus to, by geometry (the nearest one ahead in that direction), or null. */
export function slotAhead(slots: readonly { i: number; x: number; y: number }[], from: number, key: string): number | null {
  const dir = DIRS[key];
  const me = slots.find((s) => s.i === from);
  if (!dir || !me) return null;
  let best: number | null = null;
  let bd = 1e9;
  for (const s of slots) {
    if (s.i === from) continue;
    const dx = s.x - me.x;
    const dy = s.y - me.y;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 2) continue;
    const d = along + Math.abs(dx * dir[1] + dy * dir[0]) * 2.2;
    if (d < bd) {
      bd = d;
      best = s.i;
    }
  }
  return best;
}

/** The sistema's chalk shape: the players of each line joined, and a lone player joined to the next line. */
export function shapeLines(slots: readonly { code: string; x: number; y: number }[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const pts = slots.filter((s) => s.code !== "POR").slice().sort((a, b) => a.y - b.y);
  const rows: { y: number; s: { x: number; y: number }[] }[] = [];
  for (const s of pts) {
    const r = rows.find((x) => Math.abs(x.y - s.y) < 8);
    if (r) {
      r.s.push(s);
      r.y = (r.y + s.y) / 2;
    } else rows.push({ y: s.y, s: [s] });
  }
  for (const r of rows) {
    const s = r.s.slice().sort((a, b) => a.x - b.x);
    for (let k = 0; k < s.length - 1; k++) out.push({ x1: s[k].x, y1: s[k].y, x2: s[k + 1].x, y2: s[k + 1].y });
  }
  for (let k = 0; k < rows.length - 1; k++) {
    const a = rows[k].s;
    const b = rows[k + 1].s;
    if (a.length === 1) for (const x of b) out.push({ x1: a[0].x, y1: a[0].y, x2: x.x, y2: x.y });
    else if (b.length === 1) for (const x of a) out.push({ x1: x.x, y1: x.y, x2: b[0].x, y2: b[0].y });
  }
  return out;
}
