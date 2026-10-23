// /profile › «Tu temporada en 10 cromos»: each card as a 1080×1920 image, painted on a <canvas> (no
// dependencies). The look is the share studio's «¡Ya es oficial!» night (shareDraw.ts: the navy glow, the
// dot screen, the crest bar, Anybody for the big number, Geist Mono for the labels), in the site's two
// themes. The faces are loaded first, as matchPoster does. The layout and the words are pure
// (recapLayout, recapText) so they are tested without a canvas.
import { POSITIONS, isPosCode } from "../../lib/positions";
import { fmtMinutes } from "../../lib/derived/minutes";
import type { RecapCard } from "../../lib/derived/seasonRecap";
import { canvasToBlob, loadImage, truncate } from "../pizarra/poster";

export type RecapTheme = "dark" | "light";
export interface RecapDrawCtx {
  theme: RecapTheme;
  /** The member's shirt (the crest bar's right side). */
  shirt: { name: string; number: string };
}

export const RECAP_SIZE = { w: 1080, h: 1920 } as const;

const DISPLAY = "Anybody, Archivo, sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";
const SANS = "Geist, system-ui, sans-serif";

export interface RecapPalette {
  bg: string;
  glow: [string, string, string];
  dots: string;
  ink: string;
  accent: string;
  /** The accent's halo on the big number (transparent in light). */
  halo: string;
  muted: string;
  rule: string;
  pitch: string;
  pitchLine: string;
}
/** Night (the poster's navy and gold) and day (the Celeste sky, navy ink: never cream). */
export const RECAP_PALETTE: Record<RecapTheme, RecapPalette> = {
  dark: {
    bg: "#030817",
    glow: ["#1d3f84", "#0a1a42", "#030817"],
    dots: "rgba(159,208,242,.12)",
    ink: "#eef4ff",
    accent: "#FFC659",
    halo: "rgba(255,198,89,.45)",
    muted: "#c9d8ef",
    rule: "rgba(255,198,89,.55)",
    pitch: "rgba(28,104,56,.45)",
    pitchLine: "rgba(238,244,255,.35)",
  },
  light: {
    bg: "#e4f0fb",
    glow: ["#ffffff", "#d3e7f8", "#bcd8f1"],
    dots: "rgba(12,23,51,.07)",
    ink: "#0c1733",
    accent: "#174a8b",
    halo: "rgba(0,0,0,0)",
    muted: "#33476b",
    rule: "rgba(23,74,139,.45)",
    pitch: "rgba(40,130,72,.22)",
    pitchLine: "rgba(12,23,51,.3)",
  },
};

export interface RecapMarker {
  code: string;
  /** Position on the pitch, 0–100 (the positions catalogue's x / y). */
  x: number;
  y: number;
  /** Share of his position minutes (0–1): the marker's size. */
  share: number;
}
/** What a card says, in the words of the image (and of the on-page card). */
export interface RecapText {
  kicker: string;
  /** The big thing: a number, a code, a name; empty for the crest. */
  hero: string;
  label: string;
  lines: string[];
  crest: boolean;
  markers: RecapMarker[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const gaText = (g: number, a: number) => [g ? plural(g, "gol", "goles") : "", a ? plural(a, "asistencia", "asistencias") : ""].filter(Boolean).join(" y ");

export function recapText(card: RecapCard): RecapText {
  const base = { crest: false, markers: [] as RecapMarker[] };
  switch (card.kind) {
    case "portada":
      return { ...base, kicker: "Tu temporada en cromos", hero: card.number || card.name, label: card.number ? card.name : "", lines: [card.season] };
    case "partidos":
      return {
        ...base,
        kicker: "Partidos y minutos",
        hero: String(card.played),
        label: card.played === 1 ? "PARTIDO JUGADO" : "PARTIDOS JUGADOS",
        lines: [card.minutes === null ? "Minutos: — (actas sin minutos)" : `${fmtMinutes(card.minutes)} en el campo`],
      };
    case "goles":
      return {
        ...base,
        kicker: "Goles y asistencias",
        hero: String(card.goals),
        label: card.goals === 1 ? "GOL" : "GOLES",
        lines: [plural(card.assists, "asistencia", "asistencias"), ...(card.best ? [`Tu mejor partido: ${card.best.label}, ${gaText(card.best.goals, card.best.assists)}`] : [])],
      };
    case "mvp": {
      const votes = `${plural(card.votes, "voto", "votos")} en toda la temporada`;
      return { ...base, kicker: "MVP", hero: String(card.times), label: card.times === 1 ? "VEZ MVP" : "VECES MVP", lines: card.times ? [votes] : ["El año que viene.", ...(card.votes ? [votes] : [])] };
    }
    case "socio":
      return { ...base, kicker: "Tu socio en el campo", hero: card.partnerName, label: "TU SOCIO", lines: [`${plural(card.combined, "gol combinado", "goles combinados")} entre los dos`] };
    case "posiciones": {
      const total = card.codes.reduce((s, c) => s + c.minutes, 0);
      const main = card.main ?? card.codes[0]?.code ?? "";
      return {
        ...base,
        kicker: "Dónde jugaste",
        hero: main,
        label: isPosCode(main) ? POSITIONS[main].long : "",
        lines: card.codes.slice(0, 3).map((c) => `${c.code} · ${fmtMinutes(c.minutes)}`),
        markers: card.codes.flatMap((c) => (isPosCode(c.code) ? [{ code: c.code, x: POSITIONS[c.code].x, y: POSITIONS[c.code].y, share: total > 0 ? c.minutes / total : 0 }] : [])),
      };
    }
    case "porra":
      return { ...base, kicker: "La porra", hero: `${card.rank}.º`, label: `DE ${card.of} EN LA PORRA`, lines: [plural(card.points, "punto", "puntos")] };
    case "medallas":
      return { ...base, kicker: "Tus medallas", hero: String(card.medals.length), label: card.medals.length === 1 ? "MEDALLA NUEVA" : "MEDALLAS NUEVAS", lines: card.medals.map((m) => m.label) };
    case "equipo":
      return {
        ...base,
        kicker: "El equipo",
        hero: `${card.g}·${card.e}·${card.p}`,
        label: "GANADOS · EMPATADOS · PERDIDOS",
        lines: [`${plural(card.gf, "gol", "goles")} a favor y ${card.ga} en contra`, ...(card.biggest ? [`La mayor victoria: ${card.biggest.score}, ${card.biggest.label}`] : [])],
      };
    case "cierre":
      return { ...base, kicker: "Gracias por la temporada", hero: "", label: card.season.toLocaleUpperCase("es-ES"), lines: ["Nos vemos en la próxima."], crest: true };
  }
}

export interface RecapLayout {
  w: number;
  h: number;
  pad: number;
  top: { y: number; crest: number; size: number };
  kicker: { y: number; size: number; lineH: number };
  /** The big number: its size fits the width (a long name shrinks). */
  hero: { y: number; size: number };
  crest: { cx: number; cy: number; size: number };
  pitch: { x: number; y: number; w: number; h: number } | null;
  label: { y: number; size: number };
  lines: { y: number; size: number; lineH: number };
  foot: { rule: number; y: number; size: number };
}

const HERO_MAX = 460;
const HERO_MIN = 120;
/** The hero's size: as big as fits the width (Anybody 900 is about .62 em per glyph). */
export function heroSize(hero: string, width: number): number {
  const n = Math.max(1, [...hero].length);
  return Math.round(Math.max(HERO_MIN, Math.min(HERO_MAX, width / (0.62 * n))));
}

export function recapLayout(t: Pick<RecapText, "hero" | "crest" | "markers">): RecapLayout {
  const { w, h } = RECAP_SIZE;
  const pad = 96;
  const top = { y: pad, crest: 96, size: 30 };
  const kicker = { y: 300, size: 72, lineH: 78 };
  const size = heroSize(t.hero, w - 2 * pad);
  const pitched = t.markers.length > 0;
  // the hero sits on the upper third; a card with a pitch keeps it smaller to leave room for it
  const heroY = pitched ? 520 : 640;
  const heroSz = pitched ? Math.min(size, 260) : size;
  const crest = { cx: w / 2, cy: 860, size: 520 };
  const label = { y: (t.crest ? crest.cy + crest.size / 2 : heroY + heroSz) + 40, size: 40 };
  const pitch = pitched ? { x: pad + 120, y: label.y + 110, w: w - 2 * pad - 240, h: 560 } : null;
  const lines = { y: (pitch ? pitch.y + pitch.h : label.y + label.size) + 90, size: 48, lineH: 66 };
  const foot = { rule: h - pad - 90, y: h - pad, size: 30 };
  return { w, h, pad, top, kicker, hero: { y: heroY, size: heroSz }, crest, pitch, label, lines, foot };
}

// ───────────────────────── the drawing ─────────────────────────
type Ctx = CanvasRenderingContext2D;

/** The faces the image uses (a Celeste page may never have used one in the DOM). */
export const RECAP_FACES = ["900 100px Anybody", "600 40px 'Geist Mono'", "600 40px Geist"] as const;
/** Loads the faces explicitly, then waits for the font set (as matchPoster's posterFonts). A failure only
 *  means the fallback fonts draw it. */
export async function recapFonts(sample: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all(RECAP_FACES.map((f) => document.fonts.load(f, sample)));
    await document.fonts.ready;
  } catch {
    /* the fallback fonts still draw it */
  }
}

let crestP: Promise<HTMLImageElement | null> | null = null;
/** The club's crest (a slow or missing image never holds the file back). */
function crestImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  crestP ??= Promise.race([loadImage("/crest.webp"), new Promise<null>((r) => window.setTimeout(() => r(null), 3000))]).then((img) => {
    if (!img) crestP = null;
    return img;
  });
  return crestP;
}

function font(ctx: Ctx, weight: number, size: number, family: string, ls = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${ls}px`;
}
function wrap(ctx: Ctx, s: string, maxW: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
function dotScreen(ctx: Ctx, cell: number, r: number, color: string): CanvasPattern | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = cell;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = color;
  g.beginPath();
  g.arc(cell / 2, cell / 2, r, 0, Math.PI * 2);
  g.fill();
  return ctx.createPattern(c, "repeat");
}

function background(ctx: Ctx, L: RecapLayout, P: RecapPalette) {
  ctx.fillStyle = P.bg;
  ctx.fillRect(0, 0, L.w, L.h);
  const g = ctx.createRadialGradient(L.w / 2, 0.3 * L.h, 0, L.w / 2, 0.3 * L.h, 0.8 * L.h);
  g.addColorStop(0, P.glow[0]);
  g.addColorStop(0.55, P.glow[1]);
  g.addColorStop(1, P.glow[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L.w, L.h);
  const dots = dotScreen(ctx, 26, 5, P.dots);
  if (dots) {
    ctx.fillStyle = dots;
    ctx.fillRect(0, 0, L.w, L.h);
  }
}

function drawPitch(ctx: Ctx, box: NonNullable<RecapLayout["pitch"]>, markers: RecapMarker[], P: RecapPalette) {
  ctx.fillStyle = P.pitch;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = P.pitchLine;
  ctx.lineWidth = 4;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  // halfway line, centre circle and our box (the catalogue's y grows towards our goal, at the bottom)
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h / 2);
  ctx.lineTo(box.x + box.w, box.y + box.h / 2);
  ctx.moveTo(box.x + box.w / 2 + box.w * 0.14, box.y + box.h / 2);
  ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(box.x + box.w * 0.25, box.y + box.h * 0.85, box.w * 0.5, box.h * 0.15);
  const at = (m: RecapMarker) => ({ x: box.x + (m.x / 100) * box.w, y: box.y + (Math.max(4, Math.min(96, m.y)) / 100) * box.h });
  font(ctx, 600, 30, MONO);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const m of [...markers].sort((a, b) => a.share - b.share)) {
    const p = at(m);
    const r = 34 + 40 * m.share;
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.bg;
    ctx.fillText(m.code, p.x, p.y + 2);
  }
}

function paint(ctx: Ctx, card: RecapCard, d: RecapDrawCtx, crest: HTMLImageElement | null) {
  const P = RECAP_PALETTE[d.theme];
  const T = recapText(card);
  const L = recapLayout(T);
  const inner = L.w - 2 * L.pad;
  background(ctx, L, P);

  // the crest bar: crest · MANCHESTER PITI ……… 9 · ANA
  if (crest) ctx.drawImage(crest, L.pad, L.top.y, L.top.crest, L.top.crest);
  font(ctx, 600, L.top.size, MONO, 0.14 * L.top.size);
  ctx.fillStyle = P.muted;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const mid = L.top.y + L.top.crest / 2;
  ctx.fillText("MANCHESTER PITI", L.pad + L.top.crest + 24, mid);
  const shirt = [d.shirt.number, d.shirt.name.toLocaleUpperCase("es-ES")].filter(Boolean).join(" · ");
  ctx.textAlign = "right";
  ctx.fillText(truncate(ctx, shirt, inner / 2 - 40), L.w - L.pad, mid);

  // the kicker
  font(ctx, 900, L.kicker.size, DISPLAY, 0.02 * L.kicker.size);
  ctx.fillStyle = P.accent;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  wrap(ctx, T.kicker.toLocaleUpperCase("es-ES"), inner)
    .slice(0, 2)
    .forEach((s, i) => ctx.fillText(s, L.pad, L.kicker.y + i * L.kicker.lineH));

  // the hero (or the crest)
  ctx.textAlign = "center";
  if (T.crest) {
    if (crest) ctx.drawImage(crest, L.crest.cx - L.crest.size / 2, L.crest.cy - L.crest.size / 2, L.crest.size, L.crest.size);
  } else {
    let size = L.hero.size;
    font(ctx, 900, size, DISPLAY);
    // (the measure is the truth: shrink until it fits)
    while (size > HERO_MIN && ctx.measureText(T.hero).width > inner) font(ctx, 900, (size -= 8), DISPLAY);
    ctx.save();
    ctx.shadowColor = P.halo;
    ctx.shadowBlur = 40;
    ctx.fillStyle = P.ink;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(T.hero, L.w / 2, L.hero.y + 0.8 * size);
    ctx.restore();
  }
  if (T.label) {
    font(ctx, 600, L.label.size, MONO, 0.12 * L.label.size);
    ctx.fillStyle = P.muted;
    ctx.textBaseline = "top";
    ctx.fillText(truncate(ctx, T.label, inner), L.w / 2, L.label.y);
  }
  if (L.pitch) drawPitch(ctx, L.pitch, T.markers, P);

  // the lines
  font(ctx, 600, L.lines.size, SANS);
  ctx.fillStyle = P.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let y = L.lines.y;
  for (const line of T.lines)
    for (const s of wrap(ctx, line, inner)) {
      if (y + L.lines.lineH > L.foot.rule - 20) break;
      ctx.fillText(s, L.w / 2, y);
      y += L.lines.lineH;
    }

  // the foot
  ctx.fillStyle = P.rule;
  ctx.fillRect(L.pad, L.foot.rule, inner, 3);
  font(ctx, 600, L.foot.size, MONO, 0.14 * L.foot.size);
  ctx.fillStyle = P.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("TU TEMPORADA EN CROMOS", L.w / 2, L.foot.y);
}

/** Paints the card on `canvas` (1080×1920), fonts first. False where the canvas can't draw. */
export async function drawRecapCard(canvas: HTMLCanvasElement, card: RecapCard, d: RecapDrawCtx): Promise<boolean> {
  canvas.width = RECAP_SIZE.w;
  canvas.height = RECAP_SIZE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const t = recapText(card);
  const sample = [t.kicker.toLocaleUpperCase("es-ES"), t.hero, t.label, ...t.lines, d.shirt.name, "MANCHESTER PITI ÁÉÍÓÚÜÑ·º′0123456789"].join(" ");
  const [crest] = await Promise.all([crestImage(), recapFonts(sample)]);
  ctx.clearRect(0, 0, RECAP_SIZE.w, RECAP_SIZE.h);
  paint(ctx, card, d, crest);
  return true;
}

/** The card as a PNG (null where the canvas can't draw). */
export async function recapCardBlob(card: RecapCard, d: RecapDrawCtx): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ok = await drawRecapCard(canvas, card, d);
  return ok ? canvasToBlob(canvas) : null;
}
