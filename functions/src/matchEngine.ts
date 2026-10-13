/** Shared, deterministic match ledger. Also executed by the backend before publishing. */
import { ACTION_LABELS, actionProblem, analyseActions, eventSeconds, isAnalysisAction, type ActionDetails, type TechnicalStats } from "./matchAnalysis.js";
import { type MatchClock } from "./matchClock.js";
import type { PosCode } from "./positions.js";
import type { PositionEvents } from "./positionsPlayed.js";
export const EVENT_LABELS = {
  ...ACTION_LABELS,
  goal: "Gol",
  goal_penalty: "Gol de penalti",
  goal_freekick: "Gol de falta",
  opponent_goal: "Gol rival",
  opponent_own_goal: "Autogol rival",
  own_goal: "Gol en propia",
  yellow_card: "Amarilla",
  double_yellow: "Segunda amarilla",
  red_card: "Roja directa",
  penalty_committed: "Penalti cometido",
  penalty_received: "Penalti recibido",
  penalty_saved: "Penalti parado",
  penalty_missed: "Penalti fallado",
  woodwork: "Tiro al palo",
  chance: "Ocasión del Piti",
  opponent_chance: "Ocasión rival",
  corner: "Córner del Piti",
  opponent_corner: "Córner rival",
  substitution: "Cambio",
  assist: "Asistencia (histórico)",
  match_played: "Participación (histórico)",
} as const;
export type EventType = keyof typeof EVENT_LABELS;
export interface MatchEvent extends ActionDetails {
  id: string;
  type: EventType;
  minute?: number;
  playerId?: string;
  assistPlayerId?: string;
  inPlayerId?: string;
  note?: string;
}
export type MatchStatus = "scheduled" | "finished" | "postponed" | "cancelled";
export interface MatchSheet {
  id?: string;
  version: 2;
  revision?: number;
  seasonId: string;
  rival: string;
  rivalLogoUrl?: string;
  rivalInitials?: string;
  competition: string;
  date: number;
  duration: number;
  venue: string;
  home: boolean;
  status: MatchStatus;
  /** Server-controlled whistle; the final ledger is still published after review. */
  liveEndedAt?: number;
  clock?: MatchClock;
  durationSeconds?: number;
  analysisCoverage?: "partial" | "complete";
  analysisNotes?: string;
  starters: string[];
  bench: string[];
  notCalled: string[];
  events: MatchEvent[];
  goalsFor?: number;
  goalsAgainst?: number;
  report: string;
  photoUrl?: string;
  voteClosesAt?: number;
  gallery?: string[];
  meetingNote?: string;
  /** Kit the squad wears: 1ª (home) or 2ª (away) equipación. */
  kit?: "home" | "away";
}
export interface Participation extends Partial<TechnicalStats> {
  minutes: number;
  secondsPlayed?: number;
  started: boolean;
  benched: boolean;
  notCalled: boolean;
  played: boolean;
  subIn: number;
  subOut: number;
  dismissed: boolean;
  stints: { from: number; to: number }[];
  exchanges: { minute: number; with: string; direction: "in" | "out" }[];
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  doubleYellows: number;
  penaltyCommitted: number;
  penaltyReceived: number;
  penaltySaved: number;
  penaltyMissed: number;
  goalPenalty: number;
  goalFreekick: number;
  ownGoals: number;
  woodwork: number;
  /** Absent from actas published before these events were introduced. */
  chances?: number;
  corners?: number;
  /** «Ha jugado de» (positionsPlayed.ts): minutes by exact position, 2 decimals, only codes > 0.
   *  saveMatchSheet adds these; calculateLedger never fills them, and older actas lack them. */
  positionsPlayed?: Partial<Record<PosCode, number>>;
  /** Goals, assists and cards by the position he was playing; only codes with an event. */
  positionEvents?: Partial<Record<PosCode, PositionEvents>>;
  /** Some of his minutes came from his preferred position, not an official board. */
  positionsEstimated?: true;
}
export interface Ledger {
  players: Record<string, Participation>;
  goalsFor: number;
  goalsAgainst: number;
  errors: string[];
  /** Shirt slots at the cutoff: a substitute inherits the outgoing player's place. */
  field: (string | null)[];
}
export function emptyParticipation(): Participation {
  return {
    minutes: 0,
    started: false,
    benched: false,
    notCalled: false,
    played: false,
    subIn: 0,
    subOut: 0,
    dismissed: false,
    stints: [],
    exchanges: [],
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    doubleYellows: 0,
    penaltyCommitted: 0,
    penaltyReceived: 0,
    penaltySaved: 0,
    penaltyMissed: 0,
    goalPenalty: 0,
    goalFreekick: 0,
    ownGoals: 0,
    woodwork: 0,
    chances: 0,
    corners: 0,
  };
}
export function calculateLedger(
  match: Pick<
    MatchSheet,
    "starters" | "bench" | "notCalled" | "events" | "duration" | "durationSeconds"
  >,
  strict = true,
  options: { until?: number; allowUnattributedGoals?: boolean } = {},
): Ledger {
  const result: Ledger = {
    players: {},
    goalsFor: 0,
    goalsAgainst: 0,
    errors: [],
    field: [...match.starters],
  };
  const fail = (text: string) => result.errors.push(text);
  const duration = match.durationSeconds != null ? match.durationSeconds / 60 : match.duration;
  const until = Math.max(0, Math.min(duration, options.until ?? duration));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 150)
    fail("La duración debe estar entre 1 y 150 minutos.");
  const assignments = [...match.starters, ...match.bench, ...match.notCalled];
  if (new Set(assignments).size !== assignments.length)
    fail("Un jugador solo puede tener una situación inicial.");
  if (match.starters.length > 7 || (strict && match.starters.length !== 7))
    fail("Selecciona exactamente 7 titulares.");
  for (const id of assignments) result.players[id] = emptyParticipation();
  const onPitch = new Map<string, number>();
  for (const id of match.starters) {
    result.players[id].started = true;
    result.players[id].played = true;
    onPitch.set(id, 0);
  }
  for (const id of match.bench) result.players[id].benched = true;
  for (const id of match.notCalled) result.players[id].notCalled = true;
  const close = (id: string, minute: number) => {
    const from = onPitch.get(id);
    if (from !== undefined) {
      result.players[id].minutes += minute - from;
      result.players[id].stints.push({ from, to: minute });
      onPitch.delete(id);
    }
  };
  const ids = new Set<string>();
  const events = match.events
    .map((e, order) => ({ ...e, order }))
    .sort((a, b) => eventSeconds(a) - eventSeconds(b) || a.order - b.order);
  for (const e of events) {
    const minute = e.elapsedSeconds == null ? e.minute : e.elapsedSeconds / 60;
    if (!e.id || ids.has(e.id))
      fail("Cada evento debe tener una referencia única.");
    ids.add(e.id);
    if (!(e.type in EVENT_LABELS)) {
      fail("Tipo de evento desconocido.");
      continue;
    }
    if (isAnalysisAction(e.type) && e.timingUnknown && e.minute == null && e.elapsedSeconds == null) {
      const problem = actionProblem(e);
      if (problem) fail(problem);
      if (e.team === "opponent" && (e.playerId || e.receiverId)) fail("Una acción rival no puede atribuirse a un jugador del Piti.");
      for (const id of [e.playerId, e.receiverId]) if (id && (!result.players[id] || result.players[id].notCalled)) fail("La acción sin minuto necesita jugadores convocados.");
      continue;
    }
    if (!Number.isFinite(minute) || minute! < 0 || minute! > duration) {
      fail("Indica un minuto válido para cada evento.");
      continue;
    }
    const t = minute!;
    if (t > until) continue;
    const actionError = actionProblem(e);
    if (actionError) { fail(`Minuto ${e.minute}: ${actionError}`); continue; }
    if (isAnalysisAction(e.type)) {
      if (e.team === "opponent") { if (e.playerId || e.receiverId) fail("Una acción rival no puede atribuirse a un jugador del Piti."); continue; }
      if (e.playerId && !onPitch.has(e.playerId)) fail(`Minuto ${e.minute}: el autor de la acción no estaba en el campo.`);
      if (e.receiverId && !onPitch.has(e.receiverId)) fail(`Minuto ${e.minute}: el receptor no estaba en el campo.`);
      continue;
    }
    if (e.type === "opponent_goal" || e.type === "opponent_own_goal") {
      if (e.type === "opponent_goal") result.goalsAgainst++;
      else result.goalsFor++;
      continue;
    }
    if (e.type === "opponent_chance" || e.type === "opponent_corner") continue;
    if ((e.type === "chance" || e.type === "corner") && !e.playerId) continue;
    if (e.type === "goal" && !e.playerId && !e.assistPlayerId && options.allowUnattributedGoals) {
      result.goalsFor++;
      continue;
    }
    const p = e.playerId ? result.players[e.playerId] : undefined;
    if (!p || p.notCalled) {
      fail(`Minuto ${t}: selecciona un jugador convocado.`);
      continue;
    }
    const id = e.playerId!;
    if (e.type === "substitution") {
      const incoming = e.inPlayerId ? result.players[e.inPlayerId] : undefined;
      if (
        !onPitch.has(id) ||
        !incoming ||
        incoming.notCalled ||
        incoming.dismissed ||
        onPitch.has(e.inPlayerId!)
      ) {
        fail(
          `Minuto ${t}: el cambio necesita un jugador en campo y otro disponible en el banquillo.`,
        );
        continue;
      }
      close(id, t);
      p.subOut++;
      p.exchanges.push({ minute: t, with: e.inPlayerId!, direction: "out" });
      incoming.subIn++;
      incoming.played = true;
      incoming.exchanges.push({ minute: t, with: id, direction: "in" });
      onPitch.set(e.inPlayerId!, t);
      result.field[result.field.indexOf(id)] = e.inPlayerId!;
      continue;
    }
    const card = ["yellow_card", "double_yellow", "red_card"].includes(e.type);
    if (p.dismissed || (!card && !onPitch.has(id))) {
      fail(`Minuto ${t}: el jugador no está disponible en el campo.`);
      continue;
    }
    if (["goal", "goal_penalty", "goal_freekick"].includes(e.type)) {
      p.goals++;
      result.goalsFor++;
      if (e.type === "goal_penalty") p.goalPenalty++;
      if (e.type === "goal_freekick") p.goalFreekick++;
      if (e.assistPlayerId) {
        if (e.assistPlayerId === id || !onPitch.has(e.assistPlayerId))
          fail(`Minuto ${t}: el asistente debe ser otro jugador en campo.`);
        else result.players[e.assistPlayerId].assists++;
      }
    } else if (e.type === "yellow_card") {
      if (p.yellowCards > 0)
        fail(
          `Minuto ${t}: registra la segunda amarilla como expulsión por doble amarilla.`,
        );
      p.yellowCards++;
    } else if (e.type === "double_yellow") {
      if (p.yellowCards !== 1)
        fail(`Minuto ${t}: registra primero la primera amarilla.`);
      p.yellowCards = 2;
      p.doubleYellows++;
      p.redCards++;
      p.dismissed = true;
      close(id, t);
      result.field = result.field.map((who) => who === id ? null : who);
    } else if (e.type === "red_card") {
      p.redCards++;
      p.dismissed = true;
      close(id, t);
      result.field = result.field.map((who) => who === id ? null : who);
    } else if (e.type === "own_goal") {
      p.ownGoals++;
      result.goalsAgainst++;
    } else if (e.type === "penalty_committed") p.penaltyCommitted++;
    else if (e.type === "penalty_received") p.penaltyReceived++;
    else if (e.type === "penalty_saved") p.penaltySaved++;
    else if (e.type === "penalty_missed") p.penaltyMissed++;
    else if (e.type === "woodwork") p.woodwork++;
    else if (e.type === "chance") p.chances = (p.chances ?? 0) + 1;
    else if (e.type === "corner") p.corners = (p.corners ?? 0) + 1;
    else if (e.type === "assist") p.assists++;
  }
  for (const id of [...onPitch.keys()]) close(id, until);
  const technical = analyseActions(match.events.filter(e => eventSeconds(e) <= until * 60));
  for (const [id, row] of Object.entries(result.players)) {
    row.secondsPlayed = Math.round(row.minutes * 60);
    row.minutes = Math.round(row.secondsPlayed / 60 * 100) / 100;
    Object.assign(row, technical.players[id] ?? {});
  }
  return result;
}
export function dateMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value);
  if (value && typeof value === "object" && "seconds" in value)
    return Number(value.seconds) * 1000;
  return NaN;
}
export function matchPhase(
  match: {
    status?: string;
    date?: unknown;
    version?: number;
    goalsFor?: number;
    duration?: number;
    liveEndedAt?: number;
    clock?: MatchClock;
  },
  now: number,
) {
  if (match.status === "cancelled" || match.status === "postponed")
    return match.status;
  if (
    match.status === "finished" ||
    (!match.status &&
      typeof match.goalsFor === "number" &&
      dateMillis(match.date) <= now)
  )
    return "finished";
  if (match.clock) {
    if (match.clock.phase === "ended") return "awaiting_result";
    if (match.clock.phase !== "ready") return "playing";
    return "scheduled";
  }
  if (match.version === 2 && match.status === "scheduled" && !match.liveEndedAt) return "scheduled";
  const start = dateMillis(match.date);
  if (!Number.isFinite(start)) return "unscheduled";
  if (now < start) return "scheduled";
  if (match.liveEndedAt && match.liveEndedAt <= now) return "awaiting_result";
  if (now < liveUntil(match)) return "playing";
  return "awaiting_result";
}
/** One hour for the usual F7 fixture; longer games use their configured duration. */
export function liveUntil(match: { date?: unknown; duration?: number }): number {
  return dateMillis(match.date) + Math.max(60, match.duration ?? 50) * 60_000;
}
export function nextFixture<
  T extends { date?: unknown; status?: string; goalsFor?: number; duration?: number; liveEndedAt?: number },
>(matches: T[], now: number): T | undefined {
  return matches
    .filter((m) => ["scheduled", "playing"].includes(matchPhase(m, now)))
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
}
export function isCompleted(match: {
  status?: string;
  date?: unknown;
  goalsFor?: number;
  goalsAgainst?: number;
}): boolean {
  return (
    match.status === "finished" ||
    (!match.status &&
      typeof match.goalsFor === "number" &&
      typeof match.goalsAgainst === "number" &&
      dateMillis(match.date) <= Date.now())
  );
}
