// Partidos «Vidrio», the page's own words and geometry, pure: the light each jornada of the ribbon is painted
// in, its date lines and accessible name, the window of the ribbon and the season's minimap, the lens's tabs
// per state, the count line, the form letters, the goals by five-minute stretch and the season's figures.
// The data underneath is P2's (lib/derived/vidrio: seasonStrip, tableFocus, simulateTable, playsLog,
// matchSignature, seasonLeaders, cartelOf); this file only words and lays it out. No React, no Firebase.
import type { ClubMatch } from "../../../lib/clubData";
import type { StandingRow } from "../../../lib/standings";
import { settled } from "../../../lib/eventMeta";
import { OURS, THEIRS } from "../../../lib/partidos";
import { eventMinute } from "../../../../functions/src/matchEngine";
import { madridDate, MONTHS_SHORT } from "../../../lib/derived/madrid";
import { sunPosition, type LightKey } from "../../../lib/derived/sun";
import { capital, endSentence, plural } from "../../../lib/derived/words";
import type { StripFilter, StripSegment, StripState } from "../../../lib/derived/vidrio/strip";

const MIN = 60_000;
const DAY = 86_400_000;
const TZ = "Europe/Madrid";

export type Vista = "jornadas" | "tabla" | "numeros";
export const VISTAS: readonly { id: Vista; label: string }[] = [
  { id: "jornadas", label: "Jornadas" },
  { id: "tabla", label: "Tabla" },
  { id: "numeros", label: "Números" },
];
export type LensTab = "previa" | "directo" | "acta";

/** «ADRIÁN T.C.» → «Adrián T.C.»: a shirt name in capitals read as a name (initials keep theirs). */
export function niceName(s: string): string {
  if (!s || s !== s.toLocaleUpperCase("es") || !/\p{L}/u.test(s)) return s;
  return s
    .split(/(\s+|-)/)
    .map((w) => (w.includes(".") || /^\s+$|^-$/.test(w) ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase("es")))
    .join("");
}

// ───────────────────────── the light a jornada is painted in ─────────────────────────

/** The boards' five painted skies (V-Partidos: --vp-golden, --vp-flood, --vp-noon, --vp-dusk, --vp-after). */
export type PaintKey = "golden" | "flood" | "noon" | "dusk" | "after";
/** Each sky as gradient stops (top → horizon → turf), the one source for the CSS and the cartel's canvas. */
export const PAINT_STOPS: Record<PaintKey, readonly (readonly [string, number])[]> = {
  golden: [["#1C2B5E", 0], ["#4A5A96", 24], ["#A98490", 44], ["#E3A77B", 55], ["#F2C08A", 58.5], ["#3B3A3A", 60], ["#22322A", 61], ["#1B2A20", 100]],
  flood: [["#060E24", 0], ["#11234F", 26], ["#1D3B74", 46], ["#2C5A8E", 56], ["#4C7FB0", 58.5], ["#1C4248", 60], ["#154640", 61], ["#0D2C29", 100]],
  noon: [["#17457F", 0], ["#2A64A6", 26], ["#5E98CC", 44], ["#A2C7E6", 56], ["#D2E6F5", 58.5], ["#5C8C63", 60], ["#477A4F", 61], ["#2F5536", 100]],
  dusk: [["#0E1736", 0], ["#252D63", 26], ["#5E4E80", 44], ["#B67778", 55], ["#D99A80", 58.5], ["#3A2D3A", 60], ["#1E2B26", 61], ["#17221C", 100]],
  after: [["#22477F", 0], ["#3F6AA6", 26], ["#93A6C4", 44], ["#E6C79A", 55], ["#F3D7A8", 58.5], ["#56604A", 60], ["#355134", 61], ["#263C22", 100]],
};
export const paintGradient = (k: PaintKey): string => `linear-gradient(180deg,${PAINT_STOPS[k].map(([c, at]) => `${c} ${at}%`).join(",")})`;

const PAINT_OF: Record<LightKey, PaintKey> = { dia: "noon", tarde: "after", dorada: "golden", ocaso: "dusk", noche: "flood" };

export interface SegmentPaint {
  /** The sky at the whistle and at the final whistle (blended left → right, m0 % → m1 %). */
  a: PaintKey;
  b: PaintKey;
  m0: number;
  m1: number;
  /** The sun at kick-off (% of the segment), the bright midday disc or the low warm one; null under the horizon. */
  sun: { x: number; y: number; noon: boolean } | null;
  /** The floodlights are on by the end. */
  floods: boolean;
}

/** How a jornada's segment is painted: its kick-off light (sun.ts over Palomeras), the sun where it stands. */
export function paintOf(seg: Pick<StripSegment, "light" | "at">): SegmentPaint {
  if (!seg.light || seg.at === null) return { a: "flood", b: "flood", m0: 100, m1: 100, sun: null, floods: false };
  const a = PAINT_OF[seg.light.light];
  const b = PAINT_OF[seg.light.lightEnd];
  const { elevation, azimuth } = sunPosition(seg.at);
  const sun =
    elevation > -2
      ? {
          // east on the left, west on the right; high sun near the top, a low one on the horizon (58 %)
          x: Math.round(Math.max(10, Math.min(90, ((azimuth - 90) / 180) * 100))),
          y: Math.round(Math.max(8, Math.min(57, 57 - elevation * 1.3))),
          noon: seg.light.light === "dia",
        }
      : null;
  return { a, b, m0: a === b ? 100 : 38, m1: a === b ? 100 : 86, sun, floods: seg.light.floodlights };
}

// ───────────────────────── dates in words ─────────────────────────

const fmt = (ms: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).format(ms);
const time = (ms: number) => fmt(ms, { hour: "2-digit", minute: "2-digit" });
const monthShort = (ms: number) => MONTHS_SHORT[Number(madridDate(ms).slice(5, 7)) - 1] ?? "";
const dayNum = (ms: number) => Number(madridDate(ms).slice(8, 10));

/** «Dom 13 dic, 19:00» (a segment's date line). */
export function shortDay(at: number): string {
  return `${capital(fmt(at, { weekday: "short" }).replace(".", ""))} ${dayNum(at)} ${monthShort(at)}, ${time(at)}`;
}
/** «13 dic, 19:00» (a narrow segment). */
export const tinyDay = (at: number): string => `${dayNum(at)} ${monthShort(at)}, ${time(at)}`;
/** «domingo 17 de enero» */
export const longDay = (at: number): string => fmt(at, { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
/** «19:00» */
export const clockTime = time;

/** Madrid days from `now` to `at` (0 today, 1 tomorrow). */
export function daysBetween(now: number, at: number): number {
  const n = (ms: number) => {
    const [y, m, d] = madridDate(ms).split("-").map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  };
  return n(at) - n(now);
}

/** «Faltan 2 h 14 min», «Faltan 14 min», «Ya es la hora». */
export function untilText(at: number, now: number): string {
  const mins = Math.ceil((at - now) / MIN);
  if (mins <= 0) return "Ya es la hora";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `Faltan ${h ? `${h} h ${m} min` : `${m} min`}`;
}

/** «Mañana.», «Dentro de 5 días.», «Dentro de 7 semanas.» (an upcoming jornada's distance). */
export function distanceText(at: number, now: number): string {
  const d = daysBetween(now, at);
  if (d <= 0) return "Hoy.";
  if (d === 1) return "Mañana.";
  if (d < 14) return `Dentro de ${d} días.`;
  return `Dentro de ${Math.round(d / 7)} semanas.`;
}

/** «Contra Orduña fc» at home, «En casa de Pitutis» away. */
export const rivalTitle = (s: Pick<StripSegment, "rival" | "home">): string => (s.home ? "Contra " : "En casa de ") + s.rival;

/** The rival's two letters on its crest: the words without «FC», «de», «y». */
export function rivalInitials(rival: string, given?: string | null): string {
  if (given && given.trim()) return given.trim().slice(0, 3).toUpperCase();
  const w = rival.split(/\s+/).filter((x) => x && !/^(fc|f\.c\.|cf|c\.f\.|de|del|la|los|y)$/i.test(x));
  if (!w.length) return rival.slice(0, 2).toUpperCase();
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

const score = (s: { gf: number; ga: number }) => `${s.gf}–${s.ga}`;
const VERB = { G: "ganamos", E: "empate", P: "perdimos" } as const;

/** A segment's state in a few words (its accessible name's end, the minimap's title). */
export function stateWords(seg: Pick<StripSegment, "state" | "score" | "letter" | "at" | "provisional">, now: number, minute: number | null): string {
  switch (seg.state) {
    case "directo":
      return `En directo: ${seg.score ? score(seg.score) : "0–0"}${minute !== null ? `, minuto ${minute}` : ""}`;
    case "hoy":
      return seg.at !== null ? `Hoy a las ${time(seg.at)}, ${untilText(seg.at, now).toLowerCase()}` : "Hoy";
    case "jugado":
      return seg.score && seg.letter && seg.letter !== "A" ? `Jugado: ${score(seg.score)}, ${VERB[seg.letter]}${seg.provisional ? ", a falta del acta" : ""}` : "Jugado";
    case "aplazado":
      return "Aplazado";
    case "suspendido":
      return "Suspendido";
    case "pendiente":
      return "Pendiente del acta";
    default:
      return "Por jugar";
  }
}

/** «J17, domingo 17 de enero, contra Orduña fc. En directo: 2–1, minuto 23» */
export function segmentAria(seg: StripSegment, now: number, minute: number | null): string {
  const j = seg.jornada ? `J${seg.jornada}` : "Jornada";
  const day = seg.at !== null ? longDay(seg.at) : "fecha por confirmar";
  return `${endSentence(`${j}, ${day}, ${seg.home ? "contra" : "en casa de"} ${seg.rival}`)} ${stateWords(seg, now, minute)}`;
}

// ───────────────────────── the window and the minimap ─────────────────────────

/** How many jornadas the ribbon shows at a width (the boards: 7 at 1440, 10 at 1920, 6 at 820; a phone
 *  scrolls them all). */
export function windowSizeFor(width: number): number {
  if (width >= 1800) return 10;
  if (width >= 1300) return 7;
  if (width >= 700) return 6;
  return Number.POSITIVE_INFINITY;
}

export interface RibbonGap {
  /** Index in the visible list it comes before. */
  before: number;
  /** Relative width: 1 a week, up to 3.2. */
  units: number;
  /** «Sin partido», «27 dic, sin partido», "" */
  label: string;
}

/** The spacing between the visible jornadas: a week is one unit, a longer wait is wider and says so. */
export function ribbonGaps(visible: readonly Pick<StripSegment, "day">[]): RibbonGap[] {
  const out: RibbonGap[] = [];
  for (let k = 1; k < visible.length; k++) {
    const a = visible[k - 1].day;
    const b = visible[k].day;
    if (!a || !b) {
      out.push({ before: k, units: 1, label: "" });
      continue;
    }
    const days = (Date.parse(b) - Date.parse(a)) / DAY;
    const units = Math.max(1, Math.min(3.2, days / 7));
    let label = "";
    if (days >= 21) label = "Sin partido";
    else if (days >= 14) {
      const free = new Date(Date.parse(a) + 7 * DAY);
      label = `${free.getUTCDate()} ${MONTHS_SHORT[free.getUTCMonth()]}, sin partido`;
    }
    out.push({ before: k, units: Math.round(units * 100) / 100, label });
  }
  return out;
}

export interface MinimapMark {
  id: string;
  index: number;
  /** % of the track. */
  x: number;
  w: number;
  letter: string;
  paint: PaintKey;
  inWindow: boolean;
  inList: boolean;
  selected: boolean;
  state: StripState;
}
export interface Minimap {
  marks: MinimapMark[];
  months: { x: number; label: string }[];
  /** The window's rectangle (% of the track). */
  win: { x: number; w: number };
  /** «Hoy» on the track, or null. */
  hoy: number | null;
}

/** The whole season as a strip of small skies, with the window the ribbon shows and where «hoy» is. */
export function minimapOf(segments: readonly StripSegment[], visibleIds: readonly string[], listIds: ReadonlySet<string>, selId: string | null, todayIndex: number | null, now: number): Minimap {
  const n = segments.length;
  const w = Math.min(8, 72 / Math.max(1, n));
  const posOf = (s: StripSegment, i: number) => (s.span ?? (n > 1 ? i / (n - 1) : 0)) * (100 - w);
  const vis = new Set(visibleIds);
  const marks = segments.map((s, i): MinimapMark => ({
    id: s.id,
    index: i,
    x: Math.round(posOf(s, i) * 100) / 100,
    w: Math.round(w * 100) / 100,
    letter: s.letter ?? (s.state === "directo" ? "•" : ""),
    paint: paintOf(s).a,
    inWindow: vis.has(s.id),
    inList: listIds.has(s.id),
    selected: s.id === selId,
    state: s.state,
  }));
  const months: Minimap["months"] = [];
  let last = "";
  segments.forEach((s, i) => {
    if (!s.day) return;
    const key = s.day.slice(0, 7);
    if (key === last) return;
    last = key;
    months.push({ x: marks[i].x, label: MONTHS_SHORT[Number(s.day.slice(5, 7)) - 1] ?? "" });
  });
  const shown = marks.filter((m) => m.inWindow);
  const first = shown[0];
  const lastShown = shown[shown.length - 1];
  const win = first && lastShown ? { x: first.x, w: Math.round((lastShown.x + w - first.x) * 100) / 100 } : { x: 0, w: 0 };
  let hoy: number | null = null;
  if (todayIndex !== null && marks[todayIndex]) hoy = marks[todayIndex].x + w / 2;
  else {
    const dated = segments.filter((s) => s.at !== null);
    const a = dated[0]?.at ?? null;
    const b = dated[dated.length - 1]?.at ?? null;
    if (a !== null && b !== null && b > a && now >= a && now <= b) hoy = ((now - a) / (b - a)) * (100 - w) + w / 2;
  }
  return { marks, months, win, hoy: hoy === null ? null : Math.round(hoy * 100) / 100 };
}

/** The segment nearest to a point of the minimap (0–1 of the track). */
export function nearestOnTrack(marks: readonly Pick<MinimapMark, "x" | "w" | "index">[], fraction: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (const m of marks) {
    const d = Math.abs((m.x + m.w / 2) / 100 - fraction);
    if (d < bd) {
      bd = d;
      best = m.index;
    }
  }
  return best;
}

// ───────────────────────── the lens's tabs ─────────────────────────

export interface LensTabs {
  tabs: { id: LensTab; label: string; disabled?: boolean; small?: string; live?: boolean }[];
  /** The tab it opens on («only»: there is one view and it is named instead). */
  initial: LensTab | "aplazado" | "pendiente" | "suspendido";
  /** The single word shown instead of tabs (an upcoming jornada: «Previa»; postponed: «Aplazado»). */
  only: string | null;
}

export function lensTabs(seg: Pick<StripSegment, "state" | "at" | "provisional">): LensTabs {
  switch (seg.state) {
    case "jugado":
      return { tabs: [{ id: "previa", label: "Previa" }, { id: "directo", label: "Directo" }, { id: "acta", label: seg.provisional ? "Final" : "Acta" }], initial: "acta", only: null };
    case "directo":
      return { tabs: [{ id: "previa", label: "Previa" }, { id: "directo", label: "Directo", live: true }], initial: "directo", only: null };
    case "hoy":
      return { tabs: [{ id: "previa", label: "Previa" }, { id: "directo", label: "Directo", disabled: true, small: seg.at !== null ? `a las ${time(seg.at)}` : "" }], initial: "previa", only: null };
    case "aplazado":
      return { tabs: [], initial: "aplazado", only: "Aplazado" };
    case "suspendido":
      return { tabs: [], initial: "suspendido", only: "Suspendido" };
    case "pendiente":
      return { tabs: [], initial: "pendiente", only: "Pendiente del acta" };
    default:
      return { tabs: [], initial: "previa", only: "Previa" };
  }
}

/** «Hoy, domingo 17 de enero, a las 19:00» · «Domingo 11 de octubre, a las 11:00 (se aplazó)» */
export function whenLine(seg: Pick<StripSegment, "at" | "state">, now: number): string {
  if (seg.at === null) return "Fecha por confirmar";
  const today = daysBetween(now, seg.at) === 0;
  const day = longDay(seg.at);
  return `${today ? `Hoy, ${day}` : capital(day)}, a las ${time(seg.at)}${seg.state === "aplazado" ? " (se aplazó)" : ""}`;
}

// ───────────────────────── the tools' count line ─────────────────────────

/** «26 jornadas; 14 jugadas, una en directo y 11 por jugar» · with a filter, what it keeps. */
export function countLine(c: { total: number; played: number; live: number; pending: number }, remaining: number, filter: StripFilter, kept: number): string {
  if (filter === "proximos") return `${plural(kept, "jornada")} por jugar`;
  if (filter === "resultados") return `${plural(kept, "jornada")} con resultado`;
  if (!c.total) return "Sin jornadas todavía";
  const played = c.played + c.pending;
  const parts = [`${plural(played, "jugada")}`];
  if (c.live) parts.push(c.live === 1 ? "una en directo" : `${c.live} en directo`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, ${parts[parts.length - 1]}` : parts[0];
  return `${plural(c.total, "jornada")}; ${list} y ${remaining} por jugar`;
}

// ───────────────────────── form, figures, goals by stretch ─────────────────────────

export interface FormLetter {
  text: string;
  kind: "g" | "e" | "p" | "prov" | "empty";
  aria: string;
}

/** The last six jornadas played (the live one as a provisional letter), then the next ones still open (with
 *  the viewer's make-believe result, if any), up to six. */
export function formLetters(segments: readonly StripSegment[], results: Readonly<Record<string, "G" | "E" | "P">> = {}): FormLetter[] {
  const played = segments.filter((s) => s.state === "jugado" || s.state === "directo").slice(-6);
  const out: FormLetter[] = played.map((s) => {
    const j = s.jornada ? `J${s.jornada}` : "Jornada";
    if (s.state === "directo") {
      const l = s.score ? (s.score.gf > s.score.ga ? "G" : s.score.gf === s.score.ga ? "E" : "P") : "E";
      return { text: l, kind: "prov", aria: `${j}, ${l === "G" ? "ganando" : l === "E" ? "empatando" : "perdiendo"}, provisional` };
    }
    const l = s.letter && s.letter !== "A" ? s.letter : "E";
    return { text: l, kind: l === "G" ? "g" : l === "P" ? "p" : "e", aria: `${j}, ${l === "G" ? "ganado" : l === "E" ? "empate" : "perdido"}` };
  });
  const open = segments.filter((s) => s.state === "hoy" || s.state === "proximo");
  for (const s of open.slice(0, Math.max(1, 6 - out.length))) {
    const j = s.jornada ? `J${s.jornada}` : "J";
    const r = results[s.id];
    out.push(r ? { text: r, kind: "prov", aria: `${j}, de mentira` } : { text: j, kind: "empty", aria: `${j}, por jugar` });
  }
  return out;
}

/** Our goals and theirs by five-minute stretch (ten of a 50-minute match; longer matches fold into the last),
 *  over the matches played and the one being played. */
export function goalsByStretch(matches: readonly ClubMatch[]): { us: number[]; them: number[] } {
  const us = Array.from({ length: 10 }, () => 0);
  const them = Array.from({ length: 10 }, () => 0);
  for (const m of matches) {
    const duration = m.duration && m.duration > 0 ? m.duration : 50;
    for (const e of settled(m.events)) {
      const minute = eventMinute(e);
      if (minute === null) continue;
      const b = Math.max(0, Math.min(9, Math.floor((Math.max(0, minute - 1) / duration) * 10)));
      if (OURS.has(e.type)) us[b]++;
      else if (THEIRS.has(e.type)) them[b]++;
    }
  }
  return { us, them };
}

/** Our yellow cards and clean sheets over the matches played (the Números side column). */
export function cardsAndCleanSheets(played: readonly ClubMatch[], scoreOf: (m: ClubMatch) => { gf: number; ga: number }): { cards: number; clean: number } {
  let cards = 0;
  let clean = 0;
  for (const m of played) {
    for (const e of settled(m.events)) {
      if (e.type === "yellow_card") cards++;
      else if (e.type === "double_yellow") cards += 2;
    }
    if (scoreOf(m).ga === 0) clean++;
  }
  return { cards, clean };
}

export interface Totals {
  items: { value: string; label: string; provisional: boolean }[];
}

/** The season in figures: our goals, conceded, the difference, our place and what is left. `row`: our table
 *  row as it stands (or as it would with the live score). */
export function seasonTotals(row: Pick<StandingRow, "gf" | "gc"> | null, goals: { gf: number; ga: number }, position: number | null, remaining: number, live: boolean, closed: boolean, total: number): Totals {
  const gf = row ? row.gf : goals.gf;
  const gc = row ? row.gc : goals.ga;
  const dg = gf - gc;
  return {
    items: [
      { value: String(gf), label: gf === 1 ? "gol nuestro" : "goles nuestros", provisional: live },
      { value: String(gc), label: gc === 1 ? "encajado" : "encajados", provisional: live },
      { value: `${dg > 0 ? "+" : dg < 0 ? "−" : ""}${Math.abs(dg)}`, label: "de diferencia", provisional: live },
      { value: position ? `${position}º` : "–", label: live ? "si acaba así" : "en la tabla", provisional: live },
      closed ? { value: String(total), label: "jornadas jugadas", provisional: false } : { value: String(remaining), label: remaining === 1 ? "jornada por jugar" : "jornadas por jugar", provisional: false },
    ],
  };
}

/** A goal difference as the table prints it: «+18», «−3», «0». */
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
