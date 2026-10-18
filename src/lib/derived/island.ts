// What the live island says, through the whole match day. Its base state, by priority: a match being played
// (half-time apart) → one waiting for its whistle → one that ended under half an hour ago («Final», or «Ya está
// el acta» once published) → the open MVP vote for a member who hasn't voted → and on the match's own day, before
// the clock starts, «Hoy anotas tú» for the member assigned to la mesa, «¿Vas hoy?» for a member who hasn't
// answered, and «Antes del partido» for everyone in the two hours before kick-off. Over the base state, each
// fresh play (lib/derived/moments) unfolds its rótulo for ~9 s, and a live score the server hasn't confirmed
// turns the bug to «Sin conexión». Pure: LiveIsland renders it, the tests drive it with a controlled `now`.
import type { ClubMatch } from "../clubData";
import { eventMinute, OURS, scoreOf, shownMinute } from "../partidos";
import { kickoffState, PENDING_WHISTLE } from "./kickoff";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../functions/src/matchEngine";
import { withGuestNames } from "./guests";
import { madridDate, madridTime } from "./madrid";
import { boardSaid, WIPE_OF, type MatchMoment, type MomentKind, type TimedMoment } from "./moments";
import { rivalCode } from "../eventMeta";

/** How long «FINAL» stays in the island after the whistle. */
export const FINAL_HOLD_MS = 30 * 60_000;
/** How long before kick-off «Antes del partido» shows for everyone. */
export const PREVIA_MS = 2 * 3_600_000;

export type IslandState =
  /** The match of today, in the two hours before its kick-off. */
  | { kind: "previa"; match: ClubMatch }
  /** The match of today, before its clock starts, for a member who hasn't answered the convocatoria. */
  | { kind: "rsvp"; match: ClubMatch }
  /** The match of today, before its clock starts, for the member assigned to la mesa. */
  | { kind: "anotador"; match: ClubMatch }
  | { kind: "pending"; match: ClubMatch }
  | { kind: "live"; match: ClubMatch }
  | { kind: "halftime"; match: ClubMatch }
  /** `published`: the acta is out already (the vote may be open) — otherwise «acta pendiente». */
  | { kind: "final"; match: ClubMatch; published: boolean }
  | { kind: "vote"; match: ClubMatch };

/** What only a member's own data can tell about the match of today (todayMatch). */
export interface TodayViewer {
  /** He is one of la mesa's designated scorers. */
  anotador?: boolean;
  /** He hasn't answered the convocatoria (or just did, from the island: it stays to show the answer). */
  rsvp?: boolean;
}

/** When the whistle went: the clock's end (a clock, when there is one, is the only judge, as in matchPhase),
 *  or for matches without a clock the server-controlled `liveEndedAt`. */
export function whistleAt(m: Pick<ClubMatch, "clock" | "liveEndedAt">): number | null {
  if (m.clock) return m.clock.phase === "ended" && typeof m.clock.endedAt === "number" ? m.clock.endedAt : null;
  return typeof m.liveEndedAt === "number" ? m.liveEndedAt : null;
}

/** The match whose MVP vote is open (the latest by date), for a member; undefined otherwise. */
export function voteMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  return matches
    .filter(isVisibleMatch)
    .filter((m) => m.status === "finished" && typeof m.voteClosesAt === "number" && m.voteClosesAt > now)
    .sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}

/** The match of today (Madrid's calendar) whose clock hasn't started: one waiting for its whistle first, else
 *  the earliest still to kick off. Its convocatoria and its scorers are what a member's island reads. */
export function todayMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  const today = madridDate(now);
  const visible = matches.filter(isVisibleMatch);
  const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);
  const waiting = visible.filter((m) => kickoffState(m, now) === "pending_whistle").sort(byDate)[0];
  if (waiting) return waiting;
  return visible
    .filter((m) => {
      const at = dateMillis(m.date);
      return Number.isFinite(at) && at > now && madridDate(at) === today && kickoffState(m, now) === "scheduled" && matchPhase(m, now) === "scheduled";
    })
    .sort(byDate)[0];
}

/**
 * The island's base state at `now`, by priority: a match being played (its half-time apart) → one waiting for
 * its whistle (the earliest) → one that ended under FINAL_HOLD_MS ago (the latest) → the open MVP vote, only when
 * `voteOpen` (a member who hasn't voted) → the match of today: «anotador», «rsvp» (from `today`), «previa» in the
 * last PREVIA_MS. Null: no island.
 */
export function islandOf(matches: readonly ClubMatch[], now: number, voteOpen: boolean, today: TodayViewer = {}): IslandState | null {
  matches = matches.filter(isVisibleMatch);
  // (two at once: the earliest kick-off, whatever the list's order)
  const live = matches.filter((m) => matchPhase(m, now) === "playing").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (live) return { kind: kickoffState(live, now) === "halftime" ? "halftime" : "live", match: live };
  const waiting = matches.filter((m) => kickoffState(m, now) === "pending_whistle").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (waiting) return { kind: today.anotador ? "anotador" : "pending", match: waiting };
  let final: { match: ClubMatch; at: number } | undefined;
  for (const m of matches) {
    const phase = matchPhase(m, now);
    if (phase !== "awaiting_result" && phase !== "finished") continue;
    const at = whistleAt(m);
    // (a whistle stamped «after» now still counts: the island's clock ticks every 15 s and is only the server
    // time as this phone estimates it, so the end can arrive looking a few seconds ahead)
    if (at === null || now - at >= FINAL_HOLD_MS) continue;
    if (!final || at > final.at) final = { match: m, at };
  }
  if (final) return { kind: "final", match: final.match, published: final.match.status === "finished" };
  const vote = voteOpen ? voteMatch(matches, now) : undefined;
  if (vote) return { kind: "vote", match: vote };
  const day = todayMatch(matches, now);
  if (!day) return null;
  if (today.anotador) return { kind: "anotador", match: day };
  if (today.rsvp) return { kind: "rsvp", match: day };
  return dateMillis(day.date) - now <= PREVIA_MS ? { kind: "previa", match: day } : null;
}

export interface GoalMoment {
  ours: boolean;
  /** «¡GOL!» for ours; null for theirs (calmer). */
  head: string | null;
  /** «ERIK 19′ · 2–1» for ours, «Gol de MAD SKY · 2–2» for theirs. */
  rest: string;
  /** What the pill reads: head and rest. */
  text: string;
  /** The line a screen reader hears once. */
  said: string;
}

/** The old pill's line for goal `goalId` of `match` (the score is the match's now, PITI first); null when the
 *  goal is gone (undone) or isn't a goal. `nameOf` names a player in the match's season (nameFor). The island
 *  now tells every play through lib/derived/moments; this stays for the guests' naming tests. */
export function goalMoment(match: Pick<ClubMatch, "events" | "rival" | "status" | "goalsFor" | "goalsAgainst" | "guests">, goalId: string, nameOf: (id: string) => string): GoalMoment | null {
  if (!isVisibleMatch(match)) return null;
  const e = match.events?.find((x) => x.id === goalId);
  if (!e) return null;
  const ours = OURS.has(e.type);
  if (!ours && e.type !== "opponent_goal" && e.type !== "own_goal") return null;
  const rival = match.rival ?? "Rival";
  const { gf, ga } = scoreOf(match);
  const score = `${gf}–${ga}`;
  const board = `Manchester Piti ${gf}, ${rival} ${ga}.`;
  if (!ours) {
    const rest = `Gol de ${rival} · ${score}`;
    return { ours, head: null, rest, text: rest, said: `Gol de ${rival}. ${board}` };
  }
  const minute = eventMinute(e);
  const who = e.type === "opponent_own_goal" ? `autogol de ${rival}` : e.playerId ? withGuestNames(match, nameOf)(e.playerId) : "el Piti";
  const rest = `${who.toLocaleUpperCase("es")}${minute !== null ? ` ${minute}′` : ""} · ${score}`;
  return { ours, head: "¡GOL!", rest, text: `¡GOL! ${rest}`, said: `¡Gol del Piti! ${who}${minute !== null ? `, minuto ${minute}` : ""}. ${board}` };
}

/** The line a screen reader hears once when the island changes state (never on every minute). */
export function islandAnnouncement(state: IslandState, previous: IslandState["kind"] | null): string {
  const m = state.match;
  const rival = m.rival ?? "Rival";
  const { gf, ga } = scoreOf(m);
  const board = boardSaid(rival, gf, ga);
  const time = madridTime(dateMillis(m.date));
  switch (state.kind) {
    case "previa":
      return `Hoy a las ${time}, Manchester Piti contra ${rival}.`;
    case "rsvp":
      return "¿Vas hoy? Responde desde aquí.";
    case "anotador":
      return `Hoy anotas tú: la mesa del partido contra ${rival} se abre desde aquí.`;
    case "pending":
      return `Manchester Piti contra ${rival}: pendiente del pitido inicial.`;
    case "live":
      return previous === "halftime" ? `Arranca la segunda parte. ${board}.` : `Empieza el partido contra ${rival}.`;
    case "halftime":
      return `Descanso. ${board}.`;
    case "final":
      return state.published ? (previous === "final" ? "Acta publicada." : `Final. ${board}. Acta publicada.`) : `Final. ${board}. Acta pendiente.`;
    case "vote":
      return `Ya puedes votar al mejor del partido contra ${rival}.`;
  }
}

// ---------- the view: what the bug, the rótulo and the segunda pantalla show

export type IslaEstado =
  | "previa"
  | "pendiente"
  | "enjuego"
  | "gol"
  | "golrival"
  | "tarjeta"
  | "roja"
  | "cambio"
  | "palo"
  | "parada"
  | "descanso"
  | "final"
  | "acta"
  | "mvp"
  | "rsvp"
  | "anotador"
  | "sinconexion";

/** The rótulo's accent: gold only for our goals, coral for theirs, the card's colour for cards. */
export type RotuloTone = "" | "gold" | "rv" | "y" | "r" | "off";
export interface IslaRotulo {
  /** The left cell: the minute («21′»), the time («19:00»), the score («3–1»). */
  m: string;
  t: string;
  s: string;
  tone: RotuloTone;
}
export interface PulsePlay {
  /** Position across the match, 0–100. */
  pct: number;
  /** Ours rise over the line, theirs hang under it. */
  ours: boolean;
  goal: boolean;
}
export type IslaAnswer = "yes" | "maybe" | "no";

export interface IslaVista {
  estado: IslaEstado;
  matchId: string;
  rival: string;
  /** The rival's initials on the bug («OR»). */
  ini: string;
  gf: number;
  ga: number;
  /** Before kick-off: «vs» instead of the score. */
  pre: boolean;
  /** The clock pill: «19:00», «17′», «50′+2», «Descanso», «Final». */
  clock: string;
  /** The red dot: the ball is rolling and the score is live. */
  live: boolean;
  off: boolean;
  /** The still's caption and the bug's state words: «En juego, 17′». */
  kicker: string;
  rotulo: IslaRotulo;
  /** A fresh play: the rótulo unfolds (the temporary hierarchy). */
  unfold: boolean;
  /** The cortinilla's colourway for this moment ("" none). */
  wipe: "" | "g" | "rv";
  /** Which number of the bug just changed: ours lights gold, theirs flips. */
  changed: "" | "h" | "a";
  /** The line this view says (the state's, or the moment's). */
  say: string;
  /** The bug as one button's name, without its action: «Manchester Piti 2, Orduña 1, en juego, 21′». */
  aria: string;
  /** The extra action of the state, beside «Ver el partido». */
  act: { label: string; kind: "resumen" | "votar" | "mesa" } | null;
  /** «¿Vas hoy?»: the Voy / Duda / No voy control. */
  seg: boolean;
  pulse: PulsePlay[];
  /** Whether the pulse is drawn (once the ball has rolled). */
  hasPulse: boolean;
  /** The time the strip's sky is painted at. */
  at: number;
}

export interface IslaVistaInput {
  state: IslandState;
  now: number;
  /** The fresh moment unfolding now (useMatchMoment), null at rest. */
  moment?: MatchMoment | null;
  /** Every moment so far (momentsOf), for the rótulo at rest and the pulse. */
  moments?: readonly TimedMoment[];
  /** A live score unconfirmed for over a minute (lib/derived/syncChip «stale»): minutes since. */
  staleMinutes?: number | null;
  /** «¿Vas hoy?»: the member's first name and the counts so far (members only). */
  rsvp?: { name?: string; vienen: number; duda: number } | null;
  /** The island has just changed to this state (not on arriving at the page): its rótulo unfolds ~9 s. */
  entered?: boolean;
}

const MOMENT_ESTADO: Record<MomentKind, IslaEstado> = {
  gol: "gol",
  golrival: "golrival",
  amarilla: "tarjeta",
  roja: "roja",
  cambio: "cambio",
  palo: "palo",
  parada: "parada",
  penalti: "enjuego",
  lesion: "enjuego",
  arranque: "enjuego",
  descanso: "descanso",
  reanudacion: "enjuego",
  final: "final",
};
const MOMENT_TONE: Partial<Record<MomentKind, RotuloTone>> = { gol: "gold", golrival: "rv", amarilla: "y", roja: "r" };

const up = (s: string) => s.toLocaleUpperCase("es");
const minuteCell = (m: MatchMoment) => (m.minute === null ? "" : `${m.minute}′`);
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });

/** The rótulo a moment unfolds. */
export function momentRotulo(m: MatchMoment): IslaRotulo {
  return { m: minuteCell(m), t: m.title, s: m.sub, tone: MOMENT_TONE[m.kind] ?? "" };
}

/** The plays drawn on the pulse: each moment with a minute, ours up, theirs down, goals tall. */
export function pulseOf(moments: readonly TimedMoment[], duration: number | undefined): PulsePlay[] {
  const total = (duration ?? 50) * 60;
  return moments
    .filter((x) => x.at === null && x.moment.minute !== null)
    .map(({ moment, t }) => ({ pct: Math.max(0, Math.min(100, (t / total) * 100)), ours: moment.ours, goal: moment.kind === "gol" || moment.kind === "golrival" }));
}

/** The island's whole view at `now`: the state, its clock and words, the rótulo (the moment's, unfolded, or the
 *  state's at rest), and what is said. */
export function islaVista({ state, now, moment = null, moments = [], staleMinutes = null, rsvp = null, entered = false }: IslaVistaInput): IslaVista {
  const m = state.match;
  const rival = m.rival?.trim() || "Rival";
  const ini = rivalCode(rival, m.rivalInitials);
  const { gf, ga } = scoreOf(m);
  const kickoff = dateMillis(m.date);
  const time = Number.isFinite(kickoff) ? madridTime(kickoff) : "";
  const minute = shownMinute(m, now);
  const added = m.clock && (m.clock.phase === "first" || m.clock.phase === "second") ? m.clock.added?.[m.clock.phase === "first" ? 1 : 2] : undefined;
  const minuteText = `${minute ?? 1}′${added ? `+${added}` : ""}`;
  const last = moments.at(-1)?.moment ?? null;
  const live = state.kind === "live";
  const stale = staleMinutes !== null && (live || state.kind === "halftime");

  let estado: IslaEstado;
  switch (state.kind) {
    case "previa":
    case "rsvp":
    case "anotador":
      estado = state.kind;
      break;
    case "pending":
      estado = "pendiente";
      break;
    case "live":
      estado = "enjuego";
      break;
    case "halftime":
      estado = "descanso";
      break;
    case "final":
      estado = state.published ? "acta" : "final";
      break;
    case "vote":
      estado = "mvp";
      break;
  }
  const pre = estado === "previa" || estado === "rsvp" || estado === "anotador" || estado === "pendiente";
  const fin = estado === "final" || estado === "acta" || estado === "mvp";
  const board = boardSaid(rival, gf, ga);
  let kicker: string;
  let rotulo: IslaRotulo;
  let say = islandAnnouncement(state, null);
  let act: IslaVista["act"] = null;
  switch (estado) {
    case "previa": {
      const left = Math.max(0, Math.ceil((kickoff - now) / 60_000));
      kicker = `Hoy a las ${time}, faltan ${left < 60 ? `${left} min` : `${Math.floor(left / 60)} h ${left % 60} min`}`;
      rotulo = { m: time, t: `HOY · PITI – ${up(rival)}`, s: m.home === false ? "Fuera de casa: ve con tiempo" : "En directo desde CDM Palomeras", tone: "" };
      break;
    }
    case "rsvp":
      kicker = `Hoy a las ${time}`;
      rotulo = { m: time, t: rsvp?.name ? `¿VAS HOY, ${up(rsvp.name)}?` : "¿VAS HOY?", s: rsvp ? `Vienen ${rsvp.vienen}${rsvp.duda ? ` · ${rsvp.duda} en duda` : ""}` : "Responde desde aquí", tone: "" };
      break;
    case "anotador":
      kicker = `Hoy a las ${time}`;
      rotulo = { m: time, t: "HOY ANOTAS TÚ", s: "La mesa se abre desde aquí", tone: "" };
      act = { label: "Abrir la mesa", kind: "mesa" };
      break;
    case "pendiente":
      kicker = PENDING_WHISTLE;
      rotulo = { m: madridTime(now), t: "PENDIENTE DEL PITIDO", s: "Ya es la hora; la mesa aún no ha puesto el reloj", tone: "" };
      break;
    case "descanso":
      kicker = "Descanso";
      rotulo = { m: `${minute ?? 25}′`, t: `DESCANSO · ${gf}–${ga}`, s: "La segunda parte, en unos minutos", tone: "" };
      break;
    case "final":
      kicker = "Final";
      rotulo = { m: `${minute ?? m.duration ?? 50}′`, t: `FINAL · ${gf}–${ga}`, s: "Acta pendiente: la mesa la está repasando", tone: "" };
      break;
    case "acta":
      kicker = "Final, acta publicada";
      rotulo = { m: `${gf}–${ga}`, t: "YA ESTÁ EL ACTA", s: "El resumen y las notas, en la ficha", tone: "" };
      act = { label: "Ver el resumen", kind: "resumen" };
      break;
    case "mvp": {
      const closes = typeof m.voteClosesAt === "number" ? m.voteClosesAt : now;
      const hours = Math.max(1, Math.ceil((closes - now) / 3_600_000));
      kicker = "Final, votación abierta";
      rotulo = { m: `${hours} h`, t: "VOTA AL MEJOR DEL PARTIDO", s: `Hasta el ${WEEKDAY.format(closes)} a las ${madridTime(closes)}`, tone: "" };
      act = { label: "Votar al mejor", kind: "votar" };
      break;
    }
    default:
      kicker = `En juego, ${minuteText}`;
      rotulo = last ? { ...momentRotulo(last), s: last.sub || "La última jugada" } : { m: minuteText, t: "EN JUEGO", s: "Aún no ha pasado nada", tone: "" };
  }

  let wipe: IslaVista["wipe"] = "";
  let changed: IslaVista["changed"] = "";
  if (stale) {
    estado = "sinconexion";
    kicker = "Sin actualizar";
    rotulo = { m: "!", t: "MARCADOR SIN ACTUALIZAR", s: `Desde hace ${staleMinutes} min. Lo reintentamos solo`, tone: "off" };
    say = `Marcador sin actualizar desde hace ${staleMinutes === 1 ? "1 minuto" : `${staleMinutes} minutos`}`;
  } else if (moment) {
    estado = MOMENT_ESTADO[moment.kind];
    if (estado === "final") kicker = "Final";
    if (estado === "descanso") kicker = "Descanso";
    rotulo = momentRotulo(moment);
    say = moment.said;
    wipe = WIPE_OF[moment.kind] ?? "";
    changed = moment.kind === "gol" ? "h" : moment.kind === "golrival" ? "a" : "";
  }

  const clock = pre ? time : estado === "descanso" ? "Descanso" : fin ? "Final" : minuteText;
  const said = `${kicker.charAt(0).toLowerCase()}${kicker.slice(1)}`;
  const aria = pre ? `Manchester Piti contra ${rival}, ${said}` : `Manchester Piti ${gf}, ${rival} ${ga}, ${said}`;
  // (the strip paints the sky of now: before kick-off and while it's played, the real minute over the ground)
  return {
    estado,
    matchId: m.id,
    rival,
    ini,
    gf,
    ga,
    pre,
    clock,
    live: estado !== "sinconexion" && !pre && !fin && state.kind === "live",
    off: estado === "sinconexion",
    kicker,
    rotulo,
    // (a play or a new state unfolds for a while; «¿Vas hoy?» and «Hoy anotas tú» stay open: they ask for a tap)
    unfold: !stale && (!!moment || entered || estado === "rsvp" || estado === "anotador"),
    wipe,
    changed,
    say: say || board,
    aria,
    act,
    seg: estado === "rsvp",
    pulse: pulseOf(moments, m.duration),
    hasPulse: !pre,
    at: now,
  };
}
