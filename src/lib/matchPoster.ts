// The match poster (Instagram post 1080×1080 or story 1080×1920) in the Celeste skin: the pizarra
// cartel's night stadium and gold frame (pizarra/v2/cartel.ts), the perfil share studio's faces
// (perfil/shareDraw.ts: Anybody for the display, Geist and Geist Mono for the small print), loaded
// explicitly before drawing. It tells the result in G·E·P, our scorers by nameFor with the match's own
// season and each goal's minute by eventMinute, and the system played when the acta saved one. Old
// matches (no events, no system, no season) still get a full poster. The layout is pure (posterModel
// and POSTER_SLOTS); the drawing reuses the old poster's canvas helpers (pizarra/poster.ts).
import { canvasToBlob, loadImage, roundRect, truncate } from "../pages/pizarra/poster";
import { dateMillis, formatDate, isCompleted, type ClubMatch } from "./clubData";
import { nameFor, type NameSource } from "./derived/names";
import { RESULT_WORD, resultLetter, type ResultLetter } from "./derived/result";
import { systemMark, systemText } from "./derived/system";
import { eventMinute, OURS, scoreOf } from "./partidos";
import { queryClient } from "./queryClient";
import { withGuestNames } from "./derived/guests";

export type PosterFormat = "square" | "story";

export const POSTER_SIZE: Record<PosterFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

/** Where everything goes (px, baselines unless said otherwise). */
export interface PosterSlots {
  /** The crest's box (top left). */
  crest: { x: number; y: number; size: number };
  /** The three header lines: the kicker, the competition and season, the day and the venue. */
  head: readonly [number, number, number];
  /** MANCHESTER PITI, the score (or VS), the rival. */
  us: number;
  score: number;
  scoreSize: number;
  teamSize: number;
  rival: number;
  /** The result chip's (or the day's) top edge. */
  chip: number;
  /** The goals label; the first scorer line sits one `line` under it. */
  goals: number;
  line: number;
  lineSize: number;
  /** Scorer lines that fit before the footer (the last one says «Y N GOLES MÁS» when they don't). */
  maxLines: number;
  foot: number;
}

export const POSTER_SLOTS: Record<PosterFormat, PosterSlots> = {
  square: {
    crest: { x: 64, y: 58, size: 116 },
    head: [96, 140, 178],
    us: 300,
    score: 500,
    scoreSize: 210,
    teamSize: 52,
    rival: 596,
    chip: 636,
    goals: 772,
    line: 44,
    lineSize: 30,
    maxLines: 4,
    foot: 1008,
  },
  story: {
    crest: { x: 72, y: 110, size: 150 },
    head: [158, 212, 258],
    us: 560,
    score: 850,
    scoreSize: 300,
    teamSize: 66,
    rival: 978,
    chip: 1030,
    goals: 1230,
    line: 56,
    lineSize: 38,
    maxLines: 9,
    foot: 1848,
  },
};

export interface PosterGoal {
  /** «12′», or empty where the acta has no minute. */
  min: string;
  /** «PEPE», «AUTOGOL RIVAL». */
  name: string;
}

export interface MatchPosterModel {
  format: PosterFormat;
  w: number;
  h: number;
  done: boolean;
  /** «FINAL DEL PARTIDO» / «DÍA DE PARTIDO». */
  kick: string;
  /** «LIGA F7 · TEMPORADA 1». */
  sub: string;
  /** «8 nov 2026, 12:00 · Campo Municipal», or empty without a date and a venue. */
  when: string;
  us: string;
  rival: string;
  /** «3 – 1», or null before the final whistle. */
  score: string | null;
  letter: ResultLetter | null;
  /** «VICTORIA» / «EMPATE» / «DERROTA». */
  word: string | null;
  /** Our goals in the order they came (the ones without a minute last). */
  goals: PosterGoal[];
  /** Goals that don't fit (told on the last line). */
  more: number;
  /** For a finished match where we scored but the acta names nobody (old matches). */
  noGoals: string | null;
  /** «2-3-1 · Clásico», «Libre · sin sistema fijo», or null (no official board). */
  system: string | null;
  /** The system's short mark for the background («2-3-1», «LIBRE»), or null. */
  mark: string | null;
  file: string;
}

export interface PosterContext {
  /** Our player's name (nameFor with the match's season). */
  nameOf: (id: string) => string;
  /** The match's season name («Temporada 1»), when known. */
  seasonName?: string | null;
}

const OWN_GOAL = "opponent_own_goal";

/** Everything the poster prints, where it goes is POSTER_SLOTS. Pure. */
export function posterModel(match: ClubMatch, format: PosterFormat, ctx: PosterContext): MatchPosterModel {
  const { w, h } = POSTER_SIZE[format];
  const done = isCompleted(match);
  const rival = (match.rival || "Rival").toLocaleUpperCase("es");
  const sub = [match.competition || "Fútbol 7", ctx.seasonName].filter(Boolean).join(" · ").toLocaleUpperCase("es");
  const day = Number.isFinite(dateMillis(match.date)) ? formatDate(match.date, true) : "";
  const when = [day, match.venue].filter(Boolean).join(" · ");

  let score: string | null = null;
  let letter: ResultLetter | null = null;
  let word: string | null = null;
  let goals: PosterGoal[] = [];
  let more = 0;
  let noGoals: string | null = null;
  if (done) {
    const { gf, ga } = scoreOf(match);
    score = `${gf} – ${ga}`;
    letter = resultLetter(gf, ga);
    word = RESULT_WORD[letter].toLocaleUpperCase("es");
    const ours = (match.events ?? [])
      .filter((e) => OURS.has(e.type))
      .map((e, i) => ({ e, i, m: eventMinute(e) }))
      .sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity) || a.i - b.i)
      .map(({ e, m }) => ({
        min: m != null ? `${m}′` : "",
        name: (e.type === OWN_GOAL ? "Autogol rival" : e.playerId ? ctx.nameOf(e.playerId) : "Sin goleador").toLocaleUpperCase("es"),
      }));
    const max = POSTER_SLOTS[format].maxLines;
    if (ours.length > max) {
      goals = ours.slice(0, max - 1);
      more = ours.length - goals.length;
    } else goals = ours;
    if (!ours.length && gf > 0) noGoals = "GOLEADORES SIN REGISTRAR EN EL ACTA";
  }
  return {
    format,
    w,
    h,
    done,
    kick: done ? "FINAL DEL PARTIDO" : "DÍA DE PARTIDO",
    sub,
    when,
    us: "MANCHESTER PITI",
    rival,
    score,
    letter,
    word,
    goals,
    more,
    noGoals,
    system: systemText(match.system),
    mark: systemMark(match.system)?.toLocaleUpperCase("es") ?? null,
    file: `piti-${match.id}-${format}.png`,
  };
}

/** The «Y N GOLES MÁS» line. */
export const moreLine = (n: number): string => (n === 1 ? "Y 1 GOL MÁS" : `Y ${n} GOLES MÁS`);

// ───────────────────────── the faces ─────────────────────────
export const POSTER_FACES = ["900 100px Anybody", "800 100px Anybody", "600 30px 'Geist Mono'", "600 30px Geist"] as const;

/** Loads the poster's faces explicitly (a Celeste page may never have used one in the DOM), then waits
 *  for the font set. A failure only means the fallback fonts draw it. */
export async function posterFonts(sample: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all(POSTER_FACES.map((f) => document.fonts.load(f, sample)));
    await document.fonts.ready;
  } catch {
    /* the fallback fonts still draw it */
  }
}

// ───────────────────────── the drawing ─────────────────────────
const NAVY = "#0c1733";
const GOLD = "#FFC659";
const SKY = "#9fd0f2";
const INK = "#eef4ff";
const MUTED = "#c9d8ef";
const DISPLAY = "'Anybody', 'Archivo', sans-serif";
const MONO = "'Geist Mono', ui-monospace, monospace";
const SANS = "'Geist', system-ui, sans-serif";

type Ctx = CanvasRenderingContext2D;

/** The result's light (the letter and the word always print beside it: never colour alone). */
const TONE: Record<ResultLetter, { fill: string; glow: string }> = {
  G: { fill: GOLD, glow: "rgba(255,198,89,.75)" },
  E: { fill: SKY, glow: "rgba(108,171,221,.75)" },
  P: { fill: INK, glow: "rgba(214,226,245,.35)" },
};

/** Narrower letters for the display font where the canvas can do it (Anybody is a width axis). */
function narrow(ctx: Ctx, on: boolean) {
  if ("fontStretch" in ctx) ctx.fontStretch = on ? "condensed" : "normal";
}

/** The condensed display size at which `s` fits `maxW` (down to `min`), the font left set. (Setting
 *  `font` resets the stretch, so it is narrowed after each one.) */
function fit(ctx: Ctx, s: string, weight: number, size: number, maxW: number, min = 20): number {
  let px = size;
  const set = () => {
    ctx.font = `${weight} ${px}px ${DISPLAY}`;
    narrow(ctx, true);
  };
  set();
  while (ctx.measureText(s).width > maxW && px > min) {
    px -= 2;
    set();
  }
  return px;
}

/** The night stadium of the cartel: the sky, the crowd's lights, the floodlight beams. */
function stadium(ctx: Ctx, w: number, h: number) {
  const bg = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, h * 0.85);
  bg.addColorStop(0, "#1d3f84");
  bg.addColorStop(0.7, "#071230");
  bg.addColorStop(1, "#040a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = (i * 197) % w;
    const y = 30 + ((i * 89) % Math.round(h * 0.16));
    ctx.fillStyle = `rgba(214,236,252,${0.05 + ((i * 7) % 10) / 90})`;
    ctx.fillRect(x, y, 3, 3);
  }
  [-1, 1].forEach((side) => {
    const x0 = side < 0 ? 40 : w - 40;
    const g = ctx.createLinearGradient(x0, 0, w / 2, h * 0.7);
    g.addColorStop(0, "rgba(255,255,255,.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, -10);
    ctx.lineTo(w / 2 + side * -60, h * 0.75);
    ctx.lineTo(w / 2 + side * 260, h * 0.75);
    ctx.closePath();
    ctx.fill();
  });
}

/** The halfway line and centre circle behind the score, and the system mowed into the grass. */
function grass(ctx: Ctx, d: MatchPosterModel, s: PosterSlots) {
  const cy = s.score - s.scoreSize * 0.36;
  ctx.save();
  ctx.strokeStyle = "rgba(238,246,255,.10)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(18, cy);
  ctx.lineTo(d.w - 18, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(d.w / 2, cy, s.scoreSize * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  if (d.mark) {
    ctx.font = `900 ${Math.round(d.w * 0.3)}px ${DISPLAY}`;
    narrow(ctx, true);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(238,246,255,.07)";
    ctx.strokeText(d.mark, d.w / 2, s.goals + (s.foot - s.goals) * 0.45);
    narrow(ctx, false);
  }
  ctx.restore();
}

function header(ctx: Ctx, d: MatchPosterModel, s: PosterSlots, crest: HTMLImageElement | null) {
  const x = crest ? s.crest.x + s.crest.size + 28 : 72;
  const maxW = d.w - 72 - x;
  if (crest) ctx.drawImage(crest, s.crest.x, s.crest.y, s.crest.size, s.crest.size);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = `600 ${d.format === "story" ? 34 : 28}px ${MONO}`;
  ctx.fillText(truncate(ctx, d.kick, maxW), x, s.head[0]);
  ctx.fillStyle = INK;
  ctx.font = `800 ${d.format === "story" ? 42 : 34}px ${DISPLAY}`;
  ctx.fillText(truncate(ctx, d.sub, maxW), x, s.head[1]);
  if (d.when) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${d.format === "story" ? 30 : 24}px ${SANS}`;
    ctx.fillText(truncate(ctx, d.when, maxW), x, s.head[2]);
  }
}

function scoreboard(ctx: Ctx, d: MatchPosterModel, s: PosterSlots) {
  const cx = d.w / 2;
  const maxW = d.w - 144;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  fit(ctx, d.us, 800, s.teamSize, maxW);
  ctx.fillText(d.us, cx, s.us);
  const tone = d.letter ? TONE[d.letter] : { fill: INK, glow: "rgba(108,171,221,.5)" };
  const big = d.score ?? "VS";
  fit(ctx, big, 900, d.score ? s.scoreSize : Math.round(s.scoreSize * 0.62), maxW);
  ctx.fillStyle = tone.fill;
  ctx.shadowColor = tone.glow;
  ctx.shadowBlur = 36;
  ctx.fillText(big, cx, s.score);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK;
  fit(ctx, d.rival, 800, s.teamSize, maxW);
  ctx.fillText(d.rival, cx, s.rival);
  narrow(ctx, false);
}

/** The result chip (a gold disc with the letter and the word), or the day before the match. */
function chip(ctx: Ctx, d: MatchPosterModel, s: PosterSlots) {
  const story = d.format === "story";
  const hgt = story ? 76 : 62;
  const cx = d.w / 2;
  if (d.letter && d.word) {
    const r = hgt / 2 - 7;
    ctx.font = `800 ${story ? 36 : 30}px ${DISPLAY}`;
    const ww = ctx.measureText(d.word).width;
    const cw = 14 + r * 2 + 18 + ww + 28;
    const x = cx - cw / 2;
    ctx.fillStyle = "rgba(6,13,34,.88)";
    roundRect(ctx, x, s.chip, cw, hgt, hgt / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,198,89,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = TONE[d.letter].fill;
    ctx.beginPath();
    ctx.arc(x + 7 + r, s.chip + hgt / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${Math.round(r * 1.25)}px ${DISPLAY}`;
    ctx.fillText(d.letter, x + 7 + r, s.chip + hgt / 2 + 1);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.font = `800 ${story ? 36 : 30}px ${DISPLAY}`;
    ctx.fillText(d.word, x + 7 + r * 2 + 18, s.chip + hgt / 2 + 1);
    ctx.textBaseline = "alphabetic";
    return;
  }
  if (!d.when) return;
  ctx.font = `600 ${story ? 32 : 26}px ${SANS}`;
  const label = truncate(ctx, d.when.toLocaleUpperCase("es"), d.w - 200);
  const cw = ctx.measureText(label).width + 56;
  ctx.fillStyle = "rgba(6,13,34,.88)";
  roundRect(ctx, cx - cw / 2, s.chip, cw, hgt, hgt / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(108,171,221,.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, s.chip + hgt / 2 + 1);
  ctx.textBaseline = "alphabetic";
}

function scorers(ctx: Ctx, d: MatchPosterModel, s: PosterSlots) {
  const lines: PosterGoal[] = [...d.goals];
  if (d.more) lines.push({ min: "", name: moreLine(d.more) });
  if (!lines.length && !d.noGoals) return;
  const cx = d.w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = `600 ${d.format === "story" ? 30 : 24}px ${MONO}`;
  ctx.fillText(d.noGoals ? "GOLES" : d.goals.length + d.more === 1 ? "EL GOL" : "LOS GOLES", cx, s.goals);
  if (d.noGoals) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 ${s.lineSize - 4}px ${SANS}`;
    ctx.fillText(truncate(ctx, d.noGoals, d.w - 144), cx, s.goals + s.line);
    return;
  }
  lines.forEach((g, k) => {
    const y = s.goals + s.line * (k + 1);
    ctx.font = `600 ${s.lineSize - 4}px ${MONO}`;
    const min = g.min ? g.min + "  " : "";
    const mw = ctx.measureText(min).width;
    ctx.font = `800 ${s.lineSize}px ${DISPLAY}`;
    const name = truncate(ctx, g.name, d.w - 144 - mw);
    const nw = ctx.measureText(name).width;
    const x = cx - (mw + nw) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = GOLD;
    ctx.font = `600 ${s.lineSize - 4}px ${MONO}`;
    ctx.fillText(min, x, y);
    ctx.fillStyle = INK;
    ctx.font = `800 ${s.lineSize}px ${DISPLAY}`;
    ctx.fillText(name, x + mw, y);
  });
}

function footer(ctx: Ctx, d: MatchPosterModel, s: PosterSlots) {
  const size = d.format === "story" ? 28 : 24;
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 ${size}px ${MONO}`;
  const brand = "MANCHESTER PITI · F7";
  const bw = ctx.measureText(brand).width;
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.fillText(brand, d.w - 72, s.foot);
  if (!d.system) return;
  ctx.textAlign = "left";
  ctx.fillStyle = SKY;
  const label = "SISTEMA  ";
  ctx.fillText(label, 72, s.foot);
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = INK;
  ctx.font = `800 ${size + 4}px ${DISPLAY}`;
  ctx.fillText(truncate(ctx, d.system.toLocaleUpperCase("es"), d.w - 144 - lw - bw - 32), 72 + lw, s.foot);
}

/** Draws the poster on `canvas` (resized to its format). False where the canvas can't draw. */
export async function drawMatchPoster(canvas: HTMLCanvasElement, d: MatchPosterModel, crest: HTMLImageElement | null): Promise<boolean> {
  canvas.width = d.w;
  canvas.height = d.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const s = POSTER_SLOTS[d.format];
  await posterFonts([d.sub, d.when, d.rival, ...d.goals.map((g) => g.name), d.system ?? "", "ÁÉÍÓÚÜÑ–′·0123456789"].join(" "));
  stadium(ctx, d.w, d.h);
  ctx.strokeStyle = "rgba(255,198,89,.5)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, d.w - 36, d.h - 36, 56);
  ctx.stroke();
  grass(ctx, d, s);
  header(ctx, d, s, crest);
  scoreboard(ctx, d, s);
  chip(ctx, d, s);
  scorers(ctx, d, s);
  footer(ctx, d, s);
  return true;
}

// ───────────────────────── the file ─────────────────────────
let crestP: Promise<HTMLImageElement | null> | null = null;
/** The club's crest (a slow or missing image never holds the poster back). */
function crestImage(): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  crestP ??= Promise.race([loadImage("/crest.png"), new Promise<null>((r) => window.setTimeout(() => r(null), 3000))]).then((img) => {
    if (!img) crestP = null;
    return img;
  });
  return crestP;
}

interface PosterPlayer extends NameSource {
  id: string;
}
export interface PosterOptions {
  /** The players to name the scorers with; by default, the club's players already in the cache. */
  players?: readonly PosterPlayer[];
  /** The match's season name; by default, from the seasons in the cache. */
  seasonName?: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isPlayer = (v: unknown): v is PosterPlayer => isRecord(v) && typeof v.id === "string";
/** A cached collection (the shared ["players"] / ["seasons"] keys), or none. */
function cached(key: "players" | "seasons"): unknown[] {
  const data: unknown = queryClient.getQueryData([key]);
  return Array.isArray(data) ? data : [];
}

/** The poster's context for a match: names by nameFor with the match's own season. */
export function posterContext(match: Pick<ClubMatch, "seasonId" | "guests">, opts: PosterOptions = {}): PosterContext {
  const players = opts.players ?? cached("players").filter(isPlayer);
  const byId = new Map(players.map((p) => [p.id, p]));
  const seasonId = match.seasonId ?? null;
  let seasonName = opts.seasonName;
  if (seasonName === undefined) {
    const season = seasonId ? cached("seasons").find((s) => isRecord(s) && s.id === seasonId) : undefined;
    seasonName = isRecord(season) && typeof season.name === "string" ? season.name : null;
  }
  // (a guest of the acta: «Rafa (invitado)»)
  return { nameOf: withGuestNames(match, (id) => nameFor(byId.get(id), seasonId)), seasonName };
}

/** Draws the match's poster and downloads it as a PNG. */
export async function downloadMatchPoster(match: ClubMatch, format: PosterFormat, opts: PosterOptions = {}): Promise<void> {
  const d = posterModel(match, format, posterContext(match, opts));
  const canvas = document.createElement("canvas");
  const ok = await drawMatchPoster(canvas, d, await crestImage());
  if (!ok) throw new Error("El navegador no puede crear imágenes.");
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error("No se pudo generar el cartel.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = d.file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
