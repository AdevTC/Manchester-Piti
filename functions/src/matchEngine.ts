/** Shared, deterministic match ledger. Also executed by the backend before publishing. */
export const EVENT_LABELS = {
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
  substitution: "Cambio",
  assist: "Asistencia (histórico)",
  match_played: "Participación (histórico)",
} as const;
export type EventType = keyof typeof EVENT_LABELS;
export interface MatchEvent {
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
export interface Participation {
  minutes: number;
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
}
export interface Ledger {
  players: Record<string, Participation>;
  goalsFor: number;
  goalsAgainst: number;
  errors: string[];
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
  };
}
export function calculateLedger(
  match: Pick<
    MatchSheet,
    "starters" | "bench" | "notCalled" | "events" | "duration"
  >,
  strict = true,
): Ledger {
  const result: Ledger = {
    players: {},
    goalsFor: 0,
    goalsAgainst: 0,
    errors: [],
  };
  const fail = (text: string) => result.errors.push(text);
  const duration = match.duration;
  if (!Number.isInteger(duration) || duration < 1 || duration > 150)
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
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || a.order - b.order);
  for (const e of events) {
    const minute = e.minute;
    if (!e.id || ids.has(e.id))
      fail("Cada evento debe tener una referencia única.");
    ids.add(e.id);
    if (!(e.type in EVENT_LABELS)) {
      fail("Tipo de evento desconocido.");
      continue;
    }
    if (!Number.isInteger(minute) || minute! < 0 || minute! > duration) {
      fail("Indica un minuto válido para cada evento.");
      continue;
    }
    const t = minute!;
    if (e.type === "opponent_goal" || e.type === "opponent_own_goal") {
      if (e.type === "opponent_goal") result.goalsAgainst++;
      else result.goalsFor++;
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
    } else if (e.type === "red_card") {
      p.redCards++;
      p.dismissed = true;
      close(id, t);
    } else if (e.type === "own_goal") {
      p.ownGoals++;
      result.goalsAgainst++;
    } else if (e.type === "penalty_committed") p.penaltyCommitted++;
    else if (e.type === "penalty_received") p.penaltyReceived++;
    else if (e.type === "penalty_saved") p.penaltySaved++;
    else if (e.type === "penalty_missed") p.penaltyMissed++;
    else if (e.type === "woodwork") p.woodwork++;
    else if (e.type === "assist") p.assists++;
  }
  for (const id of [...onPitch.keys()]) close(id, duration);
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
  const start = dateMillis(match.date);
  if (!Number.isFinite(start)) return "unscheduled";
  if (now < start) return "scheduled";
  if (now < start + 60 * 60 * 1000) return "playing";
  return "awaiting_result";
}
export function nextFixture<
  T extends { date?: unknown; status?: string; goalsFor?: number },
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
