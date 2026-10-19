// «Vidrio» · el directo, pure: what the floating score and its sheet say for the island's state of the match
// day (lib/derived/island islandOf), the fresh play unfolding (lib/derived/moments), the plays so far
// (lib/derived/vidrio/plays playsLog) and the connection. The component (LiveScore) feeds it and draws it.
import type { ClubMatch } from "../../../lib/clubData";
import { shownMinute, scoreOf } from "../../../lib/partidos";
import { dateMillis } from "../../../../functions/src/matchEngine";
import { lineupNow, parseMatchLineup, type LineupSlot } from "../../../lib/matchLineup";
import { settled } from "../../../lib/eventMeta";
import type { IslandState } from "../../../lib/derived/island";
import type { MatchMoment } from "../../../lib/derived/moments";
import type { PlayRow } from "../../../lib/derived/vidrio/plays";
import { withGuestNames } from "../../../lib/derived/guests";
import { madridTime } from "../../../lib/derived/madrid";
import { capital, plural } from "../../../lib/derived/words";
import type { FloatMatch } from "../floatText";

/** How long a fresh play keeps the drop unfolded (the board: ~4 s). */
export const DROP_HOLD_MS = 4000;
/** How many plays the sheet shows before «Ver todo». */
export const SHEET_PLAYS = 3;

const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });
const andList = (xs: readonly string[]): string => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);

/** The kinds of state where the ball has rolled (the score, the plays, «en el campo»). */
export const playing = (s: IslandState): boolean => s.kind === "live" || s.kind === "halftime";
/** States before the ball rolls: the kick-off time instead of a score. */
export const beforeKickoff = (s: IslandState): boolean => s.kind === "previa" || s.kind === "rsvp" || s.kind === "anotador" || s.kind === "pending";

/** The clock while live: «23′», «25′+2». */
export function clockText(m: ClubMatch, now: number): string {
  const minute = shownMinute(m, now);
  const phase = m.clock?.phase;
  const added = phase === "first" || phase === "second" ? m.clock?.added?.[phase === "first" ? 1 : 2] : undefined;
  return `${minute ?? 1}′${added ? `+${added}` : ""}`;
}

/** The drop's words for a fresh play while live (sentence case, as the board's drops): «¡Gol de Adrián T.C.!»,
 *  «Pase de Jordi, minuto 21». Null for the clock's turns the state already says (descanso, final). */
export function dropEvent(moment: MatchMoment | null, rows: readonly PlayRow[]): FloatMatch["event"] {
  if (!moment) return null;
  const minute = moment.minute !== null && moment.minute > 0 ? `minuto ${moment.minute}` : "";
  const join = (...xs: string[]) => xs.filter(Boolean).join(", ");
  switch (moment.kind) {
    case "arranque":
      return { title: "Empieza el partido", sub: "" };
    case "reanudacion":
      return { title: "Segunda parte", sub: moment.sub };
    case "descanso":
    case "final":
      return null;
  }
  const row = rows.find((r) => r.id === moment.id);
  const title = row?.title ?? capital(moment.title.toLocaleLowerCase("es"));
  if (moment.kind === "gol") return { title: `¡${title}!`, sub: join(row?.sub ?? "", minute) };
  return { title, sub: join(row?.sub ?? "", minute) };
}

export interface FloatInput {
  state: IslandState;
  now: number;
  /** The fresh play unfolding now (null at rest). */
  moment?: MatchMoment | null;
  rows?: readonly PlayRow[];
  /** A live score unconfirmed for over a minute (syncChip «stale»): minutes since. */
  staleMinutes?: number | null;
  /** The browser is offline (or the score was never confirmed): «Sin actualizar», no minute. */
  offline?: boolean;
}

/** The floating score's match for the island's state. */
export function floatOf({ state, now, moment = null, rows = [], staleMinutes = null, offline = false }: FloatInput): FloatMatch {
  const m = state.match;
  const rival = m.rival?.trim() || "Rival";
  const { gf, ga } = scoreOf(m);
  const at = dateMillis(m.date);
  const kickoff = Number.isFinite(at) ? at : undefined;
  const base = { us: gf, them: ga, rival, kickoff };
  if ((staleMinutes !== null || offline) && playing(state)) {
    const minute = staleMinutes !== null ? shownMinute(m, now - staleMinutes * 60_000) : null;
    return { ...base, state: "offline", staleAt: minute !== null ? `${minute}′` : undefined };
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
      return { ...base, state: "directo", clock: clockText(m, now), event: dropEvent(moment, rows) };
    case "halftime":
      return { ...base, state: "descanso" };
    case "final":
      return { ...base, state: state.published ? "acta" : "final" };
    case "vote":
      return { ...base, state: "mvp" };
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

export type SheetAction = { kind: "mesa" | "votar"; label: string } | null;

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
  state: IslandState;
  now: number;
  nameOf: (id: string) => string;
  /** «¿Vas hoy?»: the answers so far (members only). */
  counts?: { vienen: number; duda: number } | null;
  /** The plays so far (playsLog rows). */
  rows?: readonly PlayRow[];
}

/** The sheet's words for the island's state. */
export function sheetOf({ state, now, nameOf, counts = null, rows = [] }: SheetInput): SheetModel {
  const m = state.match;
  const { gf, ga } = scoreOf(m);
  const at = dateMillis(m.date);
  const time = Number.isFinite(at) ? madridTime(at) : "";
  const score = `${gf}–${ga}`;
  const field = playing(state) ? onFieldNames(m as ClubMatch & { lineup?: unknown }, nameOf) : [];
  const seven = beforeKickoff(state) ? onFieldNames({ starters: m.starters, guests: m.guests, events: [], lineup: (m as { lineup?: unknown }).lineup }, nameOf) : [];
  const sevenNote = seven.length ? `El siete ya está publicado: ${andList(seven)}.` : m.venue ? `En ${m.venue}.` : "";
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
      return { ...out, big: time, status: `Hoy a las ${time}`, note: counts ? `Vienen ${counts.vienen}${counts.duda ? ` · ${counts.duda} en duda` : ""}.` : sevenNote, plays: false, rsvp: true };
    case "anotador":
      return { ...out, big: time, status: `Hoy a las ${time}`, note: "La mesa del partido es tuya: se abre desde aquí.", plays: false, action: { kind: "mesa", label: "Abrir la mesa" } };
    case "pending":
      return { ...out, big: null, status: "Pendiente del pitido inicial", note: "Ya es la hora; la mesa aún no ha puesto el reloj.", plays: false, hide: "Ocultar hasta el próximo gol" };
    case "live": {
      const second = m.clock ? m.clock.phase === "second" : (shownMinute(m, now) ?? 0) > (m.duration ?? 50) / 2;
      return { ...out, live: true, clock: clockText(m, now), status: second ? "Segunda parte" : "Primera parte", hide: "Ocultar hasta el próximo gol" };
    }
    case "halftime":
      return { ...out, status: "Descanso", hide: "Ocultar hasta el próximo gol" };
    case "final":
      return state.published
        ? { ...out, status: "Final · acta publicada", note: "El resumen y las notas, en la ficha.", open: "Abrir el acta" }
        : { ...out, status: "Final · acta pendiente", note: "La mesa está repasando el acta." };
    case "vote": {
      const closes = typeof m.voteClosesAt === "number" ? m.voteClosesAt : now;
      return { ...out, status: `Votación hasta el ${WEEKDAY.format(closes)} a las ${madridTime(closes)}`, note: "Votan los socios: elige al mejor del partido.", open: "Abrir el acta", action: { kind: "votar", label: "Votar al mejor" }, hide: "Ocultar el aviso de votar al MVP" };
    }
    case "unplayed":
      return { ...out, big: null, status: "Pendiente del acta", note: "Nadie puso el reloj en la mesa: el resultado llegará con el acta.", plays: false };
  }
}

/** «2 jugadas más» for the sheet's «Ver todo». */
export const moreText = (n: number): string => `${plural(n, "jugada")} más`;

/** What «Ocultar» keys on: the float comes back by itself when this changes — the next goal while the ball
 *  rolls (or waits for it), the next state otherwise. */
export function hideMark(state: IslandState, lastGoal: string): string {
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

export function pageKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "inicio";
  const first = pathname.split("/").filter(Boolean)[0] ?? "otra";
  return first === "matches" ? "partido" : first === "jugadores" ? "jugador" : first;
}
