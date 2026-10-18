// «El calendario de luz» (Partidos): the pure part. Which jornadas get a slice of Palomeras and at what light,
// what the featured one's plinth says in each phase of the match day (derived/matchday), the calendar rows'
// sky chips and tags, the season summary and the provisional table while a match is being played. No React,
// no Firebase: the page and its tests drive it with a controlled `now`.
import type { ClubMatch } from "../../lib/clubData";
import { dateMillis, isCompleted, matchPhase } from "../../../functions/src/matchEngine";
import { dateParts, lastEvent, OURS, scoreOf, THEIRS } from "../../lib/partidos";
import { settled } from "../../lib/eventMeta";
import { lightOf, sunPosition, sunTimes, floodlightsOn } from "../../lib/derived/sun";
import { madridDate, madridTime } from "../../lib/derived/madrid";
import { kickoffState } from "../../lib/derived/kickoff";
import { resultLetter, RESULT_WORD, type ResultLetter } from "../../lib/derived/result";
import type { MatchdayModel, MatchdayPhase } from "../../lib/derived/matchday";
import type { StandingRow } from "../../lib/standings";

const DAY = 86_400_000;
const LIVE: ReadonlySet<MatchdayPhase> = new Set(["directo1", "descanso", "directo2"]);
export const isLivePhase = (p: MatchdayPhase): boolean => LIVE.has(p);

/** The rival line of a match: «Contra Orduña fc» at home, «En casa de Pitutis» away. */
export const rivalLine = (m: Pick<ClubMatch, "rival" | "home">): string => (m.home === false ? "En casa de " : "Contra ") + (m.rival || "rival por confirmar");

/** A venue as people write it: «CDM PALOMERAS» → «CDM Palomeras» (only an all-caps one is touched). */
export function venueName(v: string): string {
  if (!v || v !== v.toUpperCase()) return v;
  return v
    .split(/\s+/)
    .map((w) => (w.length <= 3 && /^[A-ZÁÉÍÓÚÑ]+$/.test(w) && w !== "DE" && w !== "LA" ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

/** «En casa, Palomeras» / «Fuera, en Moratalaz» (the venue without its «CDM» / «Campo de»). */
export function placeLabel(m: Pick<ClubMatch, "home" | "venue">): string {
  const v = (m.venue ?? "").replace(/^(CDM|Polideportivo|Campo de|Campo)\s+/i, "").trim();
  const nice = venueName(v);
  if (m.home === false) return nice ? `Fuera, en ${nice}` : "Fuera";
  return nice ? `En casa, ${nice}` : "En casa";
}

/** The light a kick-off gets, in words: «Sol de mediodía, a 36°», «Atardecer, sol a 8°», «De noche, con focos». */
export function lightLabel(at: number): { text: string; sunny: boolean; elevation: number } {
  const el = sunPosition(at).elevation;
  const deg = Math.round(el);
  const hour = Number(madridTime(at).slice(0, 2));
  switch (lightOf(el)) {
    case "dia":
      return { text: hour >= 12 && hour < 16 ? `Sol de mediodía, a ${deg}°` : `Sol a ${deg}°`, sunny: true, elevation: el };
    case "tarde":
      return { text: `Sol a ${deg}°`, sunny: true, elevation: el };
    case "dorada":
      return { text: `Atardecer, sol a ${deg}°`, sunny: true, elevation: el };
    case "ocaso":
      return { text: "Al ocaso, con focos", sunny: false, elevation: el };
    default:
      return { text: "De noche, con focos", sunny: false, elevation: el };
  }
}

/** The jornadas that get a slice: the featured one first, then up to `max - 1` more around it in calendar order. */
export function sliceMatches(season: readonly ClubMatch[], featured: ClubMatch | null, max = 6): ClubMatch[] {
  if (!season.length) return [];
  const list = [...season];
  const i = featured ? list.findIndex((m) => m.id === featured.id) : -1;
  const at = i < 0 ? 0 : i;
  const window = list.slice(at, at + max);
  for (let k = at - 1; window.length < max && k >= 0; k--) window.unshift(list[k]);
  const head = i < 0 ? window[0] : list[i];
  return [head, ...window.filter((m) => m.id !== head.id)];
}

/** The match a slice / row draws for a phase. */
export type SliceKind = "featured" | "upcoming" | "played" | "live" | "off";

export interface SliceLight {
  /** ms the slice shows (drives the sun). */
  at: number;
  floodlights: "off" | "glow" | "on";
}

/** At which moment a jornada's slice is drawn: upcoming at its kick-off, the live one now, the played ones at
 *  night after the final whistle (lights glowing), a postponed one at its old kick-off with the lights off. */
export function sliceLight(m: ClubMatch, now: number, live: boolean): SliceLight {
  const ko = dateMillis(m.date);
  const at = Number.isFinite(ko) ? ko : now;
  const phase = matchPhase(m, now);
  if (phase === "postponed" || phase === "cancelled") return { at, floodlights: "off" };
  if (live) {
    const el = sunPosition(now).elevation;
    return { at: now, floodlights: floodlightsOn(el, true) ? "on" : "off" };
  }
  if (isCompleted(m) || phase === "awaiting_result") {
    const night = Math.max(at + 2 * 3_600_000, sunTimes(at).sunset + 90 * 60_000);
    return { at: night, floodlights: "glow" };
  }
  return { at, floodlights: floodlightsOn(sunPosition(at).elevation, false) ? "on" : "off" };
}

/** «hoy», «mañana», «en 4 días», or the date. */
export function whenWord(at: number, now: number): string {
  const today = madridDate(now);
  const day = madridDate(at);
  if (day === today) return "hoy";
  const days = Math.round((Date.parse(day) - Date.parse(today)) / DAY);
  if (days === 1) return "mañana";
  if (days > 1 && days <= 7) return `en ${days} días`;
  if (days === -1) return "ayer";
  return "";
}

/** A slice's day line: «hoy, dom 18 oct», «dom 25 oct» (`near`: «dom 25 oct, en 7 días»). */
export function dayLine(at: number, now: number, near = false): string {
  const d = dateParts(at);
  const short = d.long.replace(/^(\p{L}{3})\p{L}*,?/u, "$1");
  const w = whenWord(at, now);
  if (w === "hoy" || w === "ayer" || w === "mañana") return `${w}, ${short}`;
  return near && w ? `${short}, ${w}` : short;
}

// ---------- the featured jornada's plinth

export interface Cta {
  label: string;
  kind: "pri" | "gold" | "ghost";
  to: "match" | "maps" | "calendar" | "tabla";
  matchId?: string;
}

export interface Plinth {
  /** «En juego, primera parte». */
  kicker: string;
  /** live = red dot, pending = amber dot (with the words, never the colour alone). */
  tone: "live" | "pending" | "";
  text: string;
  ctas: Cta[];
}

export interface GoalChip {
  id: string;
  minute: number | null;
  who: string;
  ours: boolean;
}

/** The featured jornada of the light calendar: después counts down to the next one; otherwise the match day's. */
export function featuredOf(md: MatchdayModel): ClubMatch | null {
  if (md.phase === "despues") return md.next ?? md.match;
  return md.match ?? md.next;
}

const MINUTE_PHASE: Partial<Record<MatchdayPhase, string>> = { directo1: "En juego, primera parte", directo2: "En juego, segunda parte", descanso: "Descanso" };

function countdown(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

function daysTo(at: number, now: number): number {
  return Math.max(0, Math.round((Date.parse(madridDate(at)) - Date.parse(madridDate(now))) / DAY));
}

/** The words, line and buttons under the featured slice, for each phase. Fans and members read the same. */
export function plinthOf(md: MatchdayModel, now: number, nameOf: (id: string) => string): Plinth | null {
  const m = featuredOf(md);
  if (!m) return null;
  const at = dateMillis(m.date);
  const rival = m.rival || "el rival";
  const s = scoreOf(m);
  const id = m.id;
  const sevenOut = (m.starters?.length ?? 0) > 0;
  const ko = Number.isFinite(at) ? madridTime(at) : "";
  const sunset = Number.isFinite(at) ? sunTimes(at).sunset : NaN;
  const lit = Number.isFinite(at) ? lightLabel(at) : null;
  const previa: Cta = { label: "Ver la previa", kind: "pri", to: "match", matchId: id };
  const maps: Cta = { label: "Cómo llegar", kind: "ghost", to: "maps", matchId: id };
  const cal: Cta = { label: "Al calendario", kind: "ghost", to: "calendar", matchId: id };
  const follow: Cta = { label: "Seguir el partido", kind: "pri", to: "match", matchId: id };
  const venue = m.home === false ? `en casa de ${rival}` : m.venue ? "en Palomeras" : "en casa";
  switch (md.phase) {
    case "semana":
    case "despues": {
      const n = Number.isFinite(at) ? daysTo(at, now) : null;
      const k = n === null ? "La siguiente, fecha por confirmar" : n === 0 ? `Hoy, a las ${ko}` : n === 1 ? "La siguiente, mañana" : `La siguiente, en ${n} días`;
      const light = lit ? ` ${lit.sunny ? "Con luz de día" : "Con focos"}: ${lit.text.charAt(0).toLowerCase()}${lit.text.slice(1)}.` : "";
      const last = md.phase === "despues" && md.last ? ` Del último queda el ${scoreOf(md.last).gf}–${scoreOf(md.last).ga}.` : "";
      return {
        kicker: k,
        tone: "",
        text: `${rivalLine(m)} ${Number.isFinite(at) ? `el ${dateParts(at).long} a las ${ko}` : ""}, ${venue}.${light} ${sevenOut ? "El siete ya está publicado." : "El siete aún no está."}${last}`.replace(/\s+/g, " ").trim(),
        ctas: md.phase === "despues" && md.last ? [previa, { label: "Leer el acta", kind: "ghost", to: "match", matchId: md.last.id }] : [previa, cal, maps],
      };
    }
    case "antes": {
      const setsDuring = Number.isFinite(sunset) && sunset > at && sunset < at + (m.duration ?? 50) * 60_000 + 15 * 60_000;
      const sun = Number.isFinite(sunset) && sunset > now ? ` El sol se pone a las ${madridTime(sunset)}${setsDuring ? ", en mitad del partido" : ""}.` : "";
      return {
        kicker: `Hoy, a las ${ko}`,
        tone: "",
        text: `Faltan ${countdown(at - now)}. ${sevenOut ? "El siete ya está publicado" : "El siete aún no está"}.${sun}`,
        ctas: [previa, maps, cal],
      };
    }
    case "pitido":
      return {
        kicker: "Pendiente del pitido inicial",
        tone: "pending",
        text: `Son las ${madridTime(now)} y la mesa aún no ha arrancado el reloj. En cuanto lo haga, se encienden los focos aquí también.`,
        ctas: [follow],
      };
    case "directo1":
    case "directo2":
    case "descanso": {
      const ev = lastEvent(m.events, nameOf, rival);
      const minute = md.minute !== null ? ` Minuto ${md.minute}${md.added ? ` (+${md.added})` : ""}${m.home === false ? "" : " en Palomeras"}.` : "";
      const kicker = (MINUTE_PHASE[md.phase] ?? "En juego") + (md.phase === "directo2" && md.added ? ", tiempo añadido" : "");
      const text =
        md.phase === "descanso"
          ? `Al descanso con ${s.gf}–${s.ga}.${ev ? ` Lo último: ${ev.title.charAt(0).toLowerCase()}${ev.title.slice(1)}, en el ${ev.minute}′.` : ""}`
          : ev
            ? `${ev.minute}′, ${ev.title.charAt(0).toLowerCase()}${ev.title.slice(1)}${ev.sub ? `, ${ev.sub.charAt(0).toLowerCase()}${ev.sub.slice(1)}` : ""}.${minute}`
            : `Sin goles de momento.${minute}`;
      return { kicker, tone: md.phase === "descanso" ? "pending" : "live", text, ctas: [follow] };
    }
    case "final": {
      const r = resultLetter(s.gf, s.ga);
      const verb = r === "G" ? "Ganamos" : r === "P" ? "Perdemos" : "Empatamos";
      return {
        kicker: "Final",
        tone: "",
        text: `${verb} ${s.gf}–${s.ga} contra ${rival}. El acta llega en unos minutos: hasta entonces, el resultado es provisional.`,
        ctas: [{ label: "Ver el partido", kind: "pri", to: "match", matchId: id }],
      };
    }
    case "acta": {
      const r = resultLetter(s.gf, s.ga);
      const closes = typeof m.voteClosesAt === "number" ? ` La votación del MVP cierra el ${dateParts(m.voteClosesAt).long} a las ${madridTime(m.voteClosesAt)}.` : "";
      return {
        kicker: "Acta publicada",
        tone: "",
        text: `${RESULT_WORD[r].charAt(0).toUpperCase()}${RESULT_WORD[r].slice(1)} ${s.gf}–${s.ga} contra ${rival}.${closes}`,
        ctas: [{ label: "Leer el acta", kind: "pri", to: "match", matchId: id }],
      };
    }
    case "aplazado": {
      const next = md.next;
      return {
        kicker: "Aplazado",
        tone: "pending",
        text: `El partido ${m.home === false ? "en casa de" : "contra"} ${rival} se ha aplazado. La liga dará nueva fecha; aquí saldrá en cuanto la haya.`,
        ctas: next ? [{ label: "Ver la siguiente", kind: "ghost", to: "match", matchId: next.id }] : [],
      };
    }
    default:
      return null;
  }
}

/** The goals so far of a live or played match, in minute order (ours with the scorer, theirs with the rival). */
export function goalChips(m: ClubMatch, nameOf: (id: string) => string): GoalChip[] {
  const rival = m.rival || "Rival";
  return settled(m.events)
    .filter((e) => OURS.has(e.type) || THEIRS.has(e.type))
    .map((e) => ({
      id: e.id,
      minute: typeof e.minute === "number" ? e.minute : null,
      ours: OURS.has(e.type),
      who: OURS.has(e.type) ? (e.type === "opponent_own_goal" ? "Autogol" : e.playerId ? nameOf(e.playerId) : "Piti") : rival,
    }))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

// ---------- the scoreboard object over the featured slice

export interface Board {
  gf: string;
  ga: string;
  k: string;
  c: string;
  plate: string;
  tone: "live" | "pending" | "gold" | "";
}

export function boardOf(md: MatchdayModel, m: ClubMatch, now: number): Board {
  const at = dateMillis(m.date);
  const s = md.score ?? scoreOf(m);
  const gf = String(s.gf);
  const ga = String(s.ga);
  const ko = Number.isFinite(at) ? madridTime(at) : "";
  const left = Number.isFinite(at) ? at - now : NaN;
  switch (md.phase) {
    case "antes": {
      const min = Math.max(0, Math.round(left / 60_000));
      return { gf: "–", ga: "–", k: "Faltan", c: `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`, plate: `Hoy ${ko}`, tone: "" };
    }
    case "pitido":
      return { gf: "0", ga: "0", k: "Pendiente", c: ko, plate: "Pendiente del pitido", tone: "pending" };
    case "directo1":
      return { gf, ga, k: "1ª parte", c: `${md.minute ?? 0}′`, plate: "", tone: "live" };
    case "descanso":
      return { gf, ga, k: "Descanso", c: `${md.minute ?? 0}′`, plate: "", tone: "pending" };
    case "directo2":
      return { gf, ga, k: "2ª parte", c: `${md.minute ?? 0}′`, plate: md.added ? `Añadido +${md.added}` : "", tone: "live" };
    case "final":
      return { gf, ga, k: "Final", c: "", plate: "Acta pendiente", tone: "pending" };
    case "acta":
      return { gf, ga, k: "Final", c: "", plate: "Acta publicada", tone: "gold" };
    case "aplazado":
      return { gf: "–", ga: "–", k: "Aplazado", c: "—", plate: "Sin fecha", tone: "pending" };
    default: {
      const n = Number.isFinite(at) ? daysTo(at, now) : null;
      return { gf: "–", ga: "–", k: "Faltan", c: n === null ? "—" : n === 1 ? "1 día" : `${n} días`, plate: Number.isFinite(at) ? `${dateParts(at).long.replace(/^(\p{L}{3})\p{L}*,?/u, "$1")} ${ko}` : "", tone: "" };
    }
  }
}

// ---------- calendar rows

export interface RowTag {
  text: string;
  /** c en casa · f fuera · l en juego · a pendiente/aplazado · r result */
  kind: "c" | "f" | "l" | "a" | "r";
  result?: ResultLetter;
}

export function rowTag(m: ClubMatch, now: number, minute: number | null): RowTag {
  const phase = matchPhase(m, now);
  const s = scoreOf(m);
  if (isCompleted(m)) return { text: `${s.gf}–${s.ga}`, kind: "r", result: resultLetter(s.gf, s.ga) };
  if (phase === "playing") {
    if (kickoffState(m, now) === "halftime") return { text: `Descanso ${s.gf}–${s.ga}`, kind: "a" };
    return { text: `En juego ${s.gf}–${s.ga}${minute !== null ? `, ${minute}′` : ""}`, kind: "l" };
  }
  if (phase === "awaiting_result") return { text: `Final ${s.gf}–${s.ga}, acta pendiente`, kind: "a" };
  if (phase === "postponed") return { text: "Aplazado, sin fecha", kind: "a" };
  if (phase === "cancelled") return { text: "Suspendido", kind: "a" };
  if (kickoffState(m, now) === "pending_whistle") return { text: "Pendiente del pitido", kind: "a" };
  return m.home === false ? { text: "Fuera", kind: "f" } : { text: "En casa", kind: "c" };
}

export interface SkyChip {
  /** CSS background of the chip. */
  bg: string;
  /** Sun (or moon) height in the chip, % from the top. */
  sunTop: number;
  moon: boolean;
  lit: boolean;
}

/** The colours of the little sky at a kick-off (the same stops the 3D sky uses), the sun at its height, lit masts. */
export function skyChipOf(at: number, sky: { top: string; mid: string; hor: string }): SkyChip {
  const el = sunPosition(at).elevation;
  const sunTop = Math.max(12, Math.min(70, 62 - el * 1.1));
  return {
    bg: `linear-gradient(180deg,${sky.top} 0%,${sky.mid} 46%,${sky.hor} 66%,#1d3326 67%,#2a5a35 100%)`,
    sunTop,
    moon: el < -4,
    lit: floodlightsOn(el, false),
  };
}

// ---------- summary

/** The season's G/E/P letters in calendar order (finished ones), plus the live one's provisional letter. */
export function formOf(season: readonly ClubMatch[], live: ClubMatch | null): { letters: ResultLetter[]; provisional: ResultLetter | null } {
  const letters = season.filter((m) => isCompleted(m)).map((m) => {
    const s = scoreOf(m);
    return resultLetter(s.gf, s.ga);
  });
  const provisional = live ? resultLetter(scoreOf(live).gf, scoreOf(live).ga) : null;
  return { letters, provisional };
}

export interface Leader {
  id: string;
  n: number;
}

/** Goals and assists of the season so far, the live match's settled plays included. */
export function leadersOf(season: readonly ClubMatch[], now: number): { goals: Leader[]; assists: Leader[] } {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const m of season) {
    const phase = matchPhase(m, now);
    if (!isCompleted(m) && phase !== "playing" && phase !== "awaiting_result") continue;
    for (const e of settled(m.events)) {
      if (!OURS.has(e.type) || e.type === "opponent_own_goal") continue;
      if (e.playerId && !e.playerId.startsWith("guest:")) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
      const a = e.assistPlayerId;
      if (a && !a.startsWith("guest:")) assists.set(a, (assists.get(a) ?? 0) + 1);
    }
  }
  const top = (map: Map<string, number>): Leader[] => {
    const rows = [...map.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
    return rows;
  };
  return { goals: top(goals), assists: top(assists) };
}

const norm = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The table as it would stand if the live match ended now: our row and the rival's (when it is in the table)
 *  get the live result. Null without a table or a live match. */
export function provisionalTable(rows: readonly StandingRow[], live: ClubMatch | null): StandingRow[] | null {
  if (!live || !rows.length) return null;
  const { gf, ga } = scoreOf(live);
  const r = resultLetter(gf, ga);
  const rival = norm(live.rival ?? "");
  const add = (row: StandingRow, f: number, a: number, res: ResultLetter): StandingRow => ({
    ...row,
    pj: row.pj + 1,
    g: row.g + (res === "G" ? 1 : 0),
    e: row.e + (res === "E" ? 1 : 0),
    p: row.p + (res === "P" ? 1 : 0),
    gf: row.gf + f,
    gc: row.gc + a,
    pts: row.pts + (res === "G" ? 3 : res === "E" ? 1 : 0),
  });
  const flip: Record<ResultLetter, ResultLetter> = { G: "P", E: "E", P: "G" };
  const next = rows.map((row) => (row.isUs ? add(row, gf, ga, r) : rival && norm(row.team) === rival ? add(row, ga, gf, flip[r]) : row));
  return [...next].sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.team.localeCompare(b.team, "es"));
}

/** Whether a member's player is in a match's published convocatoria. */
export const isCalled = (m: Pick<ClubMatch, "starters" | "bench">, playerId: string | null): boolean => !!playerId && (!!m.starters?.includes(playerId) || !!m.bench?.includes(playerId));

/** «Debut»: the member played this match and no earlier finished one. */
export function debutIn(m: ClubMatch, all: readonly ClubMatch[], playerId: string | null): { minutes: number } | null {
  if (!playerId) return null;
  const mine = m.ledger?.[playerId];
  if (!mine?.played) return null;
  const at = dateMillis(m.date);
  const before = all.some((o) => o.id !== m.id && isCompleted(o) && dateMillis(o.date) < at && o.ledger?.[playerId]?.played);
  return before ? null : { minutes: Math.round(mine.minutes) };
}

/** Rival suggestions when a search finds nothing: the season's rivals, distinct, up to three. */
export function rivalSuggestions(matches: readonly ClubMatch[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const r = m.rival?.trim();
    if (!r || seen.has(r.toLowerCase())) continue;
    seen.add(r.toLowerCase());
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
