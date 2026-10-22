// Inicio «Vidrio»: what the places say, pure. The lens's face at each phase of the match day (the countdown,
// the score, «Pendiente del acta»…), the headline and its line, the member's own line, the weather line, which
// ornaments flank the lens, el siete on the glass pitch (both orientations, with each player's marks), the
// momentum ribbon's items, the evening's light (the sun ribbon), the form letters, the season tiles, the
// shelf's places and their short hints. Built on the rules the rest of the site reads (derived/matchday,
// eventMeta, matchLineup, sun.ts, the vidrio data modules); the words follow the V-Inicio boards.
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import { dateMillis } from "../../../functions/src/matchEngine";
import { lineupWalk, parseMatchLineup, type LineupSlot } from "../../lib/matchLineup";
import type { ClubMatch, MatchEvent } from "../../lib/clubData";
import type { MatchdayModel, MatchdayPhase, ViewerRole } from "../../lib/derived/matchday";
import { eventMetaOf, eventSentence, settled } from "../../lib/eventMeta";
import { withGuestNames } from "../../lib/derived/guests";
import { venueName } from "../../lib/derived/venue";
import { floodlightsOn, sunPosition, sunTimes } from "../../lib/derived/sun";
import { madridDate, madridTime } from "../../lib/derived/madrid";
import { AWAITING_ACTA } from "../../lib/derived/kickoff";
import { capital, endSentence, plural } from "../../lib/derived/words";
import type { MatchWeather } from "../../lib/weather";
import type { RibbonItem, RibbonKind } from "../../components/vidrio/momentum";
import type { ViewerKind } from "../../lib/derived/vidrio/viewer";
import type { StripSegment } from "../../lib/derived/vidrio/strip";
import { minutesTag } from "../../lib/derived/vidrio/squadLive";
import { andList, dayWord, heroCopy, isLive, niceName, weekday, type CopyCtx } from "./inicioModel";

const MIN = 60_000;
/** An en dash that never breaks a score across lines. */
export const DASH = "⁠–⁠";
const score = (gf: number, ga: number) => `${gf}${DASH}${ga}`;

// ───────────────────────── places ─────────────────────────

export type PlaceId = "hoy" | "temporada" | "club" | "tu";
export const PLACE_LABEL: Record<PlaceId, string> = { hoy: "Hoy", temporada: "Temporada", club: "Club", tu: "Tú" };

/** The places a viewer has: «Tú» only for a member linked to a player of the squad. */
export const placesFor = (kind: ViewerKind): PlaceId[] => (kind === "jugador" ? ["hoy", "temporada", "club", "tu"] : ["hoy", "temporada", "club"]);

/** «#temporada» → temporada; anything else (or a «#tu» the viewer doesn't have) → hoy. */
export function placeFromHash(hash: string, places: readonly PlaceId[]): PlaceId {
  const id = hash.replace(/^#/, "").toLocaleLowerCase("es").replace("ú", "u");
  return (places as readonly string[]).includes(id) ? (id as PlaceId) : "hoy";
}

// ───────────────────────── phases ─────────────────────────

const LIVE_OR_OVER = new Set<MatchdayPhase>(["directo1", "descanso", "directo2", "final", "acta", "despues"]);
/** The match has been (or is being) played: there is a score and plays to tell. */
export const hasScore = (p: MatchdayPhase) => LIVE_OR_OVER.has(p);
/** Before the match of the day (the countdown). */
export const isAhead = (p: MatchdayPhase) => p === "semana" || p === "antes" || p === "pitido";
/** After the final whistle. */
export const isOver = (p: MatchdayPhase) => p === "final" || p === "acta" || p === "despues";

// ───────────────────────── words for places and times ─────────────────────────

/** «CDM PALOMERAS» → «CDM Palomeras» (the one formatter, lib/derived/venue). */
export { venueName };

/** «en el CDM Palomeras», «en el Campo de Pitutis», «en casa de Pitutis». */
export function venueWords(m: Pick<ClubMatch, "venue" | "home" | "rival">): string {
  const v = venueName(m.venue ?? "");
  if (!v) return m.home === false ? `en casa de ${m.rival?.trim() || "el rival"}` : "en Palomeras";
  return /^(cdm|campo|polideportivo|estadio|pabellón|complejo|instalaci)/i.test(v) ? `en el ${v}` : `en ${v}`;
}

/** «2 h 14 min», «14 min», «4 días»: what is left until `at`. */
export function leftWords(at: number, now: number): string {
  const mins = Math.max(0, Math.round((at - now) / MIN));
  if (mins >= 48 * 60) return plural(Math.round(mins / 1440), "día", "días");
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** «Domingo 25» for a kick-off. */
export function dayLabel(at: number): string {
  return `${capital(weekday(at))} ${Number(madridDate(at).slice(8))}`;
}

/** The first moment from `from` on (5-minute steps, up to `to`) when the masts would be on. */
export function floodlightsFrom(from: number, to: number): number | null {
  for (let t = from; t <= to; t += 5 * MIN) if (floodlightsOn(sunPosition(t).elevation, true)) return t;
  return null;
}

// ───────────────────────── a postponed match ─────────────────────────

const LONG_DAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" });
/** «el miércoles 14 de enero a las 19:00». */
export function newDateWords(at: number): string {
  return `el ${LONG_DAY.format(at).replace(",", "")} a las ${madridTime(at)}`;
}

/** The admin's reason for a postponement and its new date (null: por decidir). */
export function postponedOf(m: { postponedReason?: string; postponedTo?: number | null } | null | undefined): { reason: string; to: number | null } {
  const to = typeof m?.postponedTo === "number" && Number.isFinite(m.postponedTo) ? m.postponedTo : null;
  return { reason: m?.postponedReason?.trim() ?? "", to };
}

/** «Campo cerrado por lluvia. Se juega el miércoles 14 de enero a las 19:00.» · «… Sin fecha todavía.» */
export function postponedLine(m: { postponedReason?: string; postponedTo?: number | null } | null | undefined): string {
  const { reason, to } = postponedOf(m);
  const when = to !== null ? `Se juega ${newDateWords(to)}.` : reason ? "Sin fecha todavía." : "La nueva fecha saldrá aquí y en los avisos.";
  return reason ? `${endSentence(capital(reason))} ${when}` : when;
}

// ───────────────────────── the lens ─────────────────────────

export interface LensStatus {
  /** The live dot and «En directo». */
  live: boolean;
  /** The ticking minute («23′», «23′ +2»), in the mono face. */
  clock: string | null;
  text: string;
}

export interface LensFace {
  /** score: gf–ga · time: a kick-off («19:00») · word: a state in words («Aplazado») · none: no match. */
  mode: "score" | "time" | "word" | "none";
  gf: number;
  ga: number;
  big: string;
  /** Under the time: «Faltan 2 h 14 min». */
  under: string;
  status: LensStatus;
  ribbon: "momentum" | "sun" | null;
  /** What a screen reader hears for the face (never a ticking second). */
  label: string;
}

/** The lens at `now` for the match day. */
export function lensFace(day: Pick<MatchdayModel, "phase" | "match" | "kickoff" | "minute" | "added" | "score" | "jornada">, now: number): LensFace {
  const m = day.match;
  const rival = m?.rival?.trim() || "el rival";
  const s = day.score ?? { gf: 0, ga: 0 };
  const base: LensFace = { mode: "none", gf: s.gf, ga: s.ga, big: "", under: "", status: { live: false, clock: null, text: "" }, ribbon: null, label: "" };
  const ko = day.kickoff;
  const j = day.jornada ? `Jornada ${day.jornada}` : "El partido";
  const said = `Manchester Piti ${s.gf}, ${rival} ${s.ga}`;
  switch (day.phase) {
    case "pretemporada":
      return { ...base, mode: "word", big: "Pretemporada", status: { live: false, clock: null, text: "El calendario sale en unos días." }, label: "Pretemporada: el calendario sale en unos días." };
    case "semana": {
      if (!m || ko === null) return { ...base, mode: "word", big: "Sin partido", status: { live: false, clock: null, text: "El próximo saldrá aquí en cuanto tenga fecha." }, label: "Sin partido a la vista." };
      const when = dayWord(ko, now);
      return {
        ...base,
        mode: "time",
        big: madridTime(ko),
        under: dayLabel(ko),
        status: { live: false, clock: null, text: `${j}, ${when} ${venueWords(m)}` },
        ribbon: "sun",
        label: `${j}: Manchester Piti contra ${rival}, ${when} a las ${madridTime(ko)}.`,
      };
    }
    case "antes": {
      const at = ko ?? now;
      return {
        ...base,
        mode: "time",
        big: madridTime(at),
        under: `Faltan ${leftWords(at, now)}`,
        status: { live: false, clock: null, text: `${j}, hoy ${m ? venueWords(m) : ""}`.trim() },
        ribbon: "sun",
        label: `${j}: Manchester Piti contra ${rival}, hoy a las ${madridTime(at)}; faltan ${leftWords(at, now)}.`,
      };
    }
    case "pitido":
      return {
        ...base,
        mode: "time",
        big: ko !== null ? madridTime(ko) : "",
        under: "Pendiente del pitido",
        status: { live: false, clock: null, text: `Todo listo ${m ? venueWords(m) : ""}`.trim() },
        ribbon: "sun",
        label: `Manchester Piti contra ${rival}: pendiente del pitido inicial.`,
      };
    case "directo1":
    case "directo2": {
      const half = day.phase === "directo1" ? "de la primera parte" : "de la segunda parte";
      const clock = `${day.minute ?? 1}′${day.added ? ` +${day.added}` : ""}`;
      return { ...base, mode: "score", status: { live: true, clock, text: half }, ribbon: "momentum", label: `${said}. En directo, ${half.replace("de la ", "")}.` };
    }
    case "descanso":
      return { ...base, mode: "score", status: { live: true, clock: null, text: "Descanso" }, ribbon: "momentum", label: `${said}. Descanso.` };
    case "final":
      return { ...base, mode: "score", status: { live: false, clock: null, text: "Final. El acta llega en unos minutos." }, ribbon: "momentum", label: `Final: ${said}. El acta llega en unos minutos.` };
    case "acta":
    case "despues":
      return { ...base, mode: "score", status: { live: false, clock: null, text: "Final. El acta ya está publicada." }, ribbon: "momentum", label: `Final: ${said}.` };
    case "pendiente":
      return { ...base, mode: "word", big: AWAITING_ACTA, status: { live: false, clock: null, text: "La mesa no llegó a arrancar el reloj." }, label: `Manchester Piti contra ${rival}: ${AWAITING_ACTA.toLocaleLowerCase("es")}.` };
    case "aplazado": {
      const word = m?.status === "cancelled" ? "Suspendido" : "Aplazado";
      const line = postponedLine(m);
      return { ...base, mode: "word", big: word, status: { live: false, clock: null, text: line }, label: `Partido ante ${rival}, ${word.toLocaleLowerCase("es")}. ${line}` };
    }
  }
}

// ───────────────────────── the evening's light (before the match) ─────────────────────────

export interface SunRibbon {
  /** The sun's path, as an SVG path in a 500 × 74 box (the horizon at y 46). */
  path: string;
  /** % of the strip: the kick-off, the masts on (null: daylight all along), the sun now. */
  pitido: number;
  focos: number | null;
  sun: number;
  labels: { left: number; text: string; align: "start" | "middle" | "end" }[];
  label: string;
}

/** The light from two hours before the kick-off to two hours after: where the sun is, when the masts come on. */
export function sunRibbonOf(kickoff: number, now: number, duration = 50): SunRibbon {
  const from = kickoff - 2 * 60 * MIN;
  const to = kickoff + 2 * 60 * MIN;
  const span = to - from;
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = from + (span * i) / 48;
    const el = Math.max(-26, Math.min(40, sunPosition(t).elevation));
    pts.push(`${((i / 48) * 500).toFixed(1)} ${(46 - el).toFixed(1)}`);
  }
  const lit = floodlightsFrom(kickoff, kickoff + duration * MIN);
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - from) / span) * 100));
  const focos = lit === null ? null : pct(lit);
  const sunset = madridTime(sunTimes(kickoff).sunset);
  const sunAt = now >= from && now <= to ? now : kickoff;
  const labels: SunRibbon["labels"] = [
    { left: 0, text: madridTime(from), align: "start" },
    { left: 50, text: `${madridTime(kickoff)} pitido`, align: "middle" },
    { left: 100, text: madridTime(to), align: "end" },
  ];
  // (the masts' word never sits on the kick-off's: it moves right of it)
  if (focos !== null && focos < 88) labels.splice(2, 0, { left: Math.max(focos, 66), text: "focos", align: "middle" });
  const when = madridDate(kickoff) === madridDate(now) ? "esta tarde" : `el ${weekday(kickoff)}`;
  const lights = lit === null ? "se juega con luz de día" : lit <= kickoff ? "todo el partido con focos" : `con focos desde las ${madridTime(lit)}`;
  return { path: `M${pts.join(" L")}`, pitido: 50, focos, sun: pct(sunAt), labels, label: `La luz de ${when}: el sol se pone a las ${sunset}; ${lights}.` };
}

// ───────────────────────── the momentum ribbon ─────────────────────────

const TICK: Partial<Record<string, number>> = { goal: 26, goal_penalty: 26, goal_freekick: 26, opponent_goal: 26, own_goal: 26, opponent_own_goal: 26, woodwork: 20, opponent_woodwork: 20, penalty_saved: 20, save: 16, chance: 16, opponent_chance: 16, shot: 14, yellow_card: 14, red_card: 18, double_yellow: 18, corner: 10, opponent_corner: 10 };

/** The ribbon's kind for a play: only goals, cards, the post and a saved penalty get a mark (V-Inicio); the
 *  rest (chances, saves, corners, fouls) only shape the wave. */
export function ribbonKind(e: Pick<MatchEvent, "type" | "team">): RibbonKind {
  const meta = eventMetaOf(e);
  if (meta.goal) return "gol";
  if (meta.card === "r") return "roja";
  if (meta.card === "a") return "tarjeta";
  if (meta.glyph === "palo") return "palo";
  if (meta.glyph === "parada") return e.type === "penalty_saved" ? "parada" : "ocasion";
  if (meta.group === "ocasiones") return "ocasion";
  if (meta.group === "cambios") return "cambio";
  return "otro";
}

/** The match's plays as the ribbon's items: x in % of the match, our side above (a foul they suffer is theirs). */
export function ribbonItemsOf(match: Pick<ClubMatch, "events" | "duration" | "rival" | "guests">, nameOf: (id: string) => string, upTo = Infinity): RibbonItem[] {
  const total = Math.max(1, (match.duration ?? 50) * 60);
  const named = withGuestNames(match, nameOf);
  const rival = match.rival?.trim() || "el rival";
  return settled(match.events)
    .filter((e) => typeof e.elapsedSeconds === "number" || typeof e.minute === "number")
    .filter((e) => eventSeconds(e) <= upTo)
    .sort((a, b) => eventSeconds(a) - eventSeconds(b))
    .map((e) => {
      const meta = eventMetaOf(e);
      const side = meta.goal === "for" ? "us" : meta.goal === "against" ? "them" : e.type === "foul_received" ? "them" : meta.side;
      const said = eventSentence(e, { nameOf: named, rival });
      const minute = Math.max(1, Math.ceil(eventSeconds(e) / 60));
      return { id: e.id, x: Math.min(100, Math.round((eventSeconds(e) / total) * 1000) / 10), side, goal: !!meta.goal, h: TICK[e.type] ?? 12, kind: ribbonKind(e), label: `Minuto ${minute}, ${said.title.charAt(0).toLocaleLowerCase("es")}${said.title.slice(1)}` };
    });
}

// ───────────────────────── the headline ─────────────────────────

export interface HoyCopyCtx extends CopyCtx {
  /** Our place in the table now (for the después line). */
  position?: number | null;
  /** The MVP once the vote has closed (ties: every name) and his votes. */
  winner?: { names: string[]; votes: number | null } | null;
}

/** «Alcides, MVP con 9 votos.» · «MVP compartido: Alcides y Kevin.» */
export function winnerLine(w: { names: readonly string[]; votes: number | null } | null | undefined): string {
  if (!w?.names.length) return "";
  if (w.names.length > 1) return `MVP compartido: ${andList(w.names)}.`;
  return `${w.names[0]}, MVP${w.votes ? ` con ${plural(w.votes, "voto", "votos")}` : ""}.`;
}

export interface HoyCopy {
  h1: string;
  lede: string;
}

interface GoalStep {
  minute: number;
  ours: boolean;
  who: string;
  assist: string;
  gf: number;
  ga: number;
}

function goalSteps(match: ClubMatch, events: readonly MatchEvent[], nameOf: (id: string) => string): GoalStep[] {
  const named = withGuestNames(match, nameOf);
  const rival = match.rival?.trim() || "el rival";
  let gf = 0;
  let ga = 0;
  const out: GoalStep[] = [];
  for (const e of events) {
    const g = eventMetaOf(e).goal;
    if (!g) continue;
    if (g === "for") gf++;
    else ga++;
    const who = g === "against" ? rival : e.type === "opponent_own_goal" ? `En propia de ${rival}` : e.playerId ? named(e.playerId) : "El Piti";
    out.push({ minute: Math.max(1, Math.ceil(eventSeconds(e) / 60)), ours: g === "for", who, assist: e.assistPlayerId ? named(e.assistPlayerId) : "", gf, ga });
  }
  return out;
}

/** How an earlier goal reads after the one being told: «Alcides abrió en el 6», «Orduña fc empató en el 11». */
function goalPart(g: GoalStep, i: number): string {
  if (i === 0) return g.ours ? `${g.who} abrió en el ${g.minute}` : `${g.who} se adelantó en el ${g.minute}`;
  if (g.gf === g.ga) return `${g.who} empató en el ${g.minute}`;
  if (g.ours) return g.gf - g.ga === 1 ? `${g.who} volvió a adelantarnos en el ${g.minute}` : `${g.who} marcó en el ${g.minute}`;
  return g.ga > g.gf ? `${g.who} se puso por delante en el ${g.minute}` : `${g.who} recortó en el ${g.minute}`;
}

/** The live lede: «Minuto 21, a pase de Jordi. Alcides abrió en el 6 y Orduña fc empató en el 11.» */
export function goalsStory(match: ClubMatch, events: readonly MatchEvent[], nameOf: (id: string) => string): string {
  const steps = goalSteps(match, events, nameOf);
  const last = steps.at(-1);
  if (!last) return "";
  const head = endSentence(`Minuto ${last.minute}${last.ours && last.assist ? `, a pase de ${last.assist}` : ""}`);
  const before = steps.slice(0, -1);
  if (!before.length) return head;
  const parts = before.map(goalPart);
  const shown = parts.length > 3 ? parts.slice(-3) : parts;
  return `${head} ${endSentence(capital(andList(shown)))}`;
}

/** The after-match headline: «Alcides abre, Kevin cierra: 3–1» (two scorers of ours or more, a win). */
export function resultHeadline(match: ClubMatch, gf: number, ga: number, nameOf: (id: string) => string): string | null {
  const ours = goalSteps(match, settled(match.events), nameOf).filter((g) => g.ours && !g.who.startsWith("En propia"));
  if (gf <= ga || ours.length < 2) return null;
  const first = ours[0].who;
  const last = ours.at(-1)!.who;
  if (first === last) return gf >= 3 && ours.every((g) => g.who === first) ? `${first}, con los ${gf}: ${score(gf, ga)}` : null;
  return `${first} abre, ${last} cierra: ${score(gf, ga)}`;
}

/** «empezamos con luz de tarde y acabamos con focos.» */
export function lightWords(kickoff: number, minutes: number): string {
  const litStart = floodlightsOn(sunPosition(kickoff).elevation, true);
  const litEnd = floodlightsOn(sunPosition(kickoff + minutes * MIN).elevation, true);
  if (litStart) return "todo el partido con focos.";
  if (litEnd) return "empezamos con luz de tarde y acabamos con focos.";
  return "se juega con luz de día.";
}

/** The headline and the line under it, per phase and viewer (heroCopy's rules, the boards' words). */
export function hoyCopy(ctx: HoyCopyCtx): HoyCopy {
  const { day, view, nameOf } = ctx;
  const m = day.match;
  const base = heroCopy(ctx);
  const rival = m?.rival?.trim() || "el rival";
  switch (view.phase) {
    case "antes": {
      if (!m || day.kickoff === null) return { h1: base.h1, lede: base.sub };
      const h1 = ctx.estreno ? "Hoy debuta el Piti" : base.h1;
      const intro = `${day.jornada && !ctx.estreno ? `Jornada ${day.jornada} a las` : "A las"} ${madridTime(day.kickoff)} contra ${rival} ${venueWords(m)}.`;
      const light = lightWords(day.kickoff, m.duration ?? 50);
      const tail = ctx.estreno ? `Primer partido de la temporada: ${light}` : capital(light);
      const seven = ctx.sevenPublished ? "" : " El siete sale aquí en cuanto lo publique el capitán.";
      return { h1, lede: `${intro} ${tail}${seven}` };
    }
    case "semana": {
      // (the weather has its own line under the actions: the lede says when and where)
      if (!m || day.kickoff === null) return { h1: base.h1, lede: base.sub };
      const first = ctx.estreno ? "Primer partido de la temporada: " : "";
      return { h1: base.h1, lede: `${first}${first ? "a" : "A"} las ${madridTime(day.kickoff)} contra ${rival} ${venueWords(m)}. ${capital(lightWords(day.kickoff, m.duration ?? 50))}` };
    }
    case "directo1":
    case "directo2": {
      const story = m ? goalsStory(m, view.events, nameOf) : "";
      return { h1: base.h1, lede: story || base.sub };
    }
    case "acta": {
      if (!m) return { h1: base.h1, lede: base.sub };
      const h1 = resultHeadline(m, view.gf, view.ga, nameOf) ?? base.h1.replace(/^Los .+$/, resultWord(view.gf, view.ga, ctx.estreno));
      const first = ctx.estreno ? (view.gf > view.ga ? "Primera victoria de la temporada." : view.gf === view.ga ? "Primer punto de la temporada." : "Primer partido de la temporada.") : view.gf > view.ga ? "Tres puntos más." : view.gf === view.ga ? "Un punto más." : "Esta vez no.";
      const debut = ctx.estreno ? " Todos los que jugaron desbloquean «Debut»." : "";
      return { h1, lede: `${first}${debut} ${ctx.member ? "Ya se puede votar al MVP." : "Los socios votan al MVP; el ganador sale aquí."}`.trim() };
    }
    case "despues": {
      // (the same headline as with the acta; the MVP once the vote has closed; the next match has its own line)
      if (!m) return { h1: base.h1, lede: base.sub };
      const h1 = resultHeadline(m, view.gf, view.ga, nameOf) ?? resultWord(view.gf, view.ga, ctx.estreno);
      return { h1, lede: `${winnerLine(ctx.winner)} La crónica y las notas, en el partido.`.trim() };
    }
    case "aplazado": {
      // (the lens says the reason; the line says when it is played now, or that the date comes)
      const { to } = postponedOf(m);
      const word = m?.status === "cancelled" ? "suspendido" : "aplazado";
      return { h1: base.h1, lede: to !== null ? `El partido ante ${rival} se juega ${newDateWords(to)}.` : `El partido ante ${rival} queda ${word}. La nueva fecha saldrá aquí y en los avisos.` };
    }
    case "pendiente":
      // (the lens already says «Pendiente del acta»: the headline says what is missing)
      return { h1: "Falta el acta del partido", lede: `Contra ${rival}: el resultado, los goles y los minutos salen con el acta.` };
    default:
      return { h1: base.h1, lede: base.sub };
  }
}

const NUM = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
function resultWord(gf: number, ga: number, estreno: boolean): string {
  const tail = estreno ? " el estreno" : "";
  if (gf > ga) return `Ganamos ${score(gf, ga)}${tail}`;
  if (gf < ga) return `Perdemos ${score(gf, ga)}${tail}`;
  return `Empate a ${NUM[gf] ?? gf}${tail}`;
}

// ───────────────────────── the viewer's own line ─────────────────────────

const POS_WORD: Record<string, string> = {
  POR: "portero",
  DFC: "central",
  LIB: "líbero",
  LI: "lateral izquierdo",
  LD: "lateral derecho",
  MCD: "pivote",
  MC: "medio",
  MI: "interior izquierdo",
  MD: "interior derecho",
  MCO: "mediapunta",
  EI: "extremo izquierdo",
  ED: "extremo derecho",
  DC: "delantero centro",
};

export interface MeLineCtx {
  phase: MatchdayPhase;
  kind: ViewerKind;
  /** «Jordi». */
  name: string;
  role: ViewerRole;
  /** His slot in the published seven («LD»), when he is in it. */
  code: string | null;
  porra: { gf: number; ga: number } | null;
  /** The score now (live) or the final one. */
  gf: number;
  ga: number;
  /** His goals and the goals he set up so far tonight (in order), and the score each one made. */
  goals: readonly { gf: number; ga: number }[];
  assists: readonly { gf: number; ga: number }[];
  /** His minutes (the acta's ledger), once played. */
  minutes: number | null;
  /** When the MVP vote closes (ms), while it is open. */
  voteClosesAt: number | null;
}

function porraNow(p: { gf: number; ga: number }, gf: number, ga: number): string {
  const s = `${p.gf}–${p.ga}`;
  if (p.gf === gf && p.ga === ga) return `Tu porra, ${s}, la clavas de momento.`;
  if (p.gf >= gf && p.ga >= ga) {
    const need = p.gf - gf + (p.ga - ga);
    return need === 1 ? `Tu porra, ${s}, va bien: te falta un gol.` : `Tu porra, ${s}, va bien.`;
  }
  return `Tu porra, ${s}, se te escapa.`;
}

/** The MVP vote's turnout while it is open (never who leads): «9 de 16 ya han votado.» · «9 ya han votado.» */
export function turnoutLine(t: { total: number; eligible: number | null } | null): string {
  if (!t) return "";
  if (!t.total) return "Nadie ha votado todavía.";
  const verb = t.total === 1 ? "ya ha votado" : "ya han votado";
  return t.eligible ? `${t.total} de ${t.eligible} ${verb}.` : `${t.total} ${verb}.`;
}

/** The porra's line in Tú: «Vas bien: te falta un gol nuestro.» while live, «Acertaste el resultado.» after. */
export function porraSub(p: { gf: number; ga: number } | null, gf: number, ga: number, phase: MatchdayPhase): string {
  if (!p) return isAhead(phase) ? "Se cierra con el pitido." : "Esta vez sin porra.";
  if (isAhead(phase)) return "Se cierra con el pitido.";
  if (isOver(phase)) return p.gf === gf && p.ga === ga ? "Acertaste el resultado." : `Acabó ${gf}–${ga}.`;
  if (!isLive(phase)) return "Se cierra con el pitido.";
  if (p.gf === gf && p.ga === ga) return "La clavas de momento.";
  if (p.gf >= gf && p.ga >= ga) {
    const ours = p.gf - gf;
    const theirs = p.ga - ga;
    if (ours + theirs === 1) return ours ? "Vas bien: te falta un gol nuestro." : "Vas bien: te falta un gol de ellos.";
    return `Vas bien: te faltan ${ours + theirs} goles.`;
  }
  return `Se te escapa: ahora va ${gf}–${ga}.`;
}

/** The member's own line under the headline (null for a fan, or when there is nothing of his to say). */
export function meLineOf(c: MeLineCtx): string | null {
  if (c.kind === "aficion") return null;
  const p = c.phase;
  const porraSet = c.porra ? `Tu porra: ${c.porra.gf}–${c.porra.ga}.` : "";
  const exact = !!c.porra && c.porra.gf === c.gf && c.porra.ga === c.ga;
  if (p === "antes" || p === "pitido" || p === "semana") {
    if (c.kind === "jugador") {
      const role =
        c.role === "ausente"
          ? `${c.name}, estás de baja.`
          : c.role === "titular"
            ? c.code && POS_WORD[c.code]
              ? `${c.name}, juegas de ${POS_WORD[c.code]}.`
              : `${c.name}, sales en el siete.`
            : c.role === "suplente"
              ? `${c.name}, empiezas en el banquillo.`
              : c.role === "anotador"
                ? `${c.name}, hoy anotas tú.`
                : p === "semana"
                  ? `${c.name}, la convocatoria te espera.`
                  : `${c.name}, esta vez desde la grada.`;
      return `${role} ${porraSet || (p === "pitido" ? "" : "Tu porra, sin poner: se cierra con el pitido.")}`.trim();
    }
    return c.porra ? `${c.name}, tu porra: ${c.porra.gf}–${c.porra.ga}. Se cierra con el pitido.` : `${c.name}, la porra se cierra con el pitido.`;
  }
  if (isLive(p)) {
    const lastGoal = c.goals.at(-1);
    const lastAssist = c.assists.at(-1);
    const mine =
      c.kind === "jugador" && lastAssist && (!lastGoal || lastAssist.gf + lastAssist.ga >= lastGoal.gf + lastGoal.ga)
        ? `${c.name}, el ${lastAssist.gf}–${lastAssist.ga} lleva tu pase.`
        : c.kind === "jugador" && lastGoal
          ? `${c.name}, el ${lastGoal.gf}–${lastGoal.ga} es tuyo.`
          : "";
    const porra = c.porra ? porraNow(c.porra, c.gf, c.ga) : "";
    if (mine) return `${mine} ${porra}`.trim();
    return c.porra ? `${c.name}, ${porra.charAt(0).toLocaleLowerCase("es")}${porra.slice(1)}` : null;
  }
  if (p === "final" || p === "acta" || p === "despues") {
    const parts: string[] = [];
    if (c.kind === "jugador" && c.minutes) {
      const did = c.assists.length ? ` y diste ${c.assists.length === 1 ? `el pase del ${c.assists[0].gf}–${c.assists[0].ga}` : `${c.assists.length} pases de gol`}` : "";
      const goals = c.goals.length ? ` y marcaste ${c.goals.length === 1 ? "un gol" : `${c.goals.length} goles`}` : "";
      parts.push(`${c.name}, jugaste ${c.minutes === 1 ? "un minuto" : `los ${Math.round(c.minutes)} minutos`}${goals}${did}.`);
    }
    if (c.porra) parts.push(exact ? "Acertaste la porra." : "Tu porra no entró.");
    if (c.voteClosesAt !== null) parts.push(parts.length ? `Vota al MVP hasta el ${weekday(c.voteClosesAt)}.` : `${c.name}, ya puedes votar al MVP hasta el ${weekday(c.voteClosesAt)}.`);
    if (!parts.length) return null;
    if (!parts[0].startsWith(c.name)) parts[0] = `${c.name}, ${parts[0].charAt(0).toLocaleLowerCase("es")}${parts[0].slice(1)}`;
    return parts.join(" ");
  }
  return null;
}

// ───────────────────────── the weather line ─────────────────────────

/** «14°, nublado. El sol se pone a las 19:20.» · «12°, sin lluvia. Con focos desde las 19:20.» · «Próximo: …». */
export function weatherLineOf(day: Pick<MatchdayModel, "phase" | "match" | "kickoff" | "next">, weather: MatchWeather | null, hourly: HourlyWords | null = null): string | null {
  const p = day.phase;
  const ko = day.kickoff;
  if ((isAhead(p) || isLive(p)) && ko !== null) {
    // (before the match, by the hour when the forecast has it: «De 14° a 11°, sin lluvia.»)
    const w = hourly && isAhead(p) ? `${hourly.line}. ` : weather ?`${weather.temp}°, ${isLive(p) ? (weather.rain && weather.rain >= 50 ? "con lluvia" : "sin lluvia") : weather.label.toLocaleLowerCase("es")}. ` : "";
    if (isLive(p)) {
      const lit = floodlightsFrom(ko, ko + (day.match?.duration ?? 50) * MIN);
      return `${w}${lit === null ? "Con luz de día." : lit <= ko ? "Con focos todo el partido." : `Con focos desde las ${madridTime(lit)}.`}`;
    }
    return `${w}El sol se pone a las ${madridTime(sunTimes(ko).sunset)}.`;
  }
  const n = isOver(p) || p === "pendiente" || p === "aplazado" ? day.next : null;
  if (n) {
    const at = dateMillis(n.date);
    if (!Number.isFinite(at)) return `Próximo: ${n.rival ?? "rival por confirmar"}, fecha por confirmar.`;
    const where = n.home === false ? `en casa de ${n.rival ?? "el rival"}` : "en Palomeras";
    return `Próximo: ${weekday(at)} ${Number(madridDate(at).slice(8))}, ${madridTime(at)}, ${where}.`;
  }
  return null;
}

// ───────────────────────── the weather by the hour ─────────────────────────

export interface HourlyWords {
  /** «14° al pitido, 11° al final; sin lluvia». */
  previa: string;
  /** «De 14° a 11°, sin lluvia» (the weather line before the match). */
  line: string;
}

/** The forecast's hours (kick-off −1 h … +2 h) read for the match: the temperature at the whistle and at the
 *  end, and the rain over the match. Null without the kick-off hour. */
export function hourlyWords(hours: readonly { at: number; temp: number; rain: number | null; kickoff: boolean }[], kickoff: number, minutes = 50): HourlyWords | null {
  const ko = hours.find((h) => h.kickoff) ?? hours.find((h) => h.at <= kickoff && kickoff < h.at + 3_600_000);
  if (!ko) return null;
  const endAt = kickoff + minutes * MIN;
  // (the hour that starts nearest the final whistle: a 19:00 kick-off ends «at 20:00»)
  const end = hours.reduce((best, h) => (Math.abs(h.at - endAt) < Math.abs(best.at - endAt) ? h : best), ko);
  const during = hours.filter((h) => h.at + 3_600_000 > kickoff && h.at <= endAt);
  const probs = during.map((h) => h.rain).filter((r): r is number => typeof r === "number");
  const rain = probs.length ? Math.max(...probs) : null;
  const rainWords = rain === null || rain < 30 ? "sin lluvia" : rain >= 70 ? "con lluvia" : `lluvia al ${Math.round(rain / 10) * 10} %`;
  const same = Math.round(ko.temp) === Math.round(end.temp);
  return {
    previa: same ? `${Math.round(ko.temp)}° todo el partido; ${rainWords}` : `${Math.round(ko.temp)}° al pitido, ${Math.round(end.temp)}° al final; ${rainWords}`,
    line: same ? `${Math.round(ko.temp)}°, ${rainWords}` : `De ${Math.round(ko.temp)}° a ${Math.round(end.temp)}°, ${rainWords}`,
  };
}

// ───────────────────────── the ornaments ─────────────────────────

export type LeftOrn = "siete" | "viene" | null;
export type RightOrn = "convo" | "previa" | "plays" | "mvp" | "winner" | "fecha" | "viene" | null;

/** Which ornaments flank the lens: el siete (or what comes next when there is none) and, on the right, the
 *  convocatoria (members) or la previa (fans) before, the plays while live and after, the MVP vote while it
 *  is open (members), the MVP once it has closed (everyone). */
export function ornamentsOf(phase: MatchdayPhase, kind: ViewerKind, hasSeven: boolean, voteOpen: boolean, hasWinner = false): { left: LeftOrn; right: RightOrn } {
  const member = kind !== "aficion";
  const left: LeftOrn = hasSeven && phase !== "aplazado" && phase !== "pretemporada" ? "siete" : "viene";
  switch (phase) {
    case "semana":
    case "antes":
    case "pitido":
      return { left, right: member ? "convo" : "previa" };
    case "directo1":
    case "descanso":
    case "directo2":
    case "final":
      return { left, right: "plays" };
    case "acta":
    case "despues":
      return { left, right: member && voteOpen ? "mvp" : !voteOpen && hasWinner ? "winner" : "plays" };
    case "pendiente":
      return { left, right: left === "siete" ? "viene" : null };
    case "aplazado":
      // (what comes next, and the postponed match's new date or that it comes)
      return { left: "viene", right: "fecha" };
    default:
      return { left: "viene", right: null };
  }
}

// ───────────────────────── el siete on the glass pitch ─────────────────────────

const COUNT_WORDS = ["", "un", "dos", "tres", "cuatro", "cinco"];
const counted = (n: number, one: string, many: string) => `${COUNT_WORDS[n] ?? String(n)} ${n === 1 ? one : many}`;

/** What the MVP did that night, from his marks on the pitch: «Un gol y un pase de gol.» (null: nothing to count). */
export function winnerDeeds(tags: readonly Pick<SieteTag, "kind">[]): string | null {
  const n = (k: SieteTag["kind"]) => tags.filter((t) => t.kind === k).length;
  const parts = [
    n("gol") && counted(n("gol"), "gol", "goles"),
    n("asis") && counted(n("asis"), "pase de gol", "pases de gol"),
    n("parada") && counted(n("parada"), "penalti parado", "penaltis parados"),
  ].filter((p): p is string => !!p);
  if (!parts.length) return null;
  const line = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0];
  return `${line.charAt(0).toLocaleUpperCase("es")}${line.slice(1)}.`;
}

export interface SieteTag {
  kind: "gol" | "asis" | "amarilla" | "roja" | "cambio" | "parada" | "minutos";
  /** «21′» (a play's minute), «35 min» (his minutes on the pitch). */
  text: string;
  /** Our latest goal while the match is on (gold: only our goal). */
  gold: boolean;
  label: string;
}

export interface SieteSpot {
  id: string;
  num: string;
  /** In capitals, as on the back of the shirt. */
  name: string;
  captain: boolean;
  me: boolean;
  /** Horizontal pitch (our goal on the left): % of the pitch, tags towards the centre. */
  h: { left: number; top: number; tagsLeft: boolean };
  /** Vertical pitch (our goal at the bottom). */
  v: { left: number; top: number; tagsLeft: boolean };
  tags: SieteTag[];
}

/** A seven without a published lineup stands in a 3-2-1 (keeper first), in the pizarra's frame. */
const DEFAULT_SLOTS: readonly (readonly [number, number])[] = [[50, 92], [18, 70], [50, 74], [82, 70], [34, 46], [66, 46], [50, 20]];

/** The pizarra's frame (x across, y 0 their goal → 100 ours) → the two pitches. */
export function spotOf(x: number, y: number): Pick<SieteSpot, "h" | "v"> {
  const vTop = Math.max(8, Math.min(90, 6 + (y - 14) * 1.06));
  const vLeft = Math.max(18, Math.min(82, 50 + (x - 50) * 1.25));
  const hLeft = 100 - vTop;
  const hTop = Math.max(20, Math.min(80, 50 + (x - 50) * 1.1));
  // (tags go where there is room: outwards in the middle of the pitch, inwards at its edges)
  const vTags = vLeft > 75 ? true : vLeft < 25 ? false : vLeft < 50;
  const hTags = hLeft > 75 || (hLeft > 55 && hTop < 50);
  return { v: { left: vLeft, top: vTop, tagsLeft: vTags }, h: { left: hLeft, top: hTop, tagsLeft: hTags } };
}

export interface SieteCtx {
  match: ClubMatch;
  phase: MatchdayPhase;
  /** The plays that stand so far (all of them after the match). */
  events: readonly MatchEvent[];
  /** The seven when there is no published lineup (the convocatoria's titulares, keeper first). */
  seven: readonly string[];
  nameOf: (id: string) => string;
  numOf: (id: string) => string;
  captainId: string | null;
  me: string | null;
  /** Each player's minutes on the pitch when the match had changes (derived/vidrio/rotation): a chip «35 min»
   *  first instead of one per change (F7's rolling changes would fill the pitch with arrows), then his two
   *  latest marks. */
  minutes?: ReadonlyMap<string, number> | null;
}

/** El siete as it stands at this point of the day (the subs walked in while live and after), with marks. */
export function sieteOf(c: SieteCtx): SieteSpot[] {
  const lineup = parseMatchLineup((c.match as ClubMatch & { lineup?: unknown }).lineup);
  const slots: LineupSlot[] = lineup
    ? lineup.slots
    : c.seven.slice(0, 7).map((id, i) => ({ playerId: id, code: i === 0 ? "POR" : "MC", x: DEFAULT_SLOTS[i][0], y: DEFAULT_SLOTS[i][1] }));
  if (!slots.length) return [];
  const played = hasScore(c.phase);
  // (in the order they happened: an acta may store them in any order, and «the newest» below means by the clock)
  const events = played ? settled([...c.events]).map((e, i) => ({ e, i })).sort((a, b) => eventSeconds(a.e) - eventSeconds(b.e) || a.i - b.i).map((x) => x.e) : [];
  const now = played ? lineupWalk({ slots }, events).now : slots;
  const goals = events.filter((e) => eventMetaOf(e).goal === "for");
  const lastGoal = isLive(c.phase) ? goals.at(-1)?.id : undefined;
  const min = (e: MatchEvent) => Math.max(1, Math.ceil(eventSeconds(e) / 60));
  const mins = played && c.minutes?.size ? c.minutes : null;
  const tagsOf = (id: string): SieteTag[] => {
    const out: SieteTag[] = [];
    for (const e of events) {
      const meta = eventMetaOf(e);
      const m = min(e);
      if (!mins && e.type === "substitution" && e.inPlayerId === id) out.push({ kind: "cambio", text: `${m}′`, gold: false, label: `Entró en el ${m}` });
      if (e.playerId !== id && e.assistPlayerId !== id) continue;
      if (meta.goal === "for" && e.type !== "opponent_own_goal" && e.playerId === id) out.push({ kind: "gol", text: `${m}′`, gold: e.id === lastGoal, label: `Gol en el ${m}` });
      if (meta.goal === "for" && e.assistPlayerId === id) out.push({ kind: "asis", text: `${m}′`, gold: false, label: `Asistencia en el ${m}` });
      if (e.playerId === id && meta.card === "a" && meta.side === "us") out.push({ kind: "amarilla", text: `${m}′`, gold: false, label: `Amarilla en el ${m}` });
      if (e.playerId === id && meta.card === "r" && meta.side === "us") out.push({ kind: "roja", text: `${m}′`, gold: false, label: `Roja en el ${m}` });
      if (e.playerId === id && e.type === "penalty_saved") out.push({ kind: "parada", text: `${m}′`, gold: false, label: `Paró un penalti en el ${m}` });
    }
    // (the newest first, as the boards: the goal of the night above the pass that came before it)
    const n = mins?.get(id);
    if (n !== undefined) {
      return [minutesTag(n, isLive(c.phase)), ...out.slice(-2).reverse()];
    }
    return out.slice(-3).reverse();
  };
  return now.map((s) => ({
    id: s.playerId,
    num: c.numOf(s.playerId),
    name: c.nameOf(s.playerId).toLocaleUpperCase("es"),
    captain: !!c.captainId && c.captainId === s.playerId,
    me: !!c.me && c.me === s.playerId,
    ...spotOf(s.x, s.y),
    tags: tagsOf(s.playerId),
  }));
}

/** The line under the pitch: the bench before and while live, the changes after. */
export function benchLineOf(match: ClubMatch, phase: MatchdayPhase, events: readonly MatchEvent[], nameOf: (id: string) => string, published: boolean | { at: number; now: number }): string {
  const name = withGuestNames(match, nameOf);
  if (isOver(phase)) {
    const subs = settled([...events]).filter((e) => e.type === "substitution" && e.inPlayerId && e.playerId).sort((a, b) => eventSeconds(a) - eventSeconds(b));
    if (!subs.length) return "Los siete jugaron el partido entero.";
    return endSentence(`${subs.length === 1 ? "Entró" : "Entraron"} ${andList(subs.map((e) => `${name(e.inPlayerId!)} por ${name(e.playerId!)} (${Math.max(1, Math.ceil(eventSeconds(e) / 60))}′)`))}`);
  }
  const bench = (match.bench ?? []).filter((id) => !settled([...events]).some((e) => e.type === "substitution" && e.inPlayerId === id));
  const names = bench.map((id) => name(id));
  const benchLine = names.length ? endSentence(`En el banquillo: ${andList(names)}`) : "Sin banquillo.";
  if (phase !== "antes" || !published) return benchLine;
  // («Publicado ayer desde la pizarra.»: when the captain sent it, in words)
  const when = typeof published === "object" && Number.isFinite(published.at) ? ` ${publishedWhen(published.at, published.now)}` : "";
  return `Publicado${when} desde la pizarra. ${benchLine}`;
}

/** «hoy», «ayer», «el jueves», «el 12 de octubre»: when a thing happened, seen from `now` (Madrid days). */
export function publishedWhen(at: number, now: number): string {
  const day = (ms: number) => Date.UTC(Number(madridDate(ms).slice(0, 4)), Number(madridDate(ms).slice(5, 7)) - 1, Number(madridDate(ms).slice(8, 10))) / 86_400_000;
  const d = day(now) - day(at);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 7) return `el ${weekday(at)}`;
  return `el ${Number(madridDate(at).slice(8))} de ${new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", month: "long" }).format(at)}`;
}

// ───────────────────────── the season's form and tiles ─────────────────────────

export interface FormLetter {
  l: string;
  tone: "g" | "e" | "p" | "prov" | "empty";
  label: string;
}

/** The last six jornadas as letters (oldest first): played ones, tonight's provisional G/E/P, the rest empty. */
export function formaOf(segments: readonly Pick<StripSegment, "jornada" | "state" | "letter" | "score">[], max = 6): FormLetter[] {
  const counted = segments.filter((s) => s.state !== "suspendido");
  const anchor = counted.findIndex((s) => s.state === "directo" || s.state === "hoy");
  const lastPlayed = counted.map((s) => s.state).lastIndexOf("jugado");
  // (the last `max` up to tonight's or the last played one; early in the season, the first `max`, the
  // ones still to play shown empty)
  const end = Math.max(anchor >= 0 ? anchor + 1 : lastPlayed + 1, Math.min(max, counted.length));
  const list = counted.slice(Math.max(0, end - max), end);
  const out = list.map((s): FormLetter => {
    const j = s.jornada ? `J${s.jornada}` : "Jornada";
    if (s.state === "jugado" && s.letter && s.letter !== "A") return { l: s.letter, tone: s.letter === "G" ? "g" : s.letter === "P" ? "p" : "e", label: `${j}: ${s.letter === "G" ? "ganado" : s.letter === "P" ? "perdido" : "empate"}` };
    if (s.state === "directo" && s.score) {
      const l = s.score.gf > s.score.ga ? "G" : s.score.gf < s.score.ga ? "P" : "E";
      return { l, tone: "prov", label: `${j}: ${l === "G" ? "ganando" : l === "P" ? "perdiendo" : "empatando"}, provisional` };
    }
    if (s.state === "aplazado") return { l: "A", tone: "empty", label: `${j}: aplazado` };
    if (s.state === "pendiente") return { l: "·", tone: "empty", label: `${j}: pendiente del acta` };
    return { l: s.jornada ? `J${s.jornada}` : "·", tone: "empty", label: `${j}: ${s.state === "hoy" ? "hoy" : "por jugar"}` };
  });
  return out;
}

// ───────────────────────── the shelf's short hints (phone) ─────────────────────────

/** The phone's hint from the long one: «2–1, minuto 23» → «2–1, 23′», «4º si acaba así» → «4º»,
 *  «Huberoski cumple el 27» → «Cumple el 27», «2 cosas pendientes» → «2 pendientes». */
export function shortHint(id: PlaceId, long: string): string {
  if (id === "hoy") {
    const words: Record<string, string> = { "Pendiente del pitido": "Al pitido", "Pendiente del acta": "Sin acta", "Sin partidos a la vista": "Sin partido", Pretemporada: "Pronto" };
    if (words[long]) return words[long];
    return long
      .replace(/, minuto (\d+)/, ", $1′")
      .replace(/^(Ganamos|Perdimos|Empate) /, "")
      .replace(/, al descanso$/, ", descanso")
      .replace(/^(\d\d:\d\d), .+$/, "$1")
      .replace(/^(\d+⁠?–⁠?\d+), (acta lista|MVP .+)$/, "$1")
      .replace(/^Aplazado al (.+)$/, "Al $1");
  }
  if (id === "temporada") return /^\d+º/.test(long) ? (long.match(/^\d+º/)?.[0] ?? long) : long.replace(/^Empieza la temporada$/, "Empieza").replace(/^Empieza esta noche$/, "Empieza hoy");
  if (id === "club") return long.replace(/^(\d+) en la plantilla$/, "$1 jugadores").replace(/^.+? (cumple .+)$/, (_, rest: string) => capital(rest));
  return long.replace(/ cosas? pendientes?$/, (s) => (s.includes("cosas") ? " pendientes" : " pendiente"));
}

// ───────────────────────── «Tú»: what waits on him ─────────────────────────

export interface PendingInput {
  /** The convocatoria he can still answer (open) and whether he has. */
  rsvp: { open: boolean; answered: boolean } | null;
  /** A turno of his this week not done. */
  turno: boolean;
  /** He owes the caja. */
  caja: boolean;
  /** Open polls he hasn't voted. */
  polls: number;
  /** The MVP vote is open and he hasn't voted. */
  mvp: boolean;
}

/** How many things wait on the jugador (the shelf's badge and «2 cosas pendientes»). */
export function pendingCount(p: PendingInput): number {
  return (p.rsvp?.open && !p.rsvp.answered ? 1 : 0) + (p.turno ? 1 : 0) + (p.caja ? 1 : 0) + p.polls + (p.mvp ? 1 : 0);
}

/** «Jordi, el 2–1 lleva tu pase» → the Tú place's title: his line's first sentence, else per phase. */
export function tuTitleOf(name: string, phase: MatchdayPhase, meLine: string | null): string {
  const first = meLine?.split(". ")[0]?.replace(/\.$/, "");
  if (first && first.startsWith(name) && first.length <= 40) return first;
  if (isLive(phase)) return `${name}, a seguirlo`;
  if (isOver(phase)) return `${name}, así quedó`;
  if (phase === "antes" || phase === "pitido") return `${name}, hoy se juega`;
  return `${name}, lo tuyo`;
}

/** The kick-off of a fixture as the rows say it: «Domingo 25, 14:00, en casa de Pitutis». */
export function fixtureLine(m: Pick<ClubMatch, "date" | "home" | "rival" | "venue">, now: number): string {
  const at = dateMillis(m.date);
  if (!Number.isFinite(at)) return "Fecha por confirmar";
  const when = madridDate(at) === madridDate(now) ? "Hoy" : `${dayLabel(at)}`;
  return `${when}, ${madridTime(at)}, ${m.home === false ? `en casa de ${m.rival ?? "el rival"}` : "en Palomeras"}`;
}

export { niceName };
