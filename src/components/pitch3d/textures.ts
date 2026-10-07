// Procedural canvas textures: grass, glows, lamp panels, LED boards, nets, the ball, AR rings and
// the broadcast name plates. Everything is drawn once (except the plates and boards on change).
import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { CSS, PITCH_L, PITCH_W, RUNOFF, rng } from "./constants";
import type { PlayerSpec } from "./types";

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const g2d = (c: HTMLCanvasElement) => c.getContext("2d") as CanvasRenderingContext2D;

function tex(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearMipmapLinearFilter;
  return t;
}

/** Club faces (the host declares them with @font-face): Anybody for display/numbers, Geist for names, Geist Mono for labels. */
export const DISPLAY = "'Anybody', 'Geist', system-ui, sans-serif";
export const UI = "'Geist', system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";
/** Anybody is a width-variable face: condensed where supported (canvas fontStretch). */
function condensed(g: CanvasRenderingContext2D, on: boolean) {
  if ("fontStretch" in g) g.fontStretch = on ? "condensed" : "normal";
}

/**
 * Grass with mowing stripes across the pitch (5 m bands), fine speckle, wear in the goalmouths and
 * a slightly darker run-off. 24 px per metre; the chalk lines are separate geometry (crisper).
 */
export function grassTexture(maxAniso: number): CanvasTexture {
  const PX = 24, W = PITCH_W + RUNOFF * 2, L = PITCH_L + RUNOFF * 2;
  const c = canvas(W * PX, L * PX), g = g2d(c), rand = rng(7);
  const base: [number, number, number] = [44, 112, 58];
  g.fillStyle = `rgb(${base})`;
  g.fillRect(0, 0, c.width, c.height);
  // mowing bands: 12 across the pitch (5 m each), continued into the run-off
  const band = 5 * PX;
  for (let i = -1; i * band < c.height; i++) {
    const y0 = RUNOFF * PX + i * band;
    const k = i % 2 === 0 ? 1.17 : 0.83;
    g.fillStyle = `rgb(${base.map((v) => Math.round(v * k)).join(",")})`;
    g.fillRect(0, y0, c.width, band);
  }
  // diagonal sheen inside each band (mower direction) — faint
  g.globalAlpha = 0.05;
  for (let x = -c.height; x < c.width; x += 18) {
    g.strokeStyle = rand() > 0.5 ? "#9fe0a0" : "#0c2a14";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + c.height * 0.35, c.height);
    g.stroke();
  }
  g.globalAlpha = 1;
  // speckle (blades)
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    d[i] = Math.max(0, d[i] + n * 0.7);
    d[i + 1] = Math.max(0, d[i + 1] + n);
    d[i + 2] = Math.max(0, d[i + 2] + n * 0.6);
  }
  g.putImageData(img, 0, 0);
  // run-off slightly darker, so the pitch reads
  g.fillStyle = "rgba(4,18,10,0.28)";
  g.fillRect(0, 0, c.width, RUNOFF * PX);
  g.fillRect(0, c.height - RUNOFF * PX, c.width, RUNOFF * PX);
  g.fillRect(0, RUNOFF * PX, RUNOFF * PX, PITCH_L * PX);
  g.fillRect(c.width - RUNOFF * PX, RUNOFF * PX, RUNOFF * PX, PITCH_L * PX);
  // goalmouth wear + centre spot wear
  const wear = (x: number, y: number, rx: number, ry: number, a: number) => {
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grd.addColorStop(0, `rgba(150,140,90,${a})`);
    grd.addColorStop(1, "rgba(150,140,90,0)");
    g.save();
    g.translate(x * PX, y * PX);
    g.scale(rx * PX, ry * PX);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const cx = W / 2;
  wear(cx, RUNOFF + 1.2, 3.5, 2.2, 0.3);
  wear(cx, L - RUNOFF - 1.2, 3.5, 2.2, 0.3);
  wear(cx, RUNOFF + 8, 1.6, 1.6, 0.18);
  wear(cx, L - RUNOFF - 8, 1.6, 1.6, 0.18);
  wear(cx, L / 2, 2, 2, 0.12);
  // floodlit falloff: brighter centre, darker corners
  const v = g.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.2, c.width / 2, c.height / 2, c.height * 0.62);
  v.addColorStop(0, "rgba(255,255,240,0.06)");
  v.addColorStop(1, "rgba(0,8,20,0.32)");
  g.fillStyle = v;
  g.fillRect(0, 0, c.width, c.height);
  const t = tex(c);
  t.anisotropy = Math.min(8, maxAniso);
  return t;
}

/** Soft radial glow (white); `hard` makes a brighter core. */
export function glowTexture(hard = 0.0): CanvasTexture {
  const c = canvas(128, 128), g = g2d(c);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.08 + hard * 0.2, `rgba(255,255,255,${0.75 + hard * 0.25})`);
  grd.addColorStop(0.35, "rgba(255,255,255,0.22)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

/** Lamp glare with anamorphic streaks, for the floodlight heads. */
export function flareTexture(): CanvasTexture {
  const c = canvas(256, 256), g = g2d(c);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.06, "rgba(255,252,240,0.9)");
  grd.addColorStop(0.2, "rgba(200,225,255,0.25)");
  grd.addColorStop(1, "rgba(160,200,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = "lighter";
  for (const [w, h, a] of [[256, 5, 0.5], [180, 2, 0.6], [4, 120, 0.25]] as const) {
    const s = g.createRadialGradient(128, 128, 0, 128, 128, Math.max(w, h) / 2);
    s.addColorStop(0, `rgba(220,236,255,${a})`);
    s.addColorStop(1, "rgba(220,236,255,0)");
    g.save();
    g.translate(128, 128);
    g.scale(w / Math.max(w, h), h / Math.max(w, h));
    g.fillStyle = s;
    g.beginPath();
    g.arc(0, 0, Math.max(w, h) / 2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return tex(c, false);
}

/** Floodlight head: a 6×4 grid of lamps in a dark housing (used as emissive map). */
export function lampTexture(): CanvasTexture {
  const c = canvas(256, 176), g = g2d(c);
  g.fillStyle = "#0b1224";
  g.fillRect(0, 0, 256, 176);
  for (let r = 0; r < 4; r++)
    for (let k = 0; k < 6; k++) {
      const x = 22 + k * 42.4, y = 22 + r * 44;
      const grd = g.createRadialGradient(x, y, 0, x, y, 19);
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(0.55, "#f4f8ff");
      grd.addColorStop(0.8, "#9fd0f2");
      grd.addColorStop(1, "#16223d");
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x - 18, y - 18, 36, 36, 6);
      g.fill();
    }
  return tex(c);
}

/** Goal net: a fine white grid with alpha. */
export function netTexture(): CanvasTexture {
  const c = canvas(64, 64), g = g2d(c);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 2;
  g.strokeRect(0, 0, 64, 64);
  const t = tex(c, false);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Ball: white panels with navy/sky pentagon pattern (equirectangular). */
export function ballTexture(): CanvasTexture {
  const c = canvas(256, 128), g = g2d(c);
  g.fillStyle = "#f4f7fb";
  g.fillRect(0, 0, 256, 128);
  const pts: [number, number, string][] = [];
  for (let i = 0; i < 12; i++) {
    const lat = i < 2 ? (i ? 118 : 10) : i < 7 ? 44 : 84;
    const lon = i < 2 ? 128 : ((i - (i < 7 ? 2 : 7)) * 256) / 5 + (i < 7 ? 0 : 25.6);
    pts.push([lon, lat, i % 3 === 0 ? CSS.sky : "#0a1532"]);
  }
  for (const [x, y, col] of pts) {
    g.fillStyle = col;
    for (const dx of [-256, 0, 256]) {
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const sx = 1 / Math.max(0.35, Math.sin((y / 128) * Math.PI));
        g.lineTo(x + dx + Math.cos(a) * 13 * sx, y + Math.sin(a) * 13);
      }
      g.closePath();
      g.fill();
    }
  }
  return tex(c);
}

/**
 * AR ring under a player (white, tinted by the material): solid outer ring with a soft glow,
 * four brackets and a dashed inner ring.
 */
export function ringTexture(): CanvasTexture {
  const S = 256, c = canvas(S, S), g = g2d(c), m = S / 2;
  g.strokeStyle = "#fff";
  g.shadowColor = "rgba(255,255,255,0.9)";
  g.shadowBlur = 10;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(m, m, 112, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.beginPath();
    g.arc(m, m, 124, a - 0.22, a + 0.22);
    g.stroke();
  }
  g.shadowBlur = 0;
  // filled disc, faint
  const grd = g.createRadialGradient(m, m, 0, m, m, 110);
  grd.addColorStop(0, "rgba(255,255,255,0.0)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.07)");
  grd.addColorStop(1, "rgba(255,255,255,0.28)");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(m, m, 110, 0, Math.PI * 2);
  g.fill();
  return tex(c, false);
}

/** The rotating dashed inner ring. */
export function dashTexture(): CanvasTexture {
  const S = 256, c = canvas(S, S), g = g2d(c), m = S / 2;
  g.strokeStyle = "#fff";
  g.lineWidth = 4;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    g.beginPath();
    g.arc(m, m, 92, a, a + 0.12);
    g.stroke();
  }
  return tex(c, false);
}

/** Soft dark blob (contact shadow). */
export function blobTexture(): CanvasTexture {
  const c = canvas(64, 64), g = g2d(c);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(0,0,0,0.75)");
  grd.addColorStop(0.5, "rgba(0,0,0,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return tex(c, false);
}

/**
 * Broadcast name tag: a navy pill with the dorsal in gold (Anybody), the name in white (Geist)
 * and the galón chip (Geist Mono). Highlight = gold outline. Returns the canvas aspect (w/h).
 */
export function drawPlate(c: HTMLCanvasElement, p: PlayerSpec, hi: boolean): number {
  const g = g2d(c), H = 88, R = H / 2;
  const name = p.name.toUpperCase();
  const num = String(p.num);
  g.font = `600 44px ${UI}`;
  g.letterSpacing = "1px";
  const nameW = Math.min(330, g.measureText(name).width);
  condensed(g, true);
  g.font = `800 60px ${DISPLAY}`;
  const numW = g.measureText(num).width;
  condensed(g, false);
  const role = p.role ?? "";
  const padL = 30, gap = 16, padR = role ? 16 : 32, chip = role ? 46 : 0;
  const W = Math.ceil(padL + numW + gap + 2 + gap + nameW + (role ? gap + chip : 0) + padR);
  c.width = W + 12;
  c.height = H + 12;
  g.clearRect(0, 0, c.width, c.height);
  g.translate(6, 6);
  // soft drop shadow so the pill separates from the grass
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 8;
  g.fillStyle = hi ? "rgba(10,24,56,0.97)" : "rgba(3,8,23,0.9)";
  g.beginPath();
  g.roundRect(0, 0, W, H, R);
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = hi ? 4 : 2;
  g.strokeStyle = hi ? CSS.gold : "rgba(108,171,221,0.55)";
  g.beginPath();
  g.roundRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth, R);
  g.stroke();
  let x = padL;
  // dorsal
  condensed(g, true);
  g.font = `800 60px ${DISPLAY}`;
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillStyle = CSS.gold;
  g.fillText(num, x, H / 2 + 3);
  condensed(g, false);
  x += numW + gap;
  // divider
  g.fillStyle = "rgba(238,244,255,0.22)";
  g.fillRect(x, H * 0.26, 2, H * 0.48);
  x += 2 + gap;
  // name
  g.font = `600 44px ${UI}`;
  g.fillStyle = "#F4F8FF";
  const natural = g.measureText(name).width;
  g.save();
  g.translate(x, H / 2 + 2);
  g.scale(Math.min(1, nameW / natural), 1);
  g.fillText(name, 0, 0);
  g.restore();
  x += nameW;
  if (role) {
    x += gap;
    g.fillStyle = CSS.gold;
    g.beginPath();
    g.arc(x + chip / 2, H / 2, chip / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#051330";
    g.font = `700 30px ${MONO}`;
    g.letterSpacing = "0px";
    g.textAlign = "center";
    g.fillText(role, x + chip / 2, H / 2 + 2);
  }
  g.letterSpacing = "0px";
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c.width / c.height;
}

/**
 * LED ribbon: one seamless cycle of the messages (gold/sky alternating, Anybody condensed, glow)
 * on a navy LED matrix. The canvas width is set to the cycle so the texture wraps without a seam.
 * Returns the canvas aspect (w/h).
 */
export function drawBoard(c: HTMLCanvasElement, messages: string[], H = 64): number {
  const g = g2d(c);
  const font = `800 ${Math.round(H * 0.64)}px ${DISPLAY}`;
  condensed(g, true);
  g.font = font;
  const base = (messages.length ? messages : ["MANCHESTER PITI"]).map((m) => m.toUpperCase());
  const GAP = H * 0.55, SEP = H * 0.22;
  const cycleOf = (list: string[]) => list.reduce((s, m) => s + g.measureText(m).width + GAP * 2 + SEP, 0);
  let items = base.length % 2 ? [...base, ...base] : base; // even count keeps the colour alternation seamless
  while (cycleOf(items) < 1024) items = [...items, ...items];
  const W = Math.min(4096, Math.ceil(cycleOf(items)));
  c.width = W;
  c.height = H;
  condensed(g, true);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#071433");
  bg.addColorStop(1, "#030817");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(108,171,221,0.10)";
  for (let y = 2; y < H; y += 4) for (let x = 2; x < W; x += 4) g.fillRect(x, y, 2, 2);
  g.font = font;
  g.textBaseline = "middle";
  let x = GAP;
  items.forEach((text, i) => {
    const col = i % 2 === 0 ? CSS.gold : CSS.skyHi;
    g.shadowColor = col;
    g.shadowBlur = H * 0.3;
    g.fillStyle = col;
    g.fillText(text, x, H / 2 + 2);
    g.shadowBlur = 0;
    g.fillText(text, x, H / 2 + 2);
    x += g.measureText(text).width + GAP;
    g.fillStyle = "rgba(238,244,255,0.7)";
    g.beginPath();
    g.arc(x + SEP / 2, H / 2, SEP / 3.2, 0, Math.PI * 2);
    g.fill();
    x += SEP + GAP;
  });
  // bezel lines
  g.fillStyle = "rgba(108,171,221,0.55)";
  g.fillRect(0, 0, W, 2);
  g.fillRect(0, H - 2, W, 2);
  condensed(g, false);
  return W / H;
}

/** Radial pool (white, tinted by the material): floodlight spots and glows on the grass. */
export function poolTexture(): CanvasTexture {
  const c = canvas(256, 256), g = g2d(c);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.7, "rgba(255,255,255,0.15)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return tex(c, false);
}

/** Vertical fade (opaque at the bottom row): LED spill on the grass. */
export function fadeTexture(): CanvasTexture {
  const c = canvas(4, 128), g = g2d(c);
  const grd = g.createLinearGradient(0, 128, 0, 0);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.4, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 128);
  return tex(c, false);
}

/** Ground disc alpha: solid in the middle, fading out into the fogged horizon. */
export function groundFadeTexture(): CanvasTexture {
  const c = canvas(256, 256), g = g2d(c);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.5, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return tex(c, false);
}

/** Seat rows for the stand treads: two rows of sky seat-backs on a dark concrete step. */
export function seatsTexture(): CanvasTexture {
  const c = canvas(256, 64), g = g2d(c);
  g.fillStyle = "#0a1430";
  g.fillRect(0, 0, 256, 64);
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 8; k++) {
      const x = k * 32 + 4, y = 6 + r * 30;
      g.fillStyle = (k + r) % 5 === 0 ? "#2d5f8f" : "#245079";
      g.beginPath();
      g.roundRect(x, y, 24, 20, 5);
      g.fill();
      g.fillStyle = "rgba(159,208,242,0.35)";
      g.fillRect(x + 3, y + 2, 18, 2);
    }
  const t = tex(c);
  t.wrapS = RepeatWrapping;
  return t;
}

export function makeTexture(c: HTMLCanvasElement, srgb = true): Texture {
  return tex(c, srgb);
}
