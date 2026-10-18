// «La luz del partido»: what Inicio says at each phase of the match day, for each viewer, written from the data
// (lib/derived/matchday). Pure: the hero's headline and subline, the club scoreboard's face, the perimeter
// boards' message, the floodlights, the figures on the pitch and «Arrastra el sol» (the match at any minute of
// the afternoon: the countdown before, the score and the seven at that minute during, the final after).
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import { dateMillis, minuteOfPlay, type MatchEvent } from "../../../functions/src/matchEngine";
import { lineupWalk, parseMatchLineup, type LineupSlot } from "../../lib/matchLineup";
import type { ClubMatch } from "../../lib/clubData";
import type { MatchdayModel, MatchdayPhase, ViewerRole } from "../../lib/derived/matchday";
import { floodlightsOn, sunPosition, sunTimes } from "../../lib/derived/sun";
import { madridDate, madridTime } from "../../lib/derived/madrid";
import { eventMetaOf, eventSentence, rivalCode, settled } from "../../lib/eventMeta";
import { withGuestNames } from "../../lib/derived/guests";
import { endSentence } from "../../lib/derived/words";
import type { MatchWeather } from "../../lib/weather";
import { momentTally, type ReactionDoc } from "../../lib/derived/trasElPartido";
import type { PalomerasFigure, PalomerasState } from "../../components/palomeras3d";
import { madridMinutes, SCRUB0, SCRUB1 } from "../../components/palomeras3d";

const MIN = 60_000;
const J = "⁠–⁠"; // an en dash that never breaks a score across lines

/** «ADRIÁN T.C.» → «Adrián T.C.»: a shirt name in capitals read as a name (initials keep theirs). */
export function niceName(s: string): string {
  if (!s || s !== s.toLocaleUpperCase("es") || !/\p{L}/u.test(s)) return s;
  return s
    .split(/(\s+|-)/)
    .map((w) => (w.includes(".") || /^\s+$|^-$/.test(w) ? w : w.charAt(0) + w.slice(1).toLocaleLowerCase("es")))
    .join("");
}

/** «Domingo» / «martes»: the Madrid weekday. */
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
export const weekday = (ms: number): string => WEEKDAY.format(ms);
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1);
const lower1 = (s: string) => s.charAt(0).toLocaleLowerCase("es") + s.slice(1);
const NUMBERS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];
const numberWord = (n: number) => NUMBERS[n] ?? String(n);
/** «Alcides», «Alcides y Kevin», «Alcides, Adrián T.C. y Kevin». */
export const andList = (xs: readonly string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** «el domingo» / «mañana» / «hoy», seen from `now`. */
export function dayWord(at: number, now: number): string {
  const a = madridDate(at);
  if (a === madridDate(now)) return "hoy";
  if (a === madridDate(now + 86_400_000)) return "mañana";
  return at - now < 6.5 * 86_400_000 ? `el ${weekday(at)}` : `el ${weekday(at)} ${Number(a.slice(8))}`;
}

// ───────────────────────── the match at a minute ─────────────────────────

/** The live part of the day, at one instant (now, or a minute the viewer scrubbed to). */
export interface MatchView {
  phase: MatchdayPhase;
  /** The instant shown (drives the sun). */
  at: number;
  /** Seconds of play at `at` (null before the kick-off). */
  seconds: number | null;
  /** Football's minute (null before the kick-off). */
  minute: number | null;
  added: number | null;
  gf: number;
  ga: number;
  /** The settled plays up to `at`, in order. */
  events: MatchEvent[];
  /** The scrubbed view (not now). */
  scrubbed: boolean;
}

const LIVE = new Set<MatchdayPhase>(["directo1", "descanso", "directo2"]);
export const isLive = (p: MatchdayPhase) => LIVE.has(p);

function scoreThrough(events: readonly MatchEvent[]): { gf: number; ga: number } {
  let gf = 0;
  let ga = 0;
  for (const e of events) {
    const g = eventMetaOf(e).goal;
    if (g === "for") gf++;
    else if (g === "against") ga++;
  }
  return { gf, ga };
}

/** Seconds of play at wall time `t` (the clock's stamps; without a clock, from the kick-off): never past now. */
export function playSecondsAt(match: ClubMatch, t: number): number | null {
  const c = match.clock;
  if (c && c.phase !== "ready") {
    if (c.firstStartedAt == null || t < c.firstStartedAt) return null;
    const firstEnd = c.firstEndedAt ?? c.endedAt ?? t;
    const first = Math.max(0, Math.min(t, firstEnd) - c.firstStartedAt) / 1000;
    const second = c.secondStartedAt != null && t > c.secondStartedAt ? (Math.min(t, c.endedAt ?? t) - c.secondStartedAt) / 1000 : 0;
    return first + second;
  }
  const ko = dateMillis(match.date);
  if (!Number.isFinite(ko) || t < ko) return null;
  return Math.min((t - ko) / 1000, (match.duration ?? 50) * 60);
}

/** The phase a scrubbed instant falls in (never past `now`: the future isn't known yet). */
function phaseAt(match: ClubMatch, t: number, now: number, today: MatchdayPhase): MatchdayPhase {
  const ko = dateMillis(match.date);
  const c = match.clock;
  if (t >= now) return today;
  if (c && c.phase !== "ready" && c.firstStartedAt != null) {
    if (t < c.firstStartedAt) return t < ko ? "antes" : "pitido";
    if (c.firstEndedAt == null || t < c.firstEndedAt) return "directo1";
    if (c.secondStartedAt == null || t < c.secondStartedAt) return "descanso";
    if (c.endedAt == null || t < c.endedAt) return "directo2";
    return today === "acta" ? "acta" : "final";
  }
  if (!Number.isFinite(ko) || t < ko) return "antes";
  const played = (t - ko) / MIN;
  const d = match.duration ?? 50;
  if (played < d / 2) return "directo1";
  if (played < d) return "directo2";
  return today === "acta" ? "acta" : "final";
}

/** The match shown at `t` (`scrub` null: now, from the match day model). */
export function matchViewAt(day: MatchdayModel, now: number, scrub: number | null): MatchView {
  const m = day.match;
  const at = scrub ?? now;
  const all = m ? settled(m.events) : [];
  if (!m || scrub === null) {
    const secs = m ? playSecondsAt(m, now) : null;
    const events = isLive(day.phase) && secs !== null ? all.filter((e) => eventSeconds(e) <= secs + 1) : all;
    const score = day.score ?? { gf: 0, ga: 0 };
    return { phase: day.phase, at, seconds: secs, minute: day.minute, added: day.added, gf: score.gf, ga: score.ga, events, scrubbed: false };
  }
  const phase = phaseAt(m, Math.min(at, now), now, day.phase);
  const secs = playSecondsAt(m, Math.min(at, now));
  const events = secs === null ? [] : all.filter((e) => eventSeconds(e) <= secs);
  const { gf, ga } = secs === null ? { gf: 0, ga: 0 } : phase === "final" || phase === "acta" ? (day.score ?? scoreThrough(events)) : scoreThrough(events);
  const playing = phase === "directo1" || phase === "directo2";
  const minute = secs === null ? null : playing ? minuteOfPlay(secs, true) : Math.max(1, Math.ceil(secs / 60));
  return { phase, at, seconds: secs, minute, added: null, gf, ga, events, scrubbed: true };
}

/** The day can be scrubbed: the match is today (from the countdown to the acta of tonight). */
export function scrubbable(day: MatchdayModel, now: number): boolean {
  if (!day.match || day.kickoff === null) return false;
  if (!["antes", "pitido", "directo1", "descanso", "directo2", "final", "acta"].includes(day.phase)) return false;
  return madridDate(day.kickoff) === madridDate(now);
}

/** The snaps of «Arrastra el sol»: the kick-off, half-time and the final whistle (ms). */
export function snapsOf(match: ClubMatch): { pitido: number; descanso: number; final: number } {
  const ko = dateMillis(match.date);
  const d = (match.duration ?? 50) * MIN;
  const c = match.clock;
  const start = c?.firstStartedAt ?? ko;
  return {
    pitido: start + 30_000,
    descanso: (c?.firstEndedAt ?? start + d / 2) + MIN,
    final: (c?.endedAt ?? start + d + 10 * MIN) + 2 * MIN,
  };
}

/** Madrid minutes of the scrub track (14:00–21:00) → ms on the match's day. */
export function scrubToMs(dayRef: number, minutes: number): number {
  return dayRef + (minutes - madridMinutes(dayRef)) * MIN;
}
/** Where `ms` sits on the scrub track (0..1). */
export const trackFraction = (ms: number) => Math.max(0, Math.min(1, (madridMinutes(ms) - SCRUB0) / (SCRUB1 - SCRUB0)));
/** A dragged value snaps to a mark within 4 minutes of it. */
export function snapMinutes(v: number, marks: readonly number[]): number {
  for (const m of marks) if (Math.abs(v - m) <= 4) return m;
  return v;
}

// ───────────────────────── the words ─────────────────────────

export interface CopyCtx {
  day: MatchdayModel;
  view: MatchView;
  now: number;
  member: boolean;
  role: ViewerRole;
  /** Names one of ours in the match's season. */
  nameOf: (id: string) => string;
  sevenPublished: boolean;
  weather: MatchWeather | null;
  seasonName: string;
  squadSize: number;
  /** The MVP once the vote has closed (después). */
  mvp: { id: string; name: string; goals: number } | null;
  /** The match is the season's first played one. */
  estreno: boolean;
}

export interface HeroCopy {
  kick: string;
  h1: string;
  sub: string;
  live: boolean;
}

const rivalOf = (m: ClubMatch | null) => m?.rival?.trim() || "el rival";
const isHome = (m: ClubMatch | null) => m?.home !== false;
const jWord = (j: number | null) => (j ? `Jornada ${j}` : "El partido");

/** The light a match is played in, in a few words («Se empieza con la última luz y se acaba con los focos»). */
export function lightLine(kickoff: number, minutes: number): string {
  const start = sunPosition(kickoff).elevation;
  const end = sunPosition(kickoff + minutes * MIN).elevation;
  const litStart = floodlightsOn(start, true);
  const litEnd = floodlightsOn(end, true);
  if (litStart) return "Todo el partido con los focos encendidos.";
  if (litEnd) return "Se empieza con la última luz y se acaba con los focos.";
  return `Se juega con luz de día: el sol a ${Math.max(0, Math.round(start))}° en el pitido.`;
}

function weatherLine(w: MatchWeather | null, kickoff: number): string {
  const sunset = madridTime(sunTimes(kickoff).sunset);
  if (!w) return `El sol se pondrá a las ${sunset}.`;
  return `Previsión: ${w.temp}° y ${w.label.toLocaleLowerCase("es")}; el sol se pondrá a las ${sunset}.`;
}

/** The goals so far, «Marcaron Alcides y Adrián T.C.». */
function scorersOf(match: ClubMatch, events: readonly MatchEvent[], nameOf: (id: string) => string): string[] {
  const name = withGuestNames(match, nameOf);
  const out: string[] = [];
  for (const e of events) {
    if (eventMetaOf(e).goal !== "for") continue;
    const who = e.type === "opponent_own_goal" ? "autogol" : e.playerId ? name(e.playerId) : "";
    if (who && !out.includes(who)) out.push(who);
  }
  return out;
}

/** The last play told as a sentence: «21′, gol de Adrián T.C., pase de Jordi». */
export function playLine(match: ClubMatch, e: MatchEvent, nameOf: (id: string) => string): string {
  const s = eventSentence(e, { nameOf: withGuestNames(match, nameOf), rival: rivalOf(match) });
  const m = typeof e.minute === "number" || typeof e.elapsedSeconds === "number" ? `${Math.max(1, Math.ceil(eventSeconds(e) / 60))}′, ` : "";
  return `${m}${lower1(s.title)}${s.sub ? `, ${lower1(s.sub)}` : ""}`;
}

/** The headline, its kicker and the line under it: per phase and viewer, from the data. */
export function heroCopy(ctx: CopyCtx): HeroCopy {
  const { day, view, now, nameOf } = ctx;
  const m = day.match;
  const rival = rivalOf(m);
  const ko = day.kickoff;
  const hhmm = ko ? madridTime(ko) : "";
  const home = isHome(m);
  const ground = home ? "Palomeras" : (m?.venue?.trim() || `casa de ${rival}`);
  switch (view.phase) {
    case "pretemporada":
      return { kick: `${ctx.seasonName}, en pretemporada`, h1: "Palomeras ya espera", sub: `El calendario sale en unos días. Mientras, hazte la camiseta y conoce a los ${ctx.squadSize || "jugadores"}.`, live: false };
    case "semana": {
      if (!m || !ko) return { kick: ctx.seasonName, h1: "Sin partido a la vista", sub: "El próximo saldrá aquí en cuanto tenga fecha, con su hora y su campo.", live: false };
      const when = dayWord(ko, now);
      const first = ctx.estreno ? "Primer partido de la temporada. " : "";
      return { kick: `${jWord(day.jornada)}, ${when} a las ${hhmm}`, h1: home ? `${cap(when)}, ${rival}` : `${cap(when)}, a casa de ${rival}`, sub: first + weatherLine(ctx.weather, ko), live: false };
    }
    case "antes": {
      const sub = ctx.sevenPublished
        ? `El siete ya está en el césped. ${ko ? lightLine(ko, m?.duration ?? 50) : ""}`.trim()
        : "El siete aún no está: saldrá aquí, en el césped, en cuanto lo publique el capitán.";
      return { kick: `${jWord(day.jornada)}, hoy a las ${hhmm} ${home ? "en casa" : "fuera"}`, h1: home ? `${rival} viene a Palomeras` : `Hoy, en casa de ${rival}`, sub, live: false };
    }
    case "pitido":
      return { kick: "Pendiente del pitido inicial", h1: `Todo listo en ${ground}`, sub: `Son más de las ${hhmm}. En cuanto la mesa arranque el reloj, empieza el directo.`, live: false };
    case "directo1":
    case "directo2": {
      const half = view.phase === "directo1" ? "1ª parte" : "2ª parte";
      const added = view.added ? ` +${view.added}` : "";
      const goals = view.events.filter((e) => eventMetaOf(e).goal);
      const g = goals.at(-1);
      let h1 = `Rueda el balón en ${home ? "Palomeras" : ground}`;
      if (g && m) {
        if (eventMetaOf(g).goal === "against") h1 = view.gf === view.ga ? `Empata ${rival}` : `Marca ${rival}`;
        else if (g.type === "opponent_own_goal") h1 = `En propia de ${rival}: ${view.gf}${J}${view.ga}`;
        else h1 = `${g.playerId ? withGuestNames(m, nameOf)(g.playerId) : "El Piti"} pone el ${view.gf}${J}${view.ga}`;
      }
      const last = view.events.at(-1);
      const lastLine = last && m ? endSentence(cap(playLine(m, last, nameOf))) : `La mesa arrancó el reloj${m?.clock?.firstStartedAt ? ` a las ${madridTime(m.clock.firstStartedAt)}` : ""}.`;
      const sub = view.added ? `Se juega el añadido: ${numberWord(view.added)} ${view.added === 1 ? "minuto" : "minutos"} más. ${lastLine}` : lastLine;
      return { kick: `En juego, ${half}, minuto ${view.minute ?? 0}${added}`, h1, sub, live: true };
    }
    case "descanso": {
      const names = m ? scorersOf(m, view.events, nameOf) : [];
      const sub = names.length ? `${endSentence(`Marcaron ${andList(names)}`)} La segunda parte, en unos minutos.` : "Sin goles por ahora. La segunda parte, en unos minutos.";
      return { kick: "Descanso", h1: `Descanso con ${view.gf}${J}${view.ga}`, sub, live: true };
    }
    case "final":
    case "acta":
    case "despues":
      return afterCopy(ctx, view.phase);
    case "aplazado": {
      const word = m?.status === "cancelled" ? "suspendido" : "aplazado";
      const today = ko !== null && madridDate(ko) === madridDate(now);
      return {
        kick: `${jWord(day.jornada)}, ${word}`,
        h1: today ? "Hoy no se juega" : `${cap(ko ? dayWord(ko, now) : "este partido")}, sin partido`,
        sub: `El partido ante ${rival} queda ${word}. La nueva fecha saldrá aquí y en los avisos.`,
        live: false,
      };
    }
  }
}

function resultWords(gf: number, ga: number, estreno: boolean): string {
  const tail = estreno ? " el estreno" : "";
  if (gf > ga) return `Ganamos ${gf}${J}${ga}${tail}`;
  if (gf < ga) return `Perdemos ${gf}${J}${ga}${tail}`;
  return `Empate a ${numberWord(gf)}${tail}`;
}

function afterCopy(ctx: CopyCtx, phase: "final" | "acta" | "despues"): HeroCopy {
  const { day, view, nameOf, now } = ctx;
  const m = day.match;
  const rival = rivalOf(m);
  const of = ctx.estreno ? "del estreno" : day.jornada ? `de la jornada ${day.jornada}` : "del partido";
  if (phase === "final") {
    const names = m ? scorersOf(m, view.events, nameOf) : [];
    const goals = names.length ? `${endSentence(`${names.length === 1 ? "Gol" : "Goles"} de ${andList(names)}`)} ` : "";
    return { kick: `Final, ${day.jornada ? `jornada ${day.jornada}` : `ante ${rival}`}`, h1: resultWords(view.gf, view.ga, ctx.estreno), sub: `${goals}El acta llega en unos minutos: la está cerrando la mesa.`, live: false };
  }
  if (phase === "acta") {
    const played = m?.ledger ? Object.values(m.ledger).filter((p) => p.played).length : 0;
    const closes = m?.voteClosesAt ? `el ${weekday(m.voteClosesAt)} a las ${madridTime(m.voteClosesAt)}` : "que cierre la votación";
    return {
      kick: "Ya está el acta",
      h1: played ? `Los ${numberWord(played)} ${of}` : resultWords(view.gf, view.ga, ctx.estreno),
      sub: ctx.member ? `Vota al MVP entre los que jugaron, hasta ${closes}.` : `Los socios votan al MVP hasta ${m?.voteClosesAt ? `el ${weekday(m.voteClosesAt)}` : "que cierre"}; el ganador sale aquí.`,
      live: false,
    };
  }
  const next = day.next;
  const nextLine = next
    ? (() => {
        const at = dateMillis(next.date);
        const when = Number.isFinite(at) ? `${cap(dayWord(at, now))}, ` : "";
        const where = next.home === false ? `a ${next.venue?.trim() || `casa de ${next.rival ?? "el rival"}`}` : "en Palomeras";
        return ` ${endSentence(`${when}${where}: ${next.rival ?? "rival por confirmar"}${Number.isFinite(at) ? ` a las ${madridTime(at)}` : ""}`)}`;
      })()
    : "";
  if (ctx.mvp) {
    const goals = ctx.mvp.goals ? `${ctx.mvp.goals === 1 ? "Un gol" : `${cap(numberWord(ctx.mvp.goals))} goles`} y MVP.` : "MVP del vestuario.";
    return { kick: `MVP ${of}`, h1: ctx.estreno ? `${ctx.mvp.name}, el primero` : `${ctx.mvp.name}, el mejor`, sub: `${goals}${nextLine}`, live: false };
  }
  return { kick: `Así quedó, ante ${rival}`, h1: resultWords(view.gf, view.ga, ctx.estreno), sub: `La crónica y las notas, en el partido.${nextLine}`, live: false };
}

// ───────────────────────── the club scoreboard ─────────────────────────

export interface BoardFace {
  home: string;
  away: string;
  h: string;
  a: string;
  /** The small line: «Faltan», «2ª parte», «Final»… */
  k: string;
  /** Its value: the countdown, the minute, «acta lista»… */
  c: string;
  /** What a screen reader hears (never a ticking second). */
  label: string;
}

/** «1:24:05» / «24:05»: the countdown to the kick-off. */
export function countdownText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(ss)}` : `${two(m)}:${two(ss)}`;
}
function countdownSaid(ms: number): string {
  const mins = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `faltan ${h} h y ${m} min` : `faltan ${m} min`;
}

export function boardFace(day: MatchdayModel, view: MatchView, now: number): BoardFace {
  const m = day.match;
  const away = (x: ClubMatch | null) => (x ? rivalCode(x.rival ?? "", x.rivalShort ?? x.rivalInitials) : "··");
  const base = { home: "PITI", away: away(m), h: "–", a: "–" };
  const said = (f: Omit<BoardFace, "label">, extra: string) => ({ ...f, label: `Marcador del campo: Piti ${f.h}, ${m?.rival ?? "rival"} ${f.a}. ${extra}` });
  switch (view.phase) {
    case "pretemporada":
      return { ...base, away: "··", k: "Temporada", c: "pronto", label: "Marcador del campo: la temporada empieza pronto." };
    case "semana": {
      if (!m || day.kickoff === null) return { ...base, k: "Próximo", c: "--:--", label: "Marcador del campo: próximo partido por confirmar." };
      const k = cap(dayWord(day.kickoff, now).replace(/^el /, ""));
      return { ...base, k, c: madridTime(day.kickoff), label: `Marcador del campo: Piti contra ${m.rival}, ${k.toLocaleLowerCase("es")} a las ${madridTime(day.kickoff)}.` };
    }
    case "antes": {
      const left = (day.kickoff ?? view.at) - view.at;
      return { ...base, k: "Faltan", c: countdownText(left), label: `Marcador del campo: Piti contra ${m?.rival ?? "rival"}, ${countdownSaid(left)}.` };
    }
    case "pitido":
      return said({ ...base, h: "0", a: "0", k: "Pendiente", c: "00:00" }, "Pendiente del pitido inicial.");
    case "directo1":
    case "directo2": {
      const k = view.phase === "directo1" ? "1ª parte" : "2ª parte";
      const c = `${view.minute ?? 0}′${view.added ? ` +${view.added}` : ""}`;
      return said({ ...base, h: String(view.gf), a: String(view.ga), k, c }, `${k}, minuto ${view.minute ?? 0}.`);
    }
    case "descanso":
      return said({ ...base, h: String(view.gf), a: String(view.ga), k: "Descanso", c: `${view.minute ?? (m?.duration ?? 50) / 2}′` }, "Descanso.");
    case "final":
      return said({ ...base, h: String(view.gf), a: String(view.ga), k: "Final", c: `${m?.duration ?? 50}′` }, "Final, acta pendiente.");
    case "acta":
      return said({ ...base, h: String(view.gf), a: String(view.ga), k: "Final", c: "acta lista" }, "Final, el acta ya está.");
    case "despues": {
      const n = day.next;
      const at = n ? dateMillis(n.date) : NaN;
      if (!n || !Number.isFinite(at)) return said({ ...base, h: String(view.gf), a: String(view.ga), k: "Final", c: "acta lista" }, "Final.");
      const k = `${day.jornada ? `J${day.jornada + 1}, ` : ""}${dayWord(at, now).replace(/^el /, "")}`;
      return { home: "PITI", away: away(n), h: "–", a: "–", k, c: madridTime(at), label: `Marcador del campo: el próximo, Piti contra ${n.rival}, ${k} a las ${madridTime(at)}.` };
    }
    case "aplazado":
      return { ...base, k: m?.status === "cancelled" ? "Suspendido" : "Aplazado", c: "--:--", label: `Marcador del campo: partido ante ${m?.rival ?? "el rival"} aplazado.` };
  }
}

// ───────────────────────── the boards, the lights and the figures ─────────────────────────

export interface BoardMessage {
  text: string;
  kind: "navy" | "gold" | "rival";
}

export function boardMessage(ctx: CopyCtx): BoardMessage | null {
  const { day, view, nameOf } = ctx;
  const m = day.match;
  const rival = rivalOf(m);
  switch (view.phase) {
    case "pretemporada":
      return { text: `${ctx.seasonName}: calendario, pronto`, kind: "navy" };
    case "aplazado":
      return { text: `Partido ${m?.status === "cancelled" ? "suspendido" : "aplazado"}`, kind: "navy" };
    case "pitido":
      return { text: "Pendiente del pitido inicial", kind: "navy" };
    case "antes":
      return ctx.sevenPublished ? { text: "El siete ya está en el césped", kind: "navy" } : null;
    case "descanso":
      return { text: `Descanso: Piti ${view.gf}, ${rival} ${view.ga}`, kind: "navy" };
    case "directo1":
    case "directo2": {
      const last = view.events.at(-1);
      if (!last || !m) return { text: `En juego: Piti ${view.gf}, ${rival} ${view.ga}`, kind: "navy" };
      const g = eventMetaOf(last).goal;
      const s = eventSentence(last, { nameOf: withGuestNames(m, nameOf), rival });
      if (g === "for") return { text: `${s.title}: ${view.gf}${J}${view.ga}`, kind: "gold" };
      if (g === "against") return { text: `${s.title}: ${view.gf}${J}${view.ga}`, kind: "rival" };
      return { text: `${Math.max(1, Math.ceil(eventSeconds(last) / 60))}′ ${s.title}`, kind: "navy" };
    }
    case "final":
      return { text: `Final: Piti ${view.gf}, ${rival} ${view.ga}`, kind: "navy" };
    case "acta":
      return { text: `Ya está el acta ${ctx.estreno ? "del estreno" : `ante ${rival}`}`, kind: "navy" };
    case "despues":
      return ctx.mvp ? { text: `${ctx.mvp.name}, MVP ${ctx.estreno ? "del estreno" : `ante ${rival}`}`, kind: "gold" } : null;
    case "semana":
      return null;
  }
}

/** The masts: on for a match in the dark and on any night; a glow before a match that will need them. */
export function floodlightsOf(day: MatchdayModel, view: MatchView): PalomerasState["floodlights"] {
  const el = sunPosition(view.at).elevation;
  const p = view.phase;
  const tonight = !!day.kickoff && madridDate(day.kickoff) === madridDate(view.at);
  const playing = isLive(p) || ((p === "final" || p === "acta") && tonight && view.at - (day.kickoff ?? 0) < 3 * 3_600_000);
  if (floodlightsOn(el, playing)) return "on";
  if ((p === "antes" || p === "pitido") && day.kickoff && floodlightsOn(sunPosition(day.kickoff + (day.match?.duration ?? 50) * MIN).elevation, true)) return "glow";
  return "off";
}

/** The pizarra's frame (y 0 their goal → 100 ours) → the ground's pitch % (y from our goal), on our half. */
const toPitch = (s: Pick<LineupSlot, "x" | "y">) => ({ x: s.x, y: Math.max(3, (100 - s.y) * 0.55) });
/** A seven without a published lineup stands in a 2-3-1 (keeper first). */
const DEFAULT_SPOTS: readonly (readonly [number, number])[] = [[50, 92], [28, 72], [72, 72], [18, 46], [50, 50], [82, 46], [50, 22]];

export interface FigureCtx {
  day: MatchdayModel;
  view: MatchView;
  seven: readonly string[];
  nameOf: (id: string) => string;
  numOf: (id: string) => string;
  me: string | null;
  /** The scorer of a goal being celebrated now (gold plate). */
  goalBy: string | null;
  mvpId: string | null;
}

const shortName = (s: string) => s.toLocaleUpperCase("es");

/** The figures on the pitch at this view: the seven (as they stand at that minute while live), the huddle at
 *  half-time, the ones who played after the final, the MVP alone after the vote. */
export function figuresOf(ctx: FigureCtx): PalomerasFigure[] {
  const { day, view, seven, nameOf, numOf, me } = ctx;
  const m = day.match;
  if (!m) return [];
  const fig = (id: string, x: number, y: number, extra: Partial<PalomerasFigure> = {}): PalomerasFigure => ({
    id,
    num: numOf(id),
    name: shortName(nameOf(id)),
    x,
    y,
    ...(id === me ? { tag: "tu" as const } : {}),
    ...extra,
  });
  const p = view.phase;
  if (p === "pretemporada" || p === "semana" || p === "aplazado") return [];
  if (p === "despues") return ctx.mvpId ? [fig(ctx.mvpId, 50, 34, { tag: "mvp" })] : [];
  if (p === "acta") {
    const played = Object.entries(m.ledger ?? {})
      .filter(([, v]) => v.played)
      .map(([id]) => id)
      .filter((id) => !id.startsWith("guest:"));
    return played.map((id, i) => {
      // (an arc around the centre circle, open towards the main stand: the design's «los nueve» line-up)
      const a = Math.PI * (1.08 + (0.84 * i) / Math.max(1, played.length - 1));
      return fig(id, 48.6 - Math.sin(a) * 21, 50 + Math.cos(a) * 38, { plate: "mini", gk: i === 0 && (m.starters ?? [])[0] === id });
    });
  }
  if (p === "antes" && !seven.length) return [];
  const lineup = parseMatchLineup((m as ClubMatch & { lineup?: unknown }).lineup);
  const slots: LineupSlot[] = lineup
    ? lineup.slots
    : seven.slice(0, 7).map((id, i) => ({ playerId: id, code: i === 0 ? "POR" : "MC", x: DEFAULT_SPOTS[i][0], y: DEFAULT_SPOTS[i][1] }));
  const live = p === "directo1" || p === "directo2" || p === "descanso" || p === "final";
  const now = live ? lineupWalk({ slots }, view.events).now : slots;
  const cards = new Map<string, "amarilla" | "roja">();
  if (live)
    for (const e of view.events) {
      if (!e.playerId) continue;
      if (e.type === "yellow_card") cards.set(e.playerId, cards.get(e.playerId) === "roja" ? "roja" : "amarilla");
      if (e.type === "red_card" || e.type === "double_yellow") cards.set(e.playerId, "roja");
    }
  return now.map((s, i) => {
    const at = toPitch(s);
    const card = cards.get(s.playerId);
    const tag: PalomerasFigure["tag"] = s.playerId === ctx.goalBy ? "gol" : s.playerId === me ? "tu" : card;
    return fig(s.playerId, at.x, at.y, { ...(tag ? { tag } : {}), gk: i === 0 || s.code === "POR", ...(p === "descanso" ? { huddle: true } : {}) });
  });
}

// ───────────────────────── the season ─────────────────────────

export interface TableRow {
  pos: number;
  team: string;
  pts: number;
  us: boolean;
  /** Moved by the score being played («Si acaba así»). */
  projected: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();

/** The table as it would stand if the match ended as it goes now (us and, when found, the rival). */
export function projectStandings(
  rows: readonly { team: string; pj: number; gf: number; gc: number; pts: number; isUs: boolean }[],
  live: { rival: string; gf: number; ga: number } | null,
): TableRow[] {
  const list = rows.map((r) => ({ ...r, projected: false }));
  if (live) {
    const us = list.find((r) => r.isUs);
    const them = list.find((r) => !r.isUs && norm(r.team) === norm(live.rival));
    const add = (r: (typeof list)[number] | undefined, f: number, a: number) => {
      if (!r) return;
      r.pj++;
      r.gf += f;
      r.gc += a;
      r.pts += f > a ? 3 : f === a ? 1 : 0;
      r.projected = true;
    };
    add(us, live.gf, live.ga);
    add(them, live.ga, live.gf);
    list.sort((a, b) => b.pts - a.pts || b.gf - b.gc - (a.gf - a.gc) || b.gf - a.gf || a.team.localeCompare(b.team, "es"));
  }
  return list.map((r, i) => ({ pos: i + 1, team: r.team, pts: r.pts, us: r.isUs, projected: r.projected }));
}

/** Up to `n` rows around us: the top ones, with us always in. */
export function compactTable(rows: readonly TableRow[], n = 4): TableRow[] {
  if (rows.length <= n) return [...rows];
  const top = rows.slice(0, n);
  if (top.some((r) => r.us)) return top;
  const us = rows.find((r) => r.us);
  return us ? [...rows.slice(0, n - 1), us] : top;
}

// ───────────────────────── the sky chips of «Lo que viene» ─────────────────────────

export interface SkyChip {
  /** The sky's gradient at the kick-off. */
  bg: string;
  /** The sun (or the moon) on the chip, % of its box. */
  x: number;
  y: number;
  moon: boolean;
  lights: boolean;
  /** «sol a 36°» / «con focos». */
  words: string;
}

/** The light at a kick-off as a small chip: the sky, where the sun stands, and the masts lit or not. */
export function skyChipOf(at: number, sky: { top: string; mid: string; hor: string }, minutes = 50): SkyChip {
  const el = sunPosition(at).elevation;
  const lights = floodlightsOn(sunPosition(at + minutes * MIN).elevation, true);
  const u = trackFraction(at);
  return {
    bg: `linear-gradient(180deg, ${sky.top}, ${sky.mid} 55%, ${sky.hor} 78%)`,
    x: 12 + u * 76,
    y: el <= 0 ? 22 : Math.max(16, 70 - el * 1.4),
    moon: el < -4,
    lights,
    words: el < -4 ? "de noche, con focos" : lights ? "con focos al final" : `sol a ${Math.round(el)}°`,
  };
}

// ───────────────────────── the plays as rows, and the most celebrated one ─────────────────────────

export interface PlayRow {
  id: string;
  minute: string;
  k: string;
  tone: "g" | "r" | "y" | "c" | "";
  text: string;
}
/** A play as a row: «21′ · G · Gol de Adrián T.C., pase de Jordi». */
export function playRow(match: ClubMatch, e: NonNullable<ClubMatch["events"]>[number], nameOf: (id: string) => string): PlayRow {
  const meta = eventMetaOf(e);
  const s = eventSentence(e, { nameOf: withGuestNames(match, nameOf), rival: match.rival?.trim() || "el rival" });
  const tone = meta.goal === "for" ? "g" : meta.goal === "against" ? "r" : meta.card === "a" ? "y" : meta.card === "r" ? "r" : e.type === "substitution" ? "c" : "";
  const k = meta.goal === "for" ? "G" : meta.goal === "against" ? (match.rivalShort ?? match.rivalInitials ?? "R").slice(0, 2).toUpperCase() : meta.card === "a" ? "A" : meta.card === "r" ? "R" : e.type === "substitution" ? "⇄" : "·";
  return { id: e.id, minute: `${Math.max(1, Math.ceil(eventSeconds(e) / 60))}′`, k, tone, text: s.sub && meta.goal ? `${s.title}, ${s.sub.charAt(0).toLocaleLowerCase("es")}${s.sub.slice(1)}` : s.title };
}

/** The most-celebrated play of the acta, from the public reactions: the moment with the most of them. */
export function mostCelebrated(match: ClubMatch, docs: readonly ReactionDoc[], nameOf: (id: string) => string) {
  const counts = new Map<string, number>();
  for (const d of docs) for (const id of Object.keys(d.moments)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const [top] = [...counts.entries()].filter(([id]) => (match.events ?? []).some((e) => e.id === id)).sort((a, b) => b[1] - a[1]);
  if (!top) return null;
  const e = match.events!.find((x) => x.id === top[0])!;
  return { row: playRow(match, e, nameOf), tally: momentTally(docs, top[0]).filter((t) => t.count > 0) };
}
