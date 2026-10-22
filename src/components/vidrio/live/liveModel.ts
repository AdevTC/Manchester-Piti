// «Vidrio» · el directo, pure: what the floating score and its sheet say for the island's state of the match
// day (lib/derived/island islandOf), the fresh play unfolding (lib/derived/moments), the plays so far
// (lib/derived/vidrio/plays playsLog) and the connection. The component (LiveScore) feeds it and draws it.
import type { ClubMatch } from "../../../lib/clubData";
import { shownMinute, scoreOf } from "../../../lib/partidos";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../../functions/src/matchEngine";
import { lineupNow, parseMatchLineup, type LineupSlot } from "../../../lib/matchLineup";
import { settled } from "../../../lib/eventMeta";
import { islandOf, todayMatch, whistleAt, type IslandState, type TodayViewer } from "../../../lib/derived/island";
import type { MatchMoment } from "../../../lib/derived/moments";
import type { PlayRow } from "../../../lib/derived/vidrio/plays";
import { withGuestNames } from "../../../lib/derived/guests";
import { madridDate, madridTime } from "../../../lib/derived/madrid";
import { capital, plural, scoreText } from "../../../lib/derived/words";
import { venueName } from "../../../lib/derived/venue";
import type { FloatMatch } from "../floatText";

/** How long a fresh play keeps the drop unfolded (the board: ~4 s). */
export const DROP_HOLD_MS = 4000;
/** How many plays the sheet shows before «Ver todo». */
export const SHEET_PLAYS = 3;

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
const andList = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** How long the result stays after the whistle (the rest of its match day in Madrid, 12 h at most). */
export const RESULT_HOLD_MS = 12 * 3_600_000;
/** How long «MVP: Alcides» shows after the vote closes (the same day as the winner's push). */
export const MVP_NEWS_MS = 24 * 3_600_000;
/** From when the match day's previa shows for everyone (Madrid hour), unless the seven is out earlier. */
export const PREVIA_FROM_HOUR = 8;

/** The match day as the floating score tells it: the island's states (lib/derived/island) plus «MVP: Alcides»
 *  once the vote has closed. */
export type FloatDay = IslandState | { kind: "mvpres"; match: ClubMatch; winner: string };

/** The kinds of state where the ball has rolled (the score, the plays, «en el campo»). */
export const playing = (s: FloatDay): boolean => s.kind === "live" || s.kind === "halftime";
/** States before the ball rolls: the kick-off time instead of a score. */
export const beforeKickoff = (s: FloatDay): boolean => s.kind === "previa" || s.kind === "rsvp" || s.kind === "anotador" || s.kind === "pending";

const HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false });
const hasSeven = (m: ClubMatch): boolean => !!(m as { lineup?: unknown }).lineup || !!m.starters?.length;

export interface DayInput {
  matches: readonly ClubMatch[];
  now: number;
  /** A member who hasn't voted (the island's «Vota al MVP»). */
  voteOpen: boolean;
  today?: TodayViewer;
  /** The MVP of a closed vote (its name), or null. */
  winnerOf?: (m: ClubMatch) => string | null;
}

/**
 * The floating score's state: the island's (islandOf) first; then the result of a match whose whistle went today
 * («3–1 · Final» → «Acta lista»: it stays for the rest of the match day, everyone); «MVP: Alcides» for a day
 * after the vote closes; and the previa of today's match from 08:00 Madrid (or as soon as its seven is out),
 * not only in the last two hours. Null: nothing to say.
 */
export function dayStateOf({ matches, now, voteOpen, today = {}, winnerOf = () => null }: DayInput): FloatDay | null {
  const base = islandOf(matches, now, voteOpen, today);
  if (base) return base;
  const visible = matches.filter(isVisibleMatch);
  let result: { match: ClubMatch; at: number } | undefined;
  for (const m of visible) {
    const phase = matchPhase(m, now);
    if (phase !== "awaiting_result" && phase !== "finished") continue;
    const at = whistleAt(m);
    if (at === null || now - at >= RESULT_HOLD_MS || madridDate(at) !== madridDate(now)) continue;
    if (!result || at > result.at) result = { match: m, at };
  }
  if (result) return { kind: "final", match: result.match, published: result.match.status === "finished" };
  const closed = visible
    .filter((m) => typeof m.voteClosesAt === "number" && m.voteClosesAt <= now && now - m.voteClosesAt < MVP_NEWS_MS)
    .sort((a, b) => (b.voteClosesAt ?? 0) - (a.voteClosesAt ?? 0))[0];
  const winner = closed ? winnerOf(closed) : null;
  if (closed && winner) return { kind: "mvpres", match: closed, winner };
  const day = todayMatch(matches, now);
  if (day && (Number(HOUR.format(now)) >= PREVIA_FROM_HOUR || hasSeven(day))) return { kind: "previa", match: day };
  return null;
}

/** «Ganamos 3–1», «Empatamos 2–2», «Perdemos 1–2». */
export function resultWords(gf: number, ga: number): string {
  return `${gf > ga ? "Ganamos" : gf === ga ? "Empatamos" : "Perdemos"} ${scoreText(gf, ga)}`;
}

/** The drop's words when the state itself turns (what no play says): «Ya está el acta» and «Vota al MVP» right
 *  after the final (`previous`: the state it comes from; null when unknown), «Alcides, MVP» whenever it arrives. */
export function turnEvent(state: FloatDay, now: number, previous: FloatDay["kind"] | null = "final"): FloatMatch["event"] {
  switch (state.kind) {
    case "final":
      return state.published && previous === "final" ? { title: "Ya está el acta", sub: "Goles, notas y logros" } : null;
    case "vote": {
      if (previous !== "final") return null;
      const closes = typeof state.match.voteClosesAt === "number" ? state.match.voteClosesAt : now;
      return { title: "Vota al MVP", sub: `Hasta el ${WEEKDAY.format(closes)} a las ${madridTime(closes)}` };
    }
    case "mvpres":
      return { title: `${state.winner}, MVP`, sub: "Lo han elegido los socios" };
    default:
      return null;
  }
}

/** The clock while live: «23′», «25′+2». */
export function clockText(m: ClubMatch, now: number): string {
  const minute = shownMinute(m, now);
  const phase = m.clock?.phase;
  const added = phase === "first" || phase === "second" ? m.clock?.added?.[phase === "first" ? 1 : 2] : undefined;
  return `${minute ?? 1}′${added ? `+${added}` : ""}`;
}

/** The drop's words for a fresh play or turn of the clock (sentence case, as the board's drops): «¡Gol de
 *  Adrián T.C.!» / «Pase de Jordi, minuto 21», «Descanso» / «2–1 en la primera parte», «Segunda parte» /
 *  «Quedan 25 minutos», «Final» / «Ganamos 3–1». `match` gives the score and the length of the match. */
export function dropEvent(moment: MatchMoment | null, rows: readonly PlayRow[], match?: Pick<ClubMatch, "goalsFor" | "goalsAgainst" | "events" | "duration" | "status" | "rival"> | null): FloatMatch["event"] {
  if (!moment) return null;
  const minute = moment.minute !== null && moment.minute > 0 ? `minuto ${moment.minute}` : "";
  const join = (...xs: string[]) => xs.filter(Boolean).join(", ");
  const { gf, ga } = match ? scoreOf(match as ClubMatch) : { gf: 0, ga: 0 };
  switch (moment.kind) {
    case "arranque":
      return { title: "Empieza el partido", sub: "El siete, en el campo" };
    case "reanudacion":
      return { title: "Segunda parte", sub: match ? `Quedan ${Math.round((match.duration ?? 50) / 2)} minutos` : moment.sub };
    case "descanso":
      return match ? { title: "Descanso", sub: `${scoreText(gf, ga)} en la primera parte` } : null;
    case "final":
      return match ? { title: "Final", sub: resultWords(gf, ga) } : null;
  }
  const row = rows.find((r) => r.id === moment.id);
  const title = row?.title ?? capital(moment.title.toLocaleLowerCase("es"));
  if (moment.kind === "gol") return { title: `¡${title}!`, sub: join(row?.sub ?? "", minute) };
  return { title, sub: join(row?.sub ?? "", minute) };
}

export interface FloatInput {
  state: FloatDay;
  now: number;
  /** The fresh play unfolding now (null at rest). */
  moment?: MatchMoment | null;
  rows?: readonly PlayRow[];
  /** A live score unconfirmed for over a minute (syncChip «stale»): minutes since. */
  staleMinutes?: number | null;
  /** The browser is offline (or the score was never confirmed): the score as it was. */
  offline?: boolean;
  /** Offline: when the score was last in sync (ms), for «Marcador del 26′, sin actualizar». */
  syncedAt?: number | null;
  /** The state's own turn unfolding (turnEvent), when no play does. */
  turn?: FloatMatch["event"];
}

/** The floating score's match for the island's state. */
export function floatOf({ state, now, moment = null, rows = [], staleMinutes = null, offline = false, syncedAt = null, turn = null }: FloatInput): FloatMatch {
  const m = state.match;
  const rival = m.rival?.trim() || "Rival";
  const { gf, ga } = scoreOf(m);
  const at = dateMillis(m.date);
  const kickoff = Number.isFinite(at) ? at : undefined;
  const event = dropEvent(moment, rows, m) ?? turn;
  const base = { us: gf, them: ga, rival, kickoff, event };
  if ((staleMinutes !== null || offline) && playing(state)) {
    const when = staleMinutes !== null ? now - staleMinutes * 60_000 : syncedAt;
    const minute = when !== null && when !== undefined ? shownMinute(m, when) : null;
    return { ...base, event: null, state: "offline", staleAt: minute !== null && minute > 0 ? `${minute}′` : undefined };
  }
  switch (state.kind) {
    case "previa":
      return { ...base, state: "previa" };
    case "rsvp":
      return { ...base, state: "rsvp" };
    case "anotador":
      return { ...base, state: "anotador" };
    case "pending":
      return { ...base, state: "pitido" };
    case "live":
      return { ...base, state: "directo", clock: clockText(m, now) };
    case "halftime":
      return { ...base, state: "descanso" };
    case "final":
      return { ...base, state: state.published ? "acta" : "final" };
    case "vote":
      return { ...base, state: "mvp" };
    case "mvpres":
      return { ...base, state: "mvpres", winner: state.winner };
    case "unplayed":
      return { ...base, state: "pendiente" };
  }
}

/** Who is on the pitch now: the match's lineup (or its seven) with the changes and reds so far. */
export function onFieldNames(match: Pick<ClubMatch, "starters" | "events" | "guests"> & { lineup?: unknown }, nameOf: (id: string) => string): string[] {
  const lineup = parseMatchLineup(match.lineup);
  const slots: LineupSlot[] | null = lineup ? lineup.slots : match.starters?.length ? match.starters.map((playerId) => ({ playerId, code: "MC", x: 50, y: 50 })) : null;
  if (!slots) return [];
  const named = withGuestNames(match, nameOf);
  return lineupNow({ slots }, settled(match.events)).map((s) => named(s.playerId));
}

export type SheetAction = { kind: "mesa" | "votar" | "acta"; label: string } | null;

export interface SheetModel {
  /** The head's big figure: the score, the kick-off time, or nothing («Pendiente del acta»). */
  big: string | null;
  /** The ball is rolling: the red «En directo» mark. */
  live: boolean;
  /** The clock beside it while live. */
  clock: string | null;
  /** The state in words: «Primera parte», «Hoy a las 19:00», «Final · acta pendiente». */
  status: string;
  /** A line under the plays (the seven before kick-off, the acta's state…), or "". */
  note: string;
  /** «En el campo: …» while the ball rolls ("" otherwise). */
  onField: string;
  /** Whether the last plays are shown. */
  plays: boolean;
  /** The state's own action, beside «Abrir el partido». */
  action: SheetAction;
  /** «Abrir el partido» or «Abrir el acta». */
  open: string;
  /** «Ocultar…»: what hiding does in this state. */
  hide: string;
  /** «¿Vas hoy?»: the Voy / Duda / No voy control. */
  rsvp: boolean;
}

export interface SheetInput {
  state: FloatDay;
  now: number;
  nameOf: (id: string) => string;
  /** «¿Vas hoy?»: the answers so far (members only). */
  counts?: { vienen: number; duda: number; no?: number; squad?: number } | null;
  /** The plays so far (playsLog rows). */
  rows?: readonly PlayRow[];
  /** He keeps la mesa of this match: «Volver a la mesa» while it is on. */
  anotador?: boolean;
  /** Not a member: the vote is the socios' («Votan los socios hasta el martes»). */
  fan?: boolean;
  /** Who keeps la mesa («Lo anota Jorge desde la mesa»), when known. */
  mesaLine?: string;
  /** The open vote's turnout (never who leads: the counts stay private until it closes). */
  turnout?: { total: number; eligible?: number } | null;
}

/** The sheet's words for the island's state. */
export function sheetOf({ state, now, nameOf, counts = null, rows = [], anotador = false, fan = false, mesaLine = "", turnout = null }: SheetInput): SheetModel {
  const m = state.match;
  const { gf, ga } = scoreOf(m);
  const at = dateMillis(m.date);
  const time = Number.isFinite(at) ? madridTime(at) : "";
  const score = scoreText(gf, ga);
  const field = playing(state) ? onFieldNames(m as ClubMatch & { lineup?: unknown }, nameOf) : [];
  const seven = beforeKickoff(state) ? onFieldNames({ starters: m.starters, guests: m.guests, events: [], lineup: (m as { lineup?: unknown }).lineup }, nameOf) : [];
  const sevenNote = [seven.length ? `El siete ya está publicado: ${andList(seven)}.` : m.venue ? `En ${venueName(m.venue)}.` : "", mesaLine].filter(Boolean).join(" ");
  const back: SheetAction = anotador ? { kind: "mesa", label: "Volver a la mesa" } : null;
  const out: SheetModel = {
    big: score,
    live: false,
    clock: null,
    status: "",
    note: "",
    onField: field.length ? `En el campo: ${andList(field)}.` : "",
    plays: rows.length > 0,
    action: null,
    open: "Abrir el partido",
    hide: "Ocultar por ahora",
    rsvp: false,
  };
  switch (state.kind) {
    case "previa":
      return { ...out, big: time, status: `Hoy a las ${time}`, note: sevenNote, plays: false };
    case "rsvp":
      return { ...out, big: time, status: `Hoy a las ${time}`, note: counts ? rsvpNote(counts, m, now) : sevenNote, plays: false, rsvp: true };
    case "anotador":
      return { ...out, big: time, status: `Hoy a las ${time}`, note: "La mesa del partido es tuya: se abre desde aquí.", plays: false, action: { kind: "mesa", label: "Abrir la mesa" } };
    case "pending":
      return { ...out, big: null, status: "Pendiente del pitido inicial", note: ["Ya es la hora; la mesa aún no ha puesto el reloj.", mesaLine].filter(Boolean).join(" "), plays: false, hide: "Ocultar hasta el próximo gol", action: back };
    case "live": {
      const second = m.clock ? m.clock.phase === "second" : (shownMinute(m, now) ?? 0) > (m.duration ?? 50) / 2;
      return { ...out, live: true, clock: clockText(m, now), status: second ? "Segunda parte" : "Primera parte", note: mesaLine, hide: "Ocultar hasta el próximo gol", action: back };
    }
    case "halftime":
      return { ...out, status: "Descanso", note: mesaLine, hide: "Ocultar hasta el próximo gol", action: back };
    case "final": {
      const votes = fan && typeof m.voteClosesAt === "number" && m.voteClosesAt > now ? ` Votan los socios hasta el ${WEEKDAY.format(m.voteClosesAt)}.` : "";
      return state.published
        ? { ...out, status: "Final · acta lista", note: `El resumen y las notas, en la ficha.${votes}`, open: "Abrir el acta" }
        : { ...out, status: "Final · acta pendiente", note: "La mesa está repasando el acta." };
    }
    case "mvpres":
      return { ...out, status: "Final · MVP del partido", note: `${state.winner}, MVP del partido: lo han elegido los socios.`, open: "Abrir el acta" };
    case "vote": {
      const closes = typeof m.voteClosesAt === "number" ? m.voteClosesAt : now;
      const votes = turnout && turnout.total > 0 ? ` ${turnout.eligible ? `${turnout.total} de ${turnout.eligible}` : turnout.total} ${turnout.total === 1 && !turnout.eligible ? "voto" : "votos"} hasta ahora.` : "";
      return { ...out, status: `Votación hasta el ${WEEKDAY.format(closes)} a las ${madridTime(closes)}`, note: `Votan los socios: elige al mejor del partido.${votes}`, open: "Abrir el acta", action: { kind: "votar", label: "Votar al mejor" }, hide: "Ocultar el aviso de votar al MVP" };
    }
    case "unplayed":
      return { ...out, big: null, status: "Pendiente del acta", note: "Nadie puso el reloj en la mesa: el resultado llegará con el acta.", plays: false };
  }
}

/** «Hasta las 19:00 · 3 vienen · 0 en duda · 0 no pueden · 13 sin contestar»: the answers so far and the
 *  deadline (kick-off: the convocatoria takes answers until then, memberWindows). */
export function rsvpNote(c: { vienen: number; duda: number; no?: number; squad?: number }, m: Pick<ClubMatch, "date">, now: number): string {
  const at = dateMillis(m.date);
  const until = Number.isFinite(at) && at > now ? `Hasta las ${madridTime(at)}` : "";
  const missing = c.squad ? Math.max(0, c.squad - c.vienen - c.duda - (c.no ?? 0)) : null;
  return [until, `${plural(c.vienen, "viene", "vienen")}`, `${c.duda} en duda`, c.no !== undefined ? `${c.no} no pueden` : "", missing !== null ? `${missing} sin contestar` : ""].filter(Boolean).join(" · ") + ".";
}

/** «2 jugadas más» for the sheet's «Ver todo». */
export const moreText = (n: number): string => `${plural(n, "jugada")} más`;

/** What «Ocultar» keys on: the float comes back by itself when this changes — the next goal while the ball
 *  rolls (or waits for it), the next state otherwise. */
export function hideMark(state: FloatDay, lastGoal: string): string {
  const group = state.kind === "live" || state.kind === "halftime" || state.kind === "pending" ? "juego" : state.kind;
  return `${state.match.id}:${group}:${group === "juego" ? lastGoal : ""}`;
}

/** A per-page key for the float's remembered spot. */
/** Pages whose top-right corner (under the bar) holds something of their own: the float rests bottom-right. */
const LOW_HOME = new Set(["partido", "partidos", "profile"]);

/** Where the floating score rests on desktop until someone moves it, per page (checked at 1440 on each):
 *  Inicio under the bar in the centre (its lens takes the score while it is on screen); a match page (its
 *  scoreboard), Partidos (its tools and «Buscar rival») and the profile (its LED board) in the bottom-right
 *  corner, the sheet opening up from it; the rest (plantilla, the shirts' rack below; estadísticas, el club,
 *  a ficha, el vestuario) top-right under the bar, where the page leaves air. The phone keeps it above the tab
 *  bar. La pizarra, la mesa and the admin don't mount it. */
export function floatHome(pathname: string): "centre" | "right" | "bottom-right" {
  const key = pageKey(pathname);
  return key === "inicio" ? "centre" : LOW_HOME.has(key) ? "bottom-right" : "right";
}

/** Space under «Sacar el marcador»'s in-page window at home: 24 px, or 110 where the floating score rests
 *  bottom-right (the Partidos board: the window sits above the drop, never over it). */
export const pipBottom = (pathname: string): number => (floatHome(pathname) === "bottom-right" ? 110 : 24);

export function pageKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "inicio";
  const first = pathname.split("/").filter(Boolean)[0] ?? "otra";
  return first === "matches" ? "partido" : first === "jugadores" ? "jugador" : first;
}

/** «Orduña fc» → «OR»: the rival's crest when there is no picture (the score's own window). */
export const rivalInitials = (rival: string): string =>
  Array.from(rival.replace(/[^\p{L}\p{N}]/gu, ""))
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("es") || "RV";
