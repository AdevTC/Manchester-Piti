// What Inicio says at each phase of the match day, for each viewer, written from the data (lib/derived/matchday).
// Pure: the match at a minute (the score and the plays that stand by then) and the headline with its kicker and
// subline; the «Vidrio» places build on it (hoyModel.ts).
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import { dateMillis, minuteOfPlay, type MatchEvent } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../../lib/clubData";
import type { MatchdayModel, MatchdayPhase, ViewerRole } from "../../lib/derived/matchday";
import { floodlightsOn, sunPosition, sunTimes } from "../../lib/derived/sun";
import { madridDate, madridTime } from "../../lib/derived/madrid";
import { AWAITING_ACTA } from "../../lib/derived/kickoff";
import { eventMetaOf, eventSentence, settled } from "../../lib/eventMeta";
import { withGuestNames } from "../../lib/derived/guests";
import { endSentence, niceName } from "../../lib/derived/words";
import type { MatchWeather } from "../../lib/weather";

const MIN = 60_000;
const J = "⁠–⁠"; // an en dash that never breaks a score across lines

export { niceName };

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
    case "pendiente":
      // (nobody started la mesa's clock: nothing says how it ended, so no score and no «la está cerrando la mesa»)
      return { kick: `${jWord(day.jornada)}, ante ${rival}`, h1: AWAITING_ACTA, sub: "La mesa no llegó a arrancar el reloj: el resultado, los goles y los minutos salen con el acta.", live: false };
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
