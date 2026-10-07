// La pizarra «Noche de partido» — the cartel for the team's group: «LOS SIETE» under the floodlights,
// the system mowed into the grass, the química as light between the cromos, the crest and the score.
// The layout is pure (the sheet's preview and the PNG read the same spots); the drawing reuses the
// old poster's canvas helpers (poster.ts) on a 1080×1350 canvas.
import type { Lineup } from "../formations";
import { canvasToBlob, loadImage, roundRect, truncate } from "../poster";
import { CREST } from "./icons";
import { slotPos } from "./geometry";
import { galonesOf, type Squad } from "./model";
import { tierOf, type Chem } from "./quimica";

export const CARTEL_W = 1080;
export const CARTEL_H = 1350;
/** The pitch inside the cartel (px). */
export const PITCH_BOX = { x: 72, y: 236, w: 936, h: 912 };

export interface CartelCromo {
  id: string;
  num: number;
  name: string;
  rt: number;
  gk: boolean;
  gal: string[];
  /** In % of the pitch box, as the preview draws them. */
  x: number;
  y: number;
}
export interface CartelLink {
  key: string;
  a: [number, number];
  b: [number, number];
  t: 1 | 2 | 3;
}
export interface Cartel {
  /** «J8 · MAD SKY · 2-3-1». */
  kick: string;
  sys: string;
  qv: number;
  tier: string;
  cromos: CartelCromo[];
  links: CartelLink[];
  aria: string;
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Where everything goes, as designed: across = u, along = 6 + v × 0.86 (% of the pitch box). */
export function cartelLayout(L: Lineup, sq: Squad, ch: Chem, matchShort: string | null, seasonName: string): Cartel {
  const sys = L.freeMode ? "LIBRE" : L.formation;
  const at = new Map<number, [number, number]>();
  const cromos: CartelCromo[] = [];
  L.slots.forEach((s, i) => {
    const c = s.playerId ? sq.byId.get(s.playerId) : undefined;
    if (!c) return;
    const p = slotPos(L, i);
    const x = +clamp(p.u, 7, 93).toFixed(1);
    const y = +clamp(6 + p.v * 0.86, 8, 86).toFixed(1);
    at.set(i, [x, y]);
    cromos.push({ id: c.id, num: c.num, name: c.name, rt: c.rt, gk: i === 0, gal: galonesOf(L, c.id).map((g) => g.letter), x, y });
  });
  const links: CartelLink[] = [];
  ch.links.forEach((l) => {
    const a = at.get(l.i);
    const b = at.get(l.j);
    if (a && b) links.push({ key: l.a + "|" + l.b, a, b, t: l.t });
  });
  const kick = (matchShort ?? seasonName) + " · " + sys;
  const [tier] = tierOf(ch.v);
  const aria = "Cartel: los siete de " + (matchShort ?? seasonName) + ", " + sys + ", química " + ch.v + (cromos.length ? ": " + cromos.map((c) => c.num + " " + c.name).join(", ") : ": sin cromos todavía");
  return { kick, sys, qv: ch.v, tier, cromos, links, aria };
}

/** «pizarra-j8-mad-sky.png». */
export function cartelFile(name: string): string {
  const slug = name
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return "pizarra-" + (slug || "los-siete") + ".png";
}

const NAVY = "#0c1733";
const GOLD = "#FFC659";
const SKY = "#9fd0f2";
const INK = "#eef4ff";
const DISPLAY = "'Anybody', 'Archivo', sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";

type Ctx = CanvasRenderingContext2D;

async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([document.fonts.load("900 80px Anybody"), document.fonts.load("800 30px Anybody"), document.fonts.load("600 28px 'Geist Mono'")]);
    await document.fonts.ready;
  } catch {
    /* the fallback fonts still draw it */
  }
}

/** Narrower letters for the display font where the canvas can do it (Anybody is a width axis). */
function narrow(ctx: Ctx, on: boolean) {
  const c = ctx as Ctx & { fontStretch?: string };
  if ("fontStretch" in c) c.fontStretch = on ? "condensed" : "normal";
}

function stadium(ctx: Ctx) {
  const bg = ctx.createRadialGradient(CARTEL_W / 2, 0, 40, CARTEL_W / 2, 0, CARTEL_H * 0.8);
  bg.addColorStop(0, "#1d3f84");
  bg.addColorStop(0.7, "#071230");
  bg.addColorStop(1, "#040a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARTEL_W, CARTEL_H);
  // the crowd: a field of tiny lights in the stands
  for (let i = 0; i < 260; i++) {
    const x = (i * 197) % CARTEL_W;
    const y = 30 + ((i * 89) % 190);
    ctx.fillStyle = `rgba(214,236,252,${0.05 + ((i * 7) % 10) / 90})`;
    ctx.fillRect(x, y, 3, 3);
  }
  // floodlight beams from both corners
  [-1, 1].forEach((side) => {
    const x0 = side < 0 ? 40 : CARTEL_W - 40;
    const g = ctx.createLinearGradient(x0, 0, CARTEL_W / 2, CARTEL_H * 0.7);
    g.addColorStop(0, "rgba(255,255,255,.16)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, -10);
    ctx.lineTo(CARTEL_W / 2 + side * -60, CARTEL_H * 0.75);
    ctx.lineTo(CARTEL_W / 2 + side * 260, CARTEL_H * 0.75);
    ctx.closePath();
    ctx.fill();
  });
}

function pitch(ctx: Ctx, sys: string) {
  const { x, y, w, h } = PITCH_BOX;
  ctx.save();
  roundRect(ctx, x, y, w, h, 40);
  ctx.clip();
  // mowed stripes
  for (let k = 0; k < 10; k++) {
    ctx.fillStyle = k % 2 ? "#0e4e33" : "#12603f";
    ctx.fillRect(x, y + (h * k) / 10, w, h / 10 + 1);
  }
  // floodlight pools on the grass
  [[0.2, 0.22], [0.8, 0.22], [0.2, 0.78], [0.8, 0.78]].forEach(([px, py]) => {
    const cx = x + w * px;
    const cy = y + h * py;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.34);
    g.addColorStop(0, "rgba(255,255,255,.10)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  });
  // the system, mowed into the grass
  ctx.font = `900 ${Math.round(w * 0.3)}px ${DISPLAY}`;
  narrow(ctx, true);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(238,246,255,.13)";
  ctx.strokeText(sys, x + w / 2, y + h * 0.37);
  narrow(ctx, false);
  // the lines
  ctx.strokeStyle = "rgba(238,246,255,.55)";
  ctx.lineWidth = 4;
  const ix = x + 26;
  const iy = y + 26;
  const iw = w - 52;
  const ih = h - 52;
  ctx.strokeRect(ix, iy, iw, ih);
  ctx.beginPath();
  ctx.moveTo(ix, iy + ih / 2);
  ctx.lineTo(ix + iw, iy + ih / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ix + iw / 2, iy + ih / 2, iw * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  const box = (top: boolean) => {
    const bw = iw * 0.56;
    const bh = ih * 0.15;
    ctx.strokeRect(ix + (iw - bw) / 2, top ? iy : iy + ih - bh, bw, bh);
    const gw = iw * 0.24;
    const gh = ih * 0.05;
    ctx.strokeRect(ix + (iw - gw) / 2, top ? iy : iy + ih - gh, gw, gh);
  };
  box(true);
  box(false);
  ctx.restore();
  ctx.strokeStyle = "rgba(238,246,255,.5)";
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, 40);
  ctx.stroke();
}

const px = (p: [number, number]): [number, number] => [PITCH_BOX.x + (p[0] / 100) * PITCH_BOX.w, PITCH_BOX.y + (p[1] / 100) * PITCH_BOX.h];

function lights(ctx: Ctx, links: CartelLink[]) {
  links.forEach((l) => {
    const [ax, ay] = px(l.a);
    const [bx, by] = px(l.b);
    ctx.save();
    ctx.lineCap = "round";
    if (l.t === 3) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 8;
      ctx.shadowColor = "rgba(255,198,89,.9)";
      ctx.shadowBlur = 22;
    } else if (l.t === 2) {
      ctx.strokeStyle = SKY;
      ctx.lineWidth = 6;
      ctx.shadowColor = "rgba(108,171,221,.85)";
      ctx.shadowBlur = 16;
    } else {
      ctx.strokeStyle = "rgba(214,226,245,.7)";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 12]);
    }
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  });
}

function cromo(ctx: Ctx, c: CartelCromo) {
  const [cx, cy] = px([c.x, c.y]);
  const w = 112;
  const h = 132;
  const x = cx - w / 2;
  const y = cy - h / 2 - 14;
  ctx.save();
  // shadow on the grass
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(cx, y + h + 8, w * 0.46, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // the card
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (c.gk) {
    g.addColorStop(0, "#fff3cf");
    g.addColorStop(1, GOLD);
  } else {
    g.addColorStop(0, "#d4ecfc");
    g.addColorStop(1, "#6CABDD");
  }
  ctx.shadowColor = c.gk ? "rgba(255,198,89,.7)" : "rgba(108,171,221,.7)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,198,89,.75)";
  ctx.lineWidth = 3;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 17);
  ctx.stroke();
  // form rating, top left
  ctx.fillStyle = NAVY;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `700 22px ${MONO}`;
  ctx.fillText(String(c.rt), x + 12, y + 10);
  // the dorsal
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 64px ${DISPLAY}`;
  narrow(ctx, true);
  ctx.fillText(String(c.num), cx, y + h * 0.58);
  narrow(ctx, false);
  // the name plate under the card
  ctx.font = `800 26px ${DISPLAY}`;
  const name = truncate(ctx, c.name, 210);
  const nw = Math.max(80, ctx.measureText(name).width + 28);
  ctx.fillStyle = "rgba(6,13,34,.88)";
  roundRect(ctx, cx - nw / 2, y + h + 14, nw, 40, 20);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(name, cx, y + h + 35);
  // galones
  c.gal.forEach((l, k) => {
    const gx = x + w - 6 - k * 34;
    const gy = y - 4;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(gx, gy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = `900 20px ${DISPLAY}`;
    ctx.fillText(l, gx, gy + 1);
  });
  ctx.restore();
}

/** Draw the cartel on `canvas` (1080×1350). */
export async function drawCartel(canvas: HTMLCanvasElement, d: Cartel, crest: HTMLImageElement | null): Promise<boolean> {
  canvas.width = CARTEL_W;
  canvas.height = CARTEL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  await fontsReady();
  stadium(ctx);
  // the gold frame
  ctx.strokeStyle = "rgba(255,198,89,.5)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, CARTEL_W - 36, CARTEL_H - 36, 56);
  ctx.stroke();
  // header: crest, the match and the system, LOS SIETE
  if (crest) ctx.drawImage(crest, 64, 60, 128, 128);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText(truncate(ctx, d.kick.toUpperCase(), 800), crest ? 216 : 64, 104);
  ctx.fillStyle = INK;
  ctx.font = `900 104px ${DISPLAY}`;
  narrow(ctx, true);
  ctx.fillText("LOS SIETE", crest ? 210 : 60, 196);
  narrow(ctx, false);
  pitch(ctx, d.sys);
  lights(ctx, d.links);
  d.cromos
    .slice()
    .sort((a, b) => a.y - b.y)
    .forEach((c) => cromo(ctx, c));
  // footer: the química and the board
  const fy = CARTEL_H - 72;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c9d8ef";
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText("QUÍMICA", 72, fy);
  const qw = ctx.measureText("QUÍMICA ").width;
  ctx.fillStyle = GOLD;
  ctx.font = `900 76px ${DISPLAY}`;
  ctx.shadowColor = "rgba(255,198,89,.7)";
  ctx.shadowBlur = 18;
  ctx.fillText(String(d.qv), 72 + qw, fy + 6);
  ctx.shadowBlur = 0;
  const vw = ctx.measureText(String(d.qv)).width;
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${DISPLAY}`;
  ctx.fillText(d.tier.toUpperCase(), 72 + qw + vw + 18, fy);
  ctx.textAlign = "right";
  ctx.fillStyle = "#c9d8ef";
  ctx.font = `600 28px ${MONO}`;
  ctx.fillText("LA PIZARRA · MANCHESTER PITI", CARTEL_W - 72, fy);
  return true;
}

let crestP: Promise<HTMLImageElement | null> | null = null;
/** The crest for the cartel, loaded once (a slow or missing image never holds the cartel back). */
export function crestImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  crestP ??= Promise.race([loadImage(CREST), new Promise<null>((r) => window.setTimeout(() => r(null), 3000))]).then((img) => {
    if (!img) crestP = null;
    return img;
  });
  return crestP;
}

/** The cartel as a PNG (null where the canvas can't draw). */
export async function cartelBlob(d: Cartel, crest: HTMLImageElement | null): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ok = await drawCartel(canvas, d, crest);
  return ok ? canvasToBlob(canvas) : null;
}

/** Save a file on this device. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ShareResult = "shared" | "downloaded" | "cancelled";

/** To the group: the system share sheet with the PNG where it can take files, else a download. */
export async function shareCartel(blob: Blob, filename: string, title: string, text: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = typeof File === "function" ? new File([blob], filename, { type: "image/png" }) : null;
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title, text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      /* the share sheet failed: fall back to the download */
    }
  }
  download(blob, filename);
  return "downloaded";
}
