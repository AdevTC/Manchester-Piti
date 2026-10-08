// /profile › the share image, painted on a <canvas> (no dependencies): «Mi carta» (the tunnel frame with
// the card, front or back with the QR) and the «¡Ya es oficial!» poster (vinculada, pendiente, sin ficha),
// Historia 1080×1920 or Post 1080×1350. A thin layer over shareLayout.ts (the boxes) that repaints the
// design's CSS (pf-g-css.mjs: .pv, .po, .cd, .fc, .cf-*, .cbk-*, .tee) with the same colours, gradients,
// fonts and sizes as the studio's preview, so the file is what the preview shows. The self-hosted fonts
// are loaded first; the crest is the app's own image; the QR is acceso's encoder as a path.
import { qrPath } from "../acceso/qrPath";
import { canvasToBlob, loadImage, roundRect, truncate } from "../pizarra/poster";
import type { BackFace, FrontFace } from "./CardFaces";
import { printClass } from "./fx";
import { archLetters } from "./rules";
import { CARD_SHAPE, cardInner, cartaLayout, posterLayout, PRINT_SIZE, teeBox, type Box, type TeeBox } from "./shareLayout";
import { SHARE_SIZE, type PosterModel, type ShareDesign, type ShareFace, type ShareFormat } from "./share";

export interface ShareSpec {
  design: ShareDesign;
  format: ShareFormat;
  face: ShareFace;
  /** «T1». */
  season: string;
  carta: { tier: string; front: FrontFace; back: BackFace; kicker: string; foot: string };
  poster: PosterModel;
}

type Ctx = CanvasRenderingContext2D;
type Stop = readonly [string, number];

const DISPLAY = "Anybody, Archivo, sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";
const SANS = "Geist, system-ui, sans-serif";
const NAVY = "#0c1733";
const GOLD = "#FFC659";
const INK = "#eef4ff";

// The shirt seen from the back (viewBox 200×210) and its collar, as on the card.
const SHIRT_D = "M62 8 C78 15 122 15 138 8 L190 34 L176 84 L156 76 L156 202 L44 202 L44 76 L24 84 L10 34 Z";
const COLLAR_D = "M62 8 C78 15 122 15 138 8";
// The icons the image needs (icons.tsx draws the same paths in the page).
const ICON_D = {
  star: ["m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"],
  ball: ["M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0Z", "m12 7 4 3-1.5 4.5h-5L8 10Z"],
  team: ["M12.5 8a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0Z", "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6"],
  flame: ["M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7Z"],
  inf: ["M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4Z"],
} as const;
const ICON_SW: Record<keyof typeof ICON_D, number> = { star: 1.8, ball: 1.6, team: 1.8, flame: 1.8, inf: 2 };

// The tiers' colours (.t-racha, .t-oro, .t-plata, .t-bronce, .t-nuevo).
interface Paint {
  rim: Stop[];
  body: { linear: number } | { radial: [number, number, number, number] };
  bodyStops: Stop[];
  rt: string;
  ink: string;
  sub: string;
  line: string;
  rays: string;
  foil: { op: GlobalCompositeOperation; a: number };
}
const RADIAL_BODY: [number, number, number, number] = [1.2, 0.7, 0.62, 0.18];
const TIERS: Record<string, Paint> = {
  racha: {
    rim: [["#fff3cf", 0], [GOLD, 0.22], ["#9fd0f2", 0.46], [GOLD, 0.68], ["#b57e1c", 1]],
    body: { radial: RADIAL_BODY },
    bodyStops: [["#3166bd", 0], ["#13306f", 0.42], ["#060d28", 0.86]],
    rt: GOLD,
    ink: INK,
    sub: "#9fd0f2",
    line: "rgba(255,198,89,.5)",
    rays: "255,198,89,.16",
    foil: { op: "color-dodge", a: 0.2 },
  },
  oro: {
    rim: [["#fff3cf", 0], ["#e9b94f", 0.4], ["#a8761c", 0.72], ["#ffe3a3", 1]],
    body: { linear: 165 },
    bodyStops: [["#ffecb9", 0], ["#f3c860", 0.42], ["#d39b37", 0.78], ["#b07a22", 1]],
    rt: "#241500",
    ink: "#1c1404",
    sub: "#4a3410",
    line: "rgba(60,40,0,.32)",
    rays: "255,255,255,.1",
    foil: { op: "soft-light", a: 0.35 },
  },
  plata: {
    rim: [["#ffffff", 0], ["#b9c4d2", 0.45], ["#7d8a9c", 0.75], ["#eef2f7", 1]],
    body: { linear: 165 },
    bodyStops: [["#f6f9fc", 0], ["#d3dbe6", 0.45], ["#a9b5c5", 1]],
    rt: NAVY,
    ink: NAVY,
    sub: "#33415f",
    line: "rgba(12,23,51,.25)",
    rays: "255,255,255,.1",
    foil: { op: "soft-light", a: 0.35 },
  },
  bronce: {
    rim: [["#ffe1c2", 0], ["#c98b5a", 0.45], ["#7e4c2a", 0.75], ["#f0c49b", 1]],
    body: { linear: 165 },
    bodyStops: [["#f6d2ae", 0], ["#d79a68", 0.45], ["#a8693d", 1]],
    rt: "#2a1406",
    ink: "#2a1406",
    sub: "#5a3216",
    line: "rgba(42,20,6,.3)",
    rays: "255,255,255,.1",
    foil: { op: "soft-light", a: 0.35 },
  },
  nuevo: {
    rim: [["#d4ecfc", 0], ["#6CABDD", 0.4], ["#2a4f86", 0.75], ["#9fd0f2", 1]],
    body: { radial: RADIAL_BODY },
    bodyStops: [["#1d3f84", 0], ["#0e2152", 0.45], ["#060d28", 0.86]],
    rt: "#9fd0f2",
    ink: INK,
    sub: "#9fd0f2",
    line: "rgba(159,208,242,.4)",
    rays: "255,255,255,.1",
    foil: { op: "color-dodge", a: 0.2 },
  },
};
const FIJO_RIM: Stop[] = [["#fff3cf", 0], [GOLD, 0.3], ["#b57e1c", 0.62], ["#ffe3a3", 1]];

// ───────────────────────── helpers ─────────────────────────
const rad = (deg: number) => (deg * Math.PI) / 180;

function stretchOf(wdth: number): CanvasFontStretch {
  if (wdth <= 56) return "ultra-condensed";
  if (wdth <= 69) return "extra-condensed";
  if (wdth <= 81) return "condensed";
  if (wdth <= 94) return "semi-condensed";
  if (wdth <= 106) return "normal";
  if (wdth <= 119) return "semi-expanded";
  return "expanded";
}
/** The font, its width axis (Anybody's wdth through font-stretch) and its letter spacing in px. */
function font(ctx: Ctx, weight: number, size: number, family: string, o: { wdth?: number; ls?: number } = {}) {
  ctx.font = `${weight} ${size.toFixed(2)}px ${family}`;
  if ("fontStretch" in ctx) ctx.fontStretch = stretchOf(o.wdth ?? 100);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(o.ls ?? 0).toFixed(2)}px`;
}
/** Where the baseline goes for a line box of height `lineH` starting at `top` (CSS half-leading). */
function baseline(ctx: Ctx, top: number, lineH: number): number {
  const m = ctx.measureText("ÁHg");
  const size = Number(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 16);
  const asc = m.fontBoundingBoxAscent || size * 0.92;
  const desc = m.fontBoundingBoxDescent || size * 0.24;
  return top + (lineH - (asc + desc)) / 2 + asc;
}
function text(ctx: Ctx, s: string, x: number, top: number, lineH: number, align: CanvasTextAlign = "left") {
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, baseline(ctx, top, lineH));
}
function wrap(ctx: Ctx, s: string, maxW: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function shadow(ctx: Ctx, color: string, blur: number, dy = 0) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy;
}
const noShadow = (ctx: Ctx) => shadow(ctx, "transparent", 0);

/** CSS linear-gradient(<deg>, …) over a box. */
function linear(ctx: Ctx, deg: number, b: Box, stops: readonly Stop[]): CanvasGradient {
  const a = rad(deg);
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(b.w * dx) + Math.abs(b.h * dy)) / 2;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  stops.forEach(([c, p]) => g.addColorStop(p, c));
  return g;
}
/** CSS radial-gradient(<rx%> <ry%> at <cx%> <cy%>, …) filling a box (an ellipse through a scale). */
function radialFill(ctx: Ctx, b: Box, rxP: number, ryP: number, cxP: number, cyP: number, stops: readonly Stop[]) {
  const cx = b.x + b.w * cxP;
  const cy = b.y + b.h * cyP;
  const rx = Math.max(1, b.w * rxP);
  const ry = Math.max(1, b.h * ryP);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  stops.forEach(([c, p]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  const k = rx / ry;
  ctx.fillRect(b.x - cx, (b.y - cy) * k, b.w, b.h * k);
  ctx.restore();
}
function shapePath(ctx: Ctx, b: Box) {
  ctx.beginPath();
  CARD_SHAPE.forEach(([px, py], i) => (i ? ctx.lineTo(b.x + px * b.w, b.y + py * b.h) : ctx.moveTo(b.x + px * b.w, b.y + py * b.h)));
  ctx.closePath();
}
/** A repeating dot grid: lit dots (`holes` = false) or a dark screen with clear holes (an LED mask). */
function dots(ctx: Ctx, cell: number, r: number, color: string, holes: boolean): CanvasPattern | null {
  if (typeof document === "undefined") return null;
  const n = Math.max(2, Math.round(cell));
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const p = c.getContext("2d");
  if (!p) return null;
  p.fillStyle = color;
  if (holes) {
    p.fillRect(0, 0, n, n);
    p.globalCompositeOperation = "destination-out";
    p.fillStyle = "#000";
  }
  p.beginPath();
  p.arc(n / 2, n / 2, Math.max(0.5, r), 0, Math.PI * 2);
  p.fill();
  return ctx.createPattern(c, "repeat");
}
function icon(ctx: Ctx, name: keyof typeof ICON_D, x: number, y: number, size: number, color: string) {
  if (typeof Path2D !== "function") return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = ICON_SW[name];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ICON_D[name].forEach((d) => ctx.stroke(new Path2D(d)));
  ctx.restore();
}
function image(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, size: number, alpha = 1) {
  if (!img) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

// ───────────────────────── the shirt back (.tee) ─────────────────────────
function drawTee(ctx: Ctx, t: TeeBox, print: string, num: string, blank: boolean, drop: { dy: number; blur: number; color: string }) {
  if (typeof Path2D === "function") {
    const k = t.w / 200;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(k, k);
    const g = ctx.createLinearGradient(0, 8, 0, 202);
    g.addColorStop(0, blank ? "#ffffff" : "#e2f2fd");
    g.addColorStop(1, blank ? "#d3deeb" : "#6CABDD");
    shadow(ctx, drop.color, drop.blur, drop.dy);
    ctx.fillStyle = g;
    const body = new Path2D(SHIRT_D);
    ctx.fill(body);
    noShadow(ctx);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke(body);
    ctx.strokeStyle = "rgba(12,23,51,.38)";
    ctx.lineWidth = 5;
    ctx.stroke(new Path2D(COLLAR_D));
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(t.pr.x, t.pr.y, t.pr.w, t.pr.h);
  ctx.clip();
  // the name: vinyl letters on a gentle arch (y = t² · .14 em, rotate t · 5°), auto-shrunk n1–n4
  const letters = archLetters(print);
  if (letters.length) {
    const ps = PRINT_SIZE[printClass(letters.length)];
    const size = ps.em * t.f;
    font(ctx, 800, size, DISPLAY, { wdth: ps.wdth, ls: 0.02 * t.f });
    const widths = letters.map((l) => ctx.measureText(l.c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    // never wider than the print area (where the width axis can't narrow the letters)
    const fit = Math.min(1, t.pr.w / Math.max(1, total));
    let x = t.pr.x + t.pr.w / 2 - (total * fit) / 2;
    ctx.fillStyle = NAVY;
    letters.forEach((l, i) => {
      const w = widths[i] * fit;
      const cy = t.nameBottom - size / 2 + l.y * 0.14 * size;
      ctx.save();
      ctx.translate(x + w / 2, cy);
      ctx.rotate(rad(l.r));
      ctx.scale(fit, 1);
      text(ctx, l.c, 0, -size / 2, size, "center");
      ctx.restore();
      x += w;
    });
  }
  font(ctx, 900, t.numSize, DISPLAY, { wdth: 74, ls: -0.02 * t.numSize });
  ctx.fillStyle = blank ? "rgba(12,23,51,.28)" : NAVY;
  text(ctx, num, t.pr.x + t.pr.w / 2, t.numTop, t.numSize, "center");
  ctx.restore();
}

// ───────────────────────── the card ─────────────────────────
type CardBox = Box & { u: number };

function foil(ctx: Ctx, b: Box, p: Paint) {
  // repeating-linear-gradient(115deg, rainbow every 15 %) on a 220 % box, at rest
  const big = { x: b.x - 0.6 * b.w, y: b.y - 0.6 * b.h, w: 2.2 * b.w, h: 2.2 * b.h };
  const colors = ["rgba(255,94,94,.35)", "rgba(255,231,107,.35)", "rgba(108,255,174,.3)", "rgba(108,200,255,.35)", "rgba(199,140,255,.35)"];
  const stops: Stop[] = [];
  for (let k = 0; k < 7; k++) colors.forEach((c, i) => stops.push([c, Math.min(1, (k * 0.15 + i * 0.03) / 1.05)]));
  ctx.save();
  ctx.globalCompositeOperation = p.foil.op;
  ctx.globalAlpha = p.foil.a;
  ctx.fillStyle = linear(ctx, 115, big, stops);
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}

function rewards(ctx: Ctx, f: FrontFace, cx: number, top: number, u: number) {
  const r = f.rewards;
  type Item = { w: number; h: number; draw: (x: number, y: number) => void };
  const items: Item[] = [];
  const disc = (label: { icon?: keyof typeof ICON_D; text?: string }, em: number): Item => {
    font(ctx, 900, em, DISPLAY, { wdth: 90 });
    const iw = label.icon ? em : 0;
    const tw = label.text ? ctx.measureText(label.text).width : 0;
    const gap = label.icon && label.text ? 0.15 * em : 0;
    const content = iw + gap + tw;
    const pad = label.icon && label.text ? 0.35 * em : 0.2 * em;
    const h = 1.55 * em;
    const w = Math.max(h, content + 2 * pad);
    return {
      w,
      h,
      draw: (x, y) => {
        ctx.save();
        shadow(ctx, "rgba(0,0,0,.35)", 0.35 * u, 0.12 * u);
        const g = ctx.createRadialGradient(x + 0.35 * w, y + 0.3 * h, 0, x + 0.35 * w, y + 0.3 * h, Math.max(w, h));
        g.addColorStop(0, "#fff3cf");
        g.addColorStop(0.55, GOLD);
        g.addColorStop(1, "#b57e1c");
        ctx.fillStyle = g;
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fill();
        ctx.restore();
        let lx = x + (w - content) / 2;
        if (label.icon) {
          icon(ctx, label.icon, lx, y + (h - em) / 2, em, NAVY);
          lx += iw + gap;
        }
        if (label.text) {
          font(ctx, 900, em, DISPLAY, { wdth: 90 });
          ctx.fillStyle = NAVY;
          text(ctx, label.text, lx, y, h, "left");
        }
      },
    };
  };
  if (r.mvp) items.push(disc({ icon: "star" }, u));
  if (r.double) items.push(disc({ text: "×2" }, u));
  if (r.hat) items.push(disc({ icon: "ball" }, u));
  if (r.goleador) items.push(disc({ text: "G" }, u));
  if (r.duo !== null) items.push(disc({ icon: "team", text: r.duo }, 0.9 * u));
  if (!items.length) return;
  // flex-wrap, centred in 5.6 em, .3 em apart
  const maxW = 5.6 * u;
  const gap = 0.3 * u;
  const rows: Item[][] = [[]];
  let used = 0;
  items.forEach((it) => {
    const row = rows[rows.length - 1];
    if (row.length && used + gap + it.w > maxW) {
      rows.push([it]);
      used = it.w;
    } else {
      used += (row.length ? gap : 0) + it.w;
      row.push(it);
    }
  });
  let y = top + 0.15 * u;
  rows.forEach((row) => {
    const w = row.reduce((a, it) => a + it.w, 0) + gap * (row.length - 1);
    const h = Math.max(...row.map((it) => it.h));
    let x = cx - w / 2;
    row.forEach((it) => {
      it.draw(x, y + (h - it.h) / 2);
      x += it.w + gap;
    });
    y += h + gap;
  });
}

function front(ctx: Ctx, I: Box, f: FrontFace, p: Paint, u: number, px: number, crest: HTMLImageElement | null) {
  // the body
  if ("linear" in p.body) {
    ctx.fillStyle = linear(ctx, p.body.linear, I, p.bodyStops);
    ctx.fillRect(I.x, I.y, I.w, I.h);
  } else {
    ctx.fillStyle = p.bodyStops[p.bodyStops.length - 1][0];
    ctx.fillRect(I.x, I.y, I.w, I.h);
    const [rx, ry, cx, cy] = p.body.radial;
    radialFill(ctx, I, rx, ry, cx, cy, [...p.bodyStops, [p.bodyStops[p.bodyStops.length - 1][0], 1]]);
  }
  // the rays: 5° wedges every 13°, fading out from 64 % / 28 %
  {
    const cx = I.x + 0.64 * I.w;
    const cy = I.y + 0.28 * I.h;
    const r = 0.55 * (I.w + I.h) / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${p.rays})`);
    g.addColorStop(0.8, `rgba(${p.rays.replace(/,[^,]+$/, ",0")})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let a = 0; a < 360; a += 13) {
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r * 1.4, rad(a - 90), rad(a - 85));
      ctx.closePath();
    }
    ctx.fill();
  }
  if (f.racha) {
    ctx.save();
    ctx.translate(I.x + I.w / 2, I.y + 0.4 * I.h + 2.5 * u);
    ctx.rotate(rad(-24));
    const band = { x: -0.7 * I.w, y: -2.5 * u, w: 1.4 * I.w, h: 5 * u };
    ctx.fillStyle = linear(ctx, 180, band, [["rgba(255,198,89,0)", 0], ["rgba(255,198,89,.22)", 0.4], ["rgba(159,208,242,.22)", 0.6], ["rgba(159,208,242,0)", 1]]);
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.restore();
  }
  // the shirt (.cf-art) and the captain's armband
  const artX = I.x + I.w - 1.4 * u - 15.6 * u;
  const artY = I.y + 2.4 * u;
  const tf = 1.467 * u;
  drawTee(ctx, teeBox(artX + 7.8 * u - 5 * tf, artY, tf), f.name, f.number, false, { dy: 0.6 * tf, blur: 0.8 * tf, color: "rgba(0,0,0,.35)" });
  if (f.captain) {
    const w = 3.5 * u;
    const h = 2 * u;
    ctx.save();
    ctx.translate(artX + 0.99 * 15.6 * u - w / 2, artY + 0.33 * 15.4 * u + h / 2);
    ctx.rotate(rad(28));
    shadow(ctx, "rgba(0,0,0,.4)", 0.8 * u, 0.3 * u);
    ctx.fillStyle = NAVY;
    roundRect(ctx, -w / 2 - 0.15 * u, -h / 2 - 0.15 * u, w + 0.3 * u, h + 0.3 * u, 0.55 * u);
    ctx.fill();
    noShadow(ctx);
    ctx.fillStyle = linear(ctx, 180, { x: -w / 2, y: -h / 2, w, h }, [["#ffe3a3", 0], [GOLD, 1]]);
    roundRect(ctx, -w / 2, -h / 2, w, h, 0.4 * u);
    ctx.fill();
    font(ctx, 900, 1.45 * u, DISPLAY);
    ctx.fillStyle = NAVY;
    text(ctx, "C", 0, -h / 2, h, "center");
    ctx.restore();
  }
  // the left column: rating, position, rule, crest, rewards
  const cx = I.x + 2.2 * u + 2.8 * u;
  let y = I.y + 2.9 * u;
  font(ctx, 900, 5.4 * u, DISPLAY, { wdth: 78, ls: -0.03 * 5.4 * u });
  ctx.fillStyle = p.rt;
  text(ctx, f.rating, cx, y, 0.8 * 5.4 * u, "center");
  y += 0.8 * 5.4 * u + 0.45 * u;
  font(ctx, 800, 1.75 * u, DISPLAY, { ls: 0.05 * 1.75 * u });
  ctx.fillStyle = p.ink;
  text(ctx, f.pos, cx, y, 1.75 * u, "center");
  y += 1.75 * u + 0.45 * u + 0.15 * u;
  ctx.fillStyle = p.line;
  ctx.fillRect(cx - 1.6 * u, y, 3.2 * u, px);
  y += px + 0.15 * u + 0.45 * u;
  image(ctx, crest, cx - 1.55 * u, y, 3.1 * u);
  y += 3.1 * u + 0.45 * u;
  rewards(ctx, f, cx, y, u);
  // «EN RACHA»
  if (f.racha) {
    const e = 0.95 * u;
    font(ctx, 700, e, MONO, { ls: 0.08 * e });
    const tw = ctx.measureText("EN RACHA").width;
    const h = 1.9 * e;
    const w = 0.7 * e * 2 + 1.2 * e + 0.3 * e + tw;
    const x = I.x + I.w - 2 * u - w;
    const ty = I.y + 1.4 * u;
    ctx.save();
    shadow(ctx, "rgba(255,198,89,.5)", 1 * e, 0.3 * e);
    ctx.fillStyle = linear(ctx, 110, { x, y: ty, w, h }, [[GOLD, 0], ["#ffe3a3", 1]]);
    roundRect(ctx, x, ty, w, h, 0.4 * e);
    ctx.fill();
    ctx.restore();
    icon(ctx, "flame", x + 0.7 * e, ty + (h - 1.2 * e) / 2, 1.2 * e, NAVY);
    ctx.fillStyle = NAVY;
    font(ctx, 700, e, MONO, { ls: 0.08 * e });
    text(ctx, "EN RACHA", x + 0.7 * e + 1.5 * e, ty, h, "left");
  }
  // the name (golden trail for «Primer gol»)
  {
    const size = (f.nmCls === "s" ? 2.2 : f.nmCls === "l" ? 2.55 : 2.9) * u;
    const top = (f.nmCls === "s" ? 18.3 : f.nmCls === "l" ? 18 : 17.7) * u - 0.11 * size;
    const maxW = I.w - 3.2 * u;
    font(ctx, 900, size, DISPLAY, { wdth: 84, ls: -0.005 * size });
    const name = truncate(ctx, f.name, maxW);
    const x = I.x + I.w / 2;
    if (f.rewards.trail)
      (
        [
          [0.15, 0.09, 0.18],
          [0.1, 0.06, 0.35],
          [0.05, 0.03, 0.6],
        ] as const
      ).forEach(([dx, dy, a]) => {
        ctx.fillStyle = `rgba(255,198,89,${a})`;
        text(ctx, name, x - dx * size, I.y + top + dy * size, 1.22 * size, "center");
      });
    ctx.fillStyle = p.ink;
    text(ctx, name, x, I.y + top, 1.22 * size, "center");
  }
  // MANCHESTER PITI · T1 · J1–J7
  font(ctx, 600, 0.92 * u, MONO, { ls: 0.22 * 0.92 * u });
  ctx.fillStyle = p.sub;
  text(ctx, f.club, I.x + I.w / 2, I.y + 20.9 * u, 1.2 * 0.92 * u, "center");
  // the six numbers
  {
    const left = I.x + 3.3 * u;
    const width = I.w - 6.6 * u;
    const top = I.y + 22.9 * u;
    const colW = (width - 2.4 * u) / 2;
    const rowH = 1.85 * u * 1.05;
    ctx.fillStyle = p.line;
    ctx.fillRect(left, top, width, px);
    const rows = Math.ceil(f.attrs.length / 2);
    const bottom = top + 0.9 * u + rows * rowH + (rows - 1) * 0.3 * u;
    ctx.fillRect(left + width / 2 - px / 2, top + 1 * u, px, bottom - 0.2 * u - (top + 1 * u));
    f.attrs.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x0 = left + col * (colW + 2.4 * u);
      const ry = top + 0.9 * u + row * (rowH + 0.3 * u);
      font(ctx, 900, 1.85 * u, DISPLAY, { wdth: 84 });
      const bw = Math.max(2.3 * 1.85 * u, ctx.measureText(a.text).width);
      ctx.fillStyle = p.ink;
      const base = baseline(ctx, ry, rowH);
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(a.text, x0 + bw, base);
      font(ctx, 700, 1.02 * u, MONO, { ls: 0.08 * 1.02 * u });
      ctx.fillStyle = p.sub;
      ctx.textAlign = "left";
      ctx.fillText(a.k, x0 + bw + 0.45 * u, base);
    });
  }
  image(ctx, crest, I.x + I.w / 2 - 0.95 * u, I.y + I.h - 1.25 * u - 1.9 * u, 1.9 * u, 0.9);
  // the twinkles of «En racha»
  if (f.racha)
    (
      [
        [0.12, 0.58, 1.3],
        [0.8, 0.12, 1.3],
        [0.7, 0.52, 0.9],
        [0.28, 0.08, 0.8],
      ] as const
    ).forEach(([fx, fy, e]) => {
      const s = e * u;
      ctx.save();
      ctx.translate(I.x + fx * I.w + s / 2, I.y + fy * I.h + s / 2);
      ctx.rotate(rad(45));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      (
        [
          [0, -0.5],
          [0.1, -0.1],
          [0.5, 0],
          [0.1, 0.1],
          [0, 0.5],
          [-0.1, 0.1],
          [-0.5, 0],
          [-0.1, -0.1],
        ] as const
      ).forEach(([qx, qy], k) => (k ? ctx.lineTo(qx * s, qy * s) : ctx.moveTo(qx * s, qy * s)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  foil(ctx, I, p);
}

function back(ctx: Ctx, I: Box, b: BackFace, u: number, px: number, crest: HTMLImageElement | null) {
  ctx.fillStyle = "#050b22";
  ctx.fillRect(I.x, I.y, I.w, I.h);
  radialFill(ctx, I, 1.2, 0.7, 0.5, 0, [["#1d3f84", 0], ["#0b1a44", 0.5], ["#050b22", 1]]);
  const pat = dots(ctx, 0.7 * u, 1.3 * px, "rgba(159,208,242,.12)", false);
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(I.x, I.y, I.w, I.h);
  }
  image(ctx, crest, I.x + I.w + 4 * u - 20 * u, I.y + 6 * u, 20 * u, 0.07);
  // the header: crest, CARNÉ DE SOCIO and the name
  const hx = I.x + 2.2 * u;
  const hw = I.w - 4.4 * u;
  const hy = I.y + 2.4 * u;
  image(ctx, crest, hx, hy, 3.2 * u);
  const tx = hx + 4 * u;
  const colH = 0.86 * u * 1.2 + 0.2 * 0.86 * u + 1.95 * u;
  const ty = hy + (3.2 * u - colH) / 2;
  font(ctx, 600, 0.86 * u, MONO, { ls: 0.16 * 0.86 * u });
  ctx.fillStyle = "#9fd0f2";
  text(ctx, "CARNÉ DE SOCIO", tx, ty, 0.86 * u * 1.2);
  font(ctx, 900, 1.95 * u, DISPLAY, { wdth: 86 });
  ctx.fillStyle = INK;
  text(ctx, truncate(ctx, b.name, hx + hw - tx), tx, ty + 0.86 * u * 1.2 + 0.2 * 0.86 * u, 1.95 * u);
  ctx.fillStyle = "rgba(255,198,89,.4)";
  ctx.fillRect(hx, hy + 3.2 * u + 0.9 * u, hw, px);
  // the rows: Socio desde · Cómo entraste · Te abrió · Caducidad
  let y = I.y + 8.2 * u;
  const ddX = hx + 7.6 * u + 0.6 * u;
  const ddW = hx + hw - ddX;
  const ddSize = 1.18 * u;
  const ddLH = 1.2 * ddSize;
  const rowsData: { dt: string; dd: string; inf?: boolean }[] = [
    { dt: "Socio desde", dd: b.since },
    { dt: "Cómo entraste", dd: b.howIn },
    { dt: "Te abrió", dd: b.whoOpened },
    { dt: "Caducidad", dd: "No caduca", inf: true },
  ];
  rowsData.forEach((r) => {
    font(ctx, 700, ddSize, SANS);
    const lines = r.inf ? [r.dd] : wrap(ctx, r.dd, ddW);
    const base = baseline(ctx, y, ddLH);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (r.inf) {
      const is = 1.3 * ddSize;
      icon(ctx, "inf", ddX, y + (ddLH - is) / 2, is, GOLD);
      ctx.fillStyle = GOLD;
      ctx.fillText(r.dd, ddX + is + 0.3 * ddSize, base);
    } else {
      ctx.fillStyle = INK;
      lines.forEach((l, k) => ctx.fillText(l, ddX, base + k * ddLH));
    }
    font(ctx, 600, 0.82 * u, MONO, { ls: 0.1 * 0.82 * u });
    ctx.fillStyle = "#9fb3d3";
    ctx.fillText(r.dt.toLocaleUpperCase("es-ES"), hx, base);
    y += lines.length * ddLH + 0.5 * u;
    ctx.save();
    ctx.strokeStyle = "rgba(159,208,242,.2)";
    ctx.lineWidth = px;
    ctx.setLineDash([3 * px, 3 * px]);
    ctx.beginPath();
    ctx.moveTo(hx, y + px / 2);
    ctx.lineTo(hx + hw, y + px / 2);
    ctx.stroke();
    ctx.restore();
    y += px + 0.55 * u;
  });
  // the QR to /jugadores/:id (white ring .3 em, corners .4 em)
  const q = 5.4 * u;
  const qx = I.x + I.w / 2 - q / 2;
  const qy = I.y + I.h - 2.4 * u - q;
  ctx.fillStyle = "#fff";
  roundRect(ctx, qx - 0.3 * u, qy - 0.3 * u, q + 0.6 * u, q + 0.6 * u, 0.7 * u);
  ctx.fill();
  if (typeof Path2D === "function" && b.url) {
    const { d, n } = qrPath(b.url);
    const cell = q / (n + 4);
    ctx.save();
    ctx.translate(qx + 2 * cell, qy + 2 * cell);
    ctx.scale(cell, cell);
    ctx.fillStyle = NAVY;
    ctx.fill(new Path2D(d));
    ctx.restore();
  }
}

function drawCard(ctx: Ctx, card: CardBox, spec: ShareSpec, px: number, crest: HTMLImageElement | null) {
  const p = TIERS[spec.carta.tier] ?? TIERS.nuevo;
  const f = spec.carta.front;
  const isFront = spec.face === "frente";
  const fijo = isFront && f.rewards.fijo;
  ctx.save();
  shapePath(ctx, card);
  ctx.clip();
  ctx.fillStyle = linear(ctx, 140, card, fijo ? FIJO_RIM : p.rim);
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.restore();
  const I = cardInner(card, fijo);
  ctx.save();
  shapePath(ctx, I);
  ctx.clip();
  if (isFront) front(ctx, I, f, p, card.u, px, crest);
  else back(ctx, I, spec.carta.back, card.u, px, crest);
  ctx.restore();
}

// ───────────────────────── «Mi carta» ─────────────────────────
function drawCarta(ctx: Ctx, spec: ShareSpec, crest: HTMLImageElement | null) {
  const L = cartaLayout(spec.format, spec.face);
  const full = { x: 0, y: 0, w: L.w, h: L.h };
  ctx.fillStyle = "#02050f";
  ctx.fillRect(0, 0, L.w, L.h);
  radialFill(ctx, full, 0.8, 0.5, 0.5, 0.4, [["#1b3c80", 0], ["#0a1a42", 0.5], ["#02050f", 1]]);
  // the tunnel's LED walls
  const grid = dots(ctx, 4 * L.s, 1.25 * L.s, "rgba(2,4,11,.9)", true);
  [L.walls.l, L.walls.r].forEach((w) => {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(w.near, w.top);
    ctx.lineTo(w.far, w.farTop);
    ctx.lineTo(w.far, w.farBottom);
    ctx.lineTo(w.near, w.bottom);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 180, full, [["#14357a", 0], ["#3a2a08", 0.7], ["#07112c", 1]]);
    ctx.fillRect(0, 0, L.w, L.h);
    if (grid) {
      ctx.fillStyle = grid;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    ctx.restore();
  });
  // the light beam
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const bm = L.beam;
  ctx.beginPath();
  ctx.moveTo(bm.x + 0.42 * bm.w, 0);
  ctx.lineTo(bm.x + 0.58 * bm.w, 0);
  ctx.lineTo(bm.x + bm.w, bm.h);
  ctx.lineTo(bm.x, bm.h);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 180, { x: bm.x, y: 0, w: bm.w, h: bm.h }, [["rgba(255,246,214,.5)", 0], ["rgba(255,246,214,0)", 1]]);
  ctx.fill();
  ctx.restore();
  // the top bar
  const t = L.top;
  image(ctx, crest, t.x, t.y, t.crest);
  font(ctx, 600, t.size, MONO, { ls: 0.14 * t.size });
  ctx.fillStyle = "#c9d8ef";
  text(ctx, "MANCHESTER PITI", t.x + t.crest + 6 * L.s, t.y, t.crest);
  text(ctx, spec.season, t.right, t.y, t.crest, "right");
  // «MI CARTA · T1» / «SOCIO DEL CLUB»
  font(ctx, 900, L.kicker.size, DISPLAY, { wdth: 110 });
  ctx.save();
  shadow(ctx, "rgba(255,198,89,.6)", 14 * L.s);
  ctx.fillStyle = GOLD;
  text(ctx, spec.carta.kicker.toLocaleUpperCase("es-ES"), L.w / 2, L.kicker.y, 0.9 * L.kicker.size, "center");
  ctx.restore();
  // the light pool and the card on it
  const pd = L.ped;
  const pedBox = { x: pd.cx - pd.rx, y: pd.cy - pd.ry, w: 2 * pd.rx, h: 2 * pd.ry };
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(pd.cx, pd.cy, pd.rx, pd.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  radialFill(ctx, pedBox, 0.5, 0.5, 0.5, 0.5, [["rgba(255,214,130,.7)", 0], ["rgba(255,198,89,.2)", 0.6], ["rgba(255,198,89,0)", 1]]);
  ctx.strokeStyle = "rgba(255,198,89,.7)";
  ctx.lineWidth = 3 * L.s;
  ctx.beginPath();
  ctx.ellipse(pd.cx, pd.cy, pd.rx, pd.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawCard(ctx, L.card, spec, L.s, crest);
  // the page it leads to
  font(ctx, 600, L.foot.size, MONO, { ls: 0.06 * L.foot.size });
  ctx.fillStyle = "#9fb3d3";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(truncate(ctx, spec.carta.foot, L.w - 2 * L.foot.x), L.foot.x, L.foot.y - 0.3 * L.foot.size);
}

// ───────────────────────── «¡Ya es oficial!» ─────────────────────────
const LED: Record<PosterModel["tone"], { c: string; g: string }> = {
  ok: { c: GOLD, g: "rgba(255,198,89,.55)" },
  warn: { c: "#ffb547", g: "rgba(255,181,71,.55)" },
  off: { c: "#9fd0f2", g: "rgba(108,171,221,.55)" },
};

function drawPoster(ctx: Ctx, spec: ShareSpec, crest: HTMLImageElement | null) {
  const m = spec.poster;
  const L = posterLayout(spec.format, { long: m.long, nmCls: m.nmCls });
  const { E, pad } = L;
  const full = { x: 0, y: 0, w: L.w, h: L.h };
  // the night: blue glow, the grass at the bottom, a dot screen
  ctx.fillStyle = "#030817";
  ctx.fillRect(0, 0, L.w, L.h);
  radialFill(ctx, full, 0.7, 0.4, 0.5, 0.3, [["#1d3f84", 0], ["#0a1a42", 0.55], ["#030817", 0.88], ["#030817", 1]]);
  ctx.fillStyle = linear(ctx, 180, { x: 0, y: 0.7 * L.h, w: L.w, h: 0.3 * L.h }, [["rgba(28,104,56,0)", 0], ["rgba(28,104,56,.5)", 1]]);
  ctx.fillRect(0, 0.7 * L.h, L.w, 0.3 * L.h);
  const bg = dots(ctx, 0.6 * E, 0.13 * E, "rgba(159,208,242,.12)", false);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, L.w, L.h);
  }
  // two floodlight beams
  ([-1, 1] as const).forEach((side) => {
    const bw = 0.6 * L.w;
    const bh = 1.2 * L.h;
    const bx = side < 0 ? -0.18 * L.w : L.w + 0.18 * L.w - bw;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(bx + bw / 2, -0.1 * L.h);
    ctx.rotate(rad(24 * side));
    ctx.beginPath();
    ctx.moveTo(-0.05 * bw, 0);
    ctx.lineTo(0.05 * bw, 0);
    ctx.lineTo(bw / 2, bh);
    ctx.lineTo(-bw / 2, bh);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 180, { x: -bw / 2, y: 0, w: bw, h: bh }, [["rgba(225,238,255,.28)", 0], ["rgba(225,238,255,0)", 0.7]]);
    ctx.fill();
    ctx.restore();
  });
  // the crest bar
  image(ctx, crest, pad, L.top.y, L.top.crest);
  font(ctx, 600, L.top.size, MONO, { ls: 0.14 * L.top.size });
  ctx.fillStyle = INK;
  text(ctx, "MANCHESTER PITI", pad + L.top.crest + 0.6 * E, L.top.y, L.top.crest);
  ctx.fillStyle = GOLD;
  text(ctx, spec.season, L.w - pad, L.top.y, L.top.crest, "right");
  // the LED board headline
  const vb = L.vb;
  const led = LED[m.tone];
  ctx.save();
  shadow(ctx, led.g, 2.4 * E, 1 * E);
  ctx.fillStyle = "#02040b";
  roundRect(ctx, vb.x + E, vb.y + E, vb.w - 2 * E, vb.h - 2 * E, 0.6 * E);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(159,208,242,.3)";
  roundRect(ctx, vb.x - 0.32 * E, vb.y - 0.32 * E, vb.w + 0.64 * E, vb.h + 0.64 * E, 0.92 * E);
  ctx.fill();
  ctx.fillStyle = "#0e1a3a";
  roundRect(ctx, vb.x - 0.25 * E, vb.y - 0.25 * E, vb.w + 0.5 * E, vb.h + 0.5 * E, 0.85 * E);
  ctx.fill();
  ctx.save();
  roundRect(ctx, vb.x, vb.y, vb.w, vb.h, 0.6 * E);
  ctx.clip();
  ctx.fillStyle = "#02040b";
  ctx.fillRect(vb.x, vb.y, vb.w, vb.h);
  font(ctx, 900, vb.led, DISPLAY, { wdth: 84, ls: 0.02 * vb.led });
  ctx.fillStyle = led.c;
  [m.l1, m.l2].forEach((l, i) => {
    shadow(ctx, led.g, 0.4 * vb.led);
    text(ctx, l, vb.x + vb.padX, vb.lines[i], vb.lineH);
    shadow(ctx, led.c, 0.12 * vb.led);
    text(ctx, l, vb.x + vb.padX, vb.lines[i], vb.lineH);
  });
  noShadow(ctx);
  const mask = dots(ctx, 0.34 * E, 0.13 * E, "rgba(2,4,11,.62)", true);
  if (mask) {
    ctx.fillStyle = mask;
    ctx.fillRect(vb.x, vb.y, vb.w, vb.h);
  }
  ctx.restore();
  // the shirt over the crest watermark
  const fg = L.fig;
  image(ctx, crest, fg.cx - fg.crest / 2, fg.cy - fg.crest / 2, fg.crest, 0.16);
  drawTee(ctx, fg.tee, m.print, m.num, m.blank, { dy: 0.5 * fg.tee.f, blur: 0.8 * fg.tee.f, color: "rgba(0,0,0,.45)" });
  // the big name and its line
  font(ctx, 900, L.name.size, DISPLAY, { wdth: 84 });
  ctx.fillStyle = INK;
  text(ctx, truncate(ctx, m.name, L.w - 2 * pad), pad, L.name.top + 0.14 * L.name.size, L.name.lineH);
  font(ctx, 600, L.line.size, MONO, { ls: 0.12 * L.line.size });
  ctx.fillStyle = GOLD;
  text(ctx, truncate(ctx, m.line, L.w - 2 * pad), pad, L.line.top, L.line.lineH);
  // the foot: the outline dorsal and «PRESENTADO EL …»
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(pad, L.ft.border, L.w - 2 * pad, Math.max(1, E / 10));
  font(ctx, 900, L.ft.numSize, DISPLAY, { wdth: 70 });
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.15 * E;
  ctx.lineJoin = "round";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.strokeText(m.num, pad, baseline(ctx, L.ft.numBottom - 0.8 * L.ft.numSize, 0.8 * L.ft.numSize));
  font(ctx, 400, L.ft.textSize, MONO, { ls: 0.1 * L.ft.textSize });
  ctx.fillStyle = "#b8c8e2";
  text(ctx, "PRESENTADO EL", L.w - pad, L.ft.textLines[0], L.ft.textSize * 1.2, "right");
  text(ctx, m.presented, L.w - pad, L.ft.textLines[1], L.ft.textSize * 1.2, "right");
}

// ───────────────────────── the file ─────────────────────────
async function fontsReady(sample: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    const faces = ["900 100px Anybody", "800 100px Anybody", "600 40px 'Geist Mono'", "700 40px 'Geist Mono'", "400 40px 'Geist Mono'", "700 40px Geist"];
    await Promise.all(faces.map((f) => document.fonts.load(f, sample)));
    await document.fonts.ready;
  } catch {
    /* the fallback fonts still draw it */
  }
}

let crestP: Promise<HTMLImageElement | null> | null = null;
/** The club's crest at 512 px (a slow or missing image never holds the file back). */
function crestImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  crestP ??= Promise.race([loadImage("/crest.png"), new Promise<null>((r) => window.setTimeout(() => r(null), 3000))]).then((img) => {
    if (!img) crestP = null;
    return img;
  });
  return crestP;
}

/** Paints the spec on `canvas` (resized to the format). False where the canvas can't draw. */
export async function drawShare(canvas: HTMLCanvasElement, spec: ShareSpec): Promise<boolean> {
  const { w, h } = SHARE_SIZE[spec.format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const f = spec.carta.front;
  const sample = [f.name, f.pos, f.club, f.rating, spec.carta.kicker, spec.carta.back.howIn, spec.carta.back.whoOpened, spec.poster.name, spec.poster.line, spec.poster.l1, spec.poster.l2, "CARNÉ DE SOCIO ÁÉÍÓÚÜÑ×0123456789"].join(" ");
  const [crest] = await Promise.all([crestImage(), fontsReady(sample)]);
  ctx.clearRect(0, 0, w, h);
  if (spec.design === "carta") drawCarta(ctx, spec, crest);
  else drawPoster(ctx, spec, crest);
  return true;
}

/** The spec as a PNG (null where the canvas can't draw). */
export async function shareBlob(spec: ShareSpec): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ok = await drawShare(canvas, spec);
  return ok ? canvasToBlob(canvas) : null;
}
