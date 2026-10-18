// «La primera fila»: one seat per player of the squad, and what each seat says at this point of the match day.
// Four modes follow the phase (derived/matchday): the squad with no match yet (plantilla), the answers to the
// convocatoria (members) or the published convocados (fans), the bench while the match is played (lineupWalk
// over the plays that stand) and who played once it is over (the ledger: the acta's, or the provisional one
// before it is published). Pure: <PrimeraFila> renders it; the tests drive it with controlled data.
//
// Privacy (firestore.rules): the answers, the counts and the absences are member-only. A fan's host passes
// `answers: null`; then no seat carries an answer and `absentIds` is ignored (no «ausente» seat leaks out).
import type { ClubMatch, MatchEvent, Participation } from "../clubData";
import { isGuestId } from "./guests";
import { achievements } from "./achievements";
import { mvpCandidates } from "./memberWindows";
import type { MatchdayPhase } from "./matchday";
import { matchSnapshot } from "../ficha";
import { settled } from "../eventMeta";
import { OURS } from "../partidos";
import { mvpWinners, type MvpResult } from "../vestuario";
import { lineupWalk, parseMatchLineup, type LineupSlot } from "../matchLineup";
import { eventMinute } from "../../../functions/src/matchEngine";

export type SeatState =
  | "voy"
  | "duda"
  | "novoy"
  | "sinresponder"
  | "convocado"
  | "noconvocado"
  | "ausente"
  | "campo"
  | "banquillo"
  | "expulsado"
  | "lesionado"
  | "jugo"
  | "nojugo";

export interface SeatMarker {
  kind: "gol" | "amarilla" | "roja" | "entra" | "sale" | "lesion" | "mvp" | "anota";
  minute?: number;
}

export interface Seat {
  playerId: string;
  dorsal: string;
  name: string;
  state: SeatState;
  /** In the published seven. */
  starter: boolean;
  /** His code in the match's lineup (the slot he holds now, while live), else his squad position. */
  position: string | null;
  /** The viewer's own seat («tú»). */
  mine: boolean;
  /** In play order. */
  markers: SeatMarker[];
  /** jugaron: whole minutes played (the ledger's). */
  minutes?: number;
  /** jugaron: goals in this match (the ledger's). */
  goals?: number;
  /** jugaron, once the acta is out: the logros won in this match (achievements' labels: «Debut», «Primer gol»). */
  logros?: string[];
  /** jugaron, while the MVP vote is open: he can be voted (he played, not a guest). */
  mvpCandidate?: boolean;
}

export type FrontRowMode = "plantilla" | "convocatoria" | "banquillo" | "jugaron";

export interface FrontRow {
  mode: FrontRowMode;
  seats: Seat[];
  /** null for fans: answers and counts are member-only. */
  counts: { vienen: number; duda: number; no: number; sinResponder: number; ausentes: number } | null;
  sevenPublished: boolean;
}

export interface FrontRowInput {
  match: ClubMatch | null;
  phase: MatchdayPhase;
  squad: readonly { id: string; name: string; dorsal: string; position: string | null }[];
  /** campoSeven / match.lineup: the seven published for this match (empty: not yet). */
  seven: readonly string[];
  /** The convocatoria's answers (matchPrivate/{id}/availability); null for fans. */
  answers: readonly { playerId: string | null; response: "yes" | "no" | "maybe" }[] | null;
  /** Members away that day (derived/absences); ignored for fans. A «Voy» or «Duda» given by hand wins over it. */
  absentIds: readonly string[];
  viewerPlayerId: string | null;
  /** Who keeps la mesa for this match («anota»). */
  scorerIds: readonly string[];
  mvpVoteOpen: boolean;
  now: number;
  /** Optional, for the logros: every match the achievements read (useClubData's), and the MVP results
   *  (useMvpResults) — also what names the MVP once the vote has closed. Without them: no logros, no MVP. */
  history?: readonly ClubMatch[];
  mvpResults?: ReadonlyMap<string, MvpResult>;
}

/** The mode each phase of the day shows. */
export function frontRowMode(phase: MatchdayPhase, match: ClubMatch | null): FrontRowMode {
  if (!match || phase === "pretemporada") return "plantilla";
  // (a match nobody started on la mesa has no plays to sit anyone by: the convocatoria stands until the acta)
  if (phase === "semana" || phase === "antes" || phase === "aplazado" || phase === "pendiente") return "convocatoria";
  if (phase === "pitido" || phase === "directo1" || phase === "descanso" || phase === "directo2") return "banquillo";
  return "jugaron";
}

const RED = new Set(["red_card", "double_yellow"]);
type Timed = { minute?: number | null; elapsedSeconds?: number | null; period?: number | null };
/** The minute people read for a play (eventMinute). */
const minuteOf = (e: Timed): number | undefined => eventMinute({ minute: e.minute ?? undefined, elapsedSeconds: e.elapsedSeconds ?? undefined }) ?? undefined;
/** Play order: the half, then the time in it (as lineupWalk orders them). */
const orderOf = (e: Timed): number => (e.period === 2 ? 1e6 : 0) + (typeof e.elapsedSeconds === "number" ? e.elapsedSeconds : (e.minute ?? 0) * 60);

/** The lineup the walk starts from: the match's (matches/{id}.lineup), or the seven in its order without codes. */
function startingSlots(match: ClubMatch, seven: readonly string[]): { slots: LineupSlot[]; coded: boolean } {
  const lineup = parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup);
  if (lineup) return { slots: lineup.slots, coded: true };
  return { slots: seven.map((playerId): LineupSlot => ({ playerId, code: "MC", x: 50, y: 50 })), coded: false };
}

/** Every seat's markers from the plays that stand (and the walk's cambios and reds), in play order. */
function playMarkers(events: readonly MatchEvent[], walk: ReturnType<typeof lineupWalk>): Map<string, { at: number; m: SeatMarker }[]> {
  const out = new Map<string, { at: number; m: SeatMarker }[]>();
  const add = (id: string | null | undefined, at: number, m: SeatMarker) => {
    if (!id) return;
    const list = out.get(id) ?? [];
    list.push({ at, m });
    out.set(id, list);
  };
  for (const e of events) {
    const minute = minuteOf(e);
    if (OURS.has(e.type) && e.type !== "opponent_own_goal") add(e.playerId, orderOf(e), { kind: "gol", minute });
    else if (e.type === "yellow_card") add(e.playerId, orderOf(e), { kind: "amarilla", minute });
    else if (e.type === "injury") add(e.playerId, orderOf(e), { kind: "lesion", minute });
  }
  for (const step of walk.steps) {
    const e = step.event;
    const minute = minuteOf(e);
    if (step.k === "red") add(step.outId, orderOf(e), { kind: "roja", minute });
    else {
      add(step.outId, orderOf(e), { kind: "sale", minute });
      add(step.inId, orderOf(e), { kind: "entra", minute });
    }
  }
  // a red to someone off the pitch (a sub sent off from the bench) still shows on his seat
  for (const e of events) if (RED.has(e.type) && e.playerId && !walk.steps.some((s) => s.k === "red" && s.event === e)) add(e.playerId, orderOf(e), { kind: "roja", minute: minuteOf(e) });
  for (const list of out.values()) list.sort((a, b) => a.at - b.at);
  return out;
}

/** The front row at this point of the day (see the file's head). */
export function frontRowOf(input: FrontRowInput): FrontRow {
  const { match, phase, squad, seven, answers, viewerPlayerId, now } = input;
  const mode = frontRowMode(phase, match);
  const member = answers !== null;
  const absent = new Set(member ? input.absentIds : []);
  const scorers = new Set(input.scorerIds);
  const sevenPublished = seven.length > 0;
  const inSeven = new Set(seven);
  const called = new Set([...(match?.starters ?? []), ...(match?.bench ?? []), ...seven]);
  const lineup = match ? parseMatchLineup((match as ClubMatch & { lineup?: unknown }).lineup) : null;
  const lineupCode = new Map(lineup?.slots.map((s) => [s.playerId, s.code as string]) ?? []);

  const seat = (p: FrontRowInput["squad"][number], state: SeatState, extra: Partial<Seat> = {}): Seat => ({
    playerId: p.id,
    dorsal: p.dorsal,
    name: p.name,
    state,
    starter: sevenPublished && inSeven.has(p.id),
    position: lineupCode.get(p.id) ?? p.position,
    mine: !!viewerPlayerId && viewerPlayerId === p.id,
    markers: [],
    ...extra,
  });
  const anota = (id: string): SeatMarker[] => (scorers.has(id) ? [{ kind: "anota" }] : []);

  if (mode === "plantilla" || !match) {
    // no match yet: every seat folded, nobody called
    return { mode: "plantilla", seats: squad.map((p) => seat(p, "noconvocado")), counts: null, sevenPublished: false };
  }

  if (mode === "convocatoria") {
    if (!member) {
      const seats = squad.map((p) => seat(p, called.has(p.id) ? "convocado" : "noconvocado", { markers: anota(p.id) }));
      return { mode, seats, counts: null, sevenPublished };
    }
    const said = new Map<string, "yes" | "no" | "maybe">();
    for (const a of answers ?? []) if (a.playerId) said.set(a.playerId, a.response);
    const counts = { vienen: 0, duda: 0, no: 0, sinResponder: 0, ausentes: 0 };
    const seats = squad.map((p) => {
      const r = said.get(p.id);
      const state: SeatState = absent.has(p.id) && r !== "yes" && r !== "maybe" ? "ausente" : r === "yes" ? "voy" : r === "maybe" ? "duda" : r === "no" ? "novoy" : "sinresponder";
      if (state === "voy") counts.vienen++;
      else if (state === "duda") counts.duda++;
      else if (state === "novoy") counts.no++;
      else if (state === "ausente") counts.ausentes++;
      else counts.sinResponder++;
      return seat(p, state, { markers: anota(p.id) });
    });
    return { mode, seats, counts, sevenPublished };
  }

  const events = settled(match.events);
  const start = startingSlots(match, seven);
  const walk = lineupWalk({ slots: start.slots }, events);
  const marks = playMarkers(events, walk);
  const markersOf = (id: string): SeatMarker[] => (marks.get(id) ?? []).map((x) => x.m);

  if (mode === "banquillo") {
    const pitch = new Map(walk.now.map((s) => [s.playerId, s]));
    const sentOff = new Set(walk.steps.filter((s) => s.k === "red").map((s) => s.outId));
    for (const e of events) if (RED.has(e.type) && e.playerId && !pitch.has(e.playerId)) sentOff.add(e.playerId);
    const injured = new Set(events.filter((e) => e.type === "injury" && e.playerId).map((e) => e.playerId as string));
    const seats = squad.map((p) => {
      const slot = pitch.get(p.id);
      const state: SeatState = slot
        ? "campo"
        : sentOff.has(p.id)
          ? "expulsado"
          : called.has(p.id)
            ? injured.has(p.id)
              ? "lesionado"
              : "banquillo"
            : absent.has(p.id)
              ? "ausente"
              : "noconvocado";
      const position = slot && start.coded ? slot.code : (lineupCode.get(p.id) ?? p.position);
      return seat(p, state, { position, markers: [...anota(p.id), ...markersOf(p.id)] });
    });
    return { mode, seats, counts: null, sevenPublished };
  }

  // jugaron: the acta's ledger once published, else the provisional one from the plays (final, acta pendiente)
  const ledger: Record<string, Participation> = match.ledger ?? safeSnapshot(match, now);
  const published = match.status === "finished";
  const winners = published && input.mvpResults ? new Set(mvpWinners(match, input.mvpResults.get(match.id), now)) : new Set<string>();
  const candidates = input.mvpVoteOpen ? new Set(mvpCandidates(ledger, undefined, (id) => id)) : new Set<string>();
  const history = published && input.history ? [...input.history] : null;
  const ctx = { mvpResults: input.mvpResults ?? new Map<string, MvpResult>(), now };
  const seats = squad.map((p) => {
    const row = ledger[p.id];
    const markers = [...markersOf(p.id), ...(winners.has(p.id) ? [{ kind: "mvp" as const }] : [])];
    if (row?.played) {
      const logros = history
        ? achievements(p.id, history, ctx)
            .filter((a) => a.earned && a.at?.matchId === match.id)
            .map((a) => a.label)
        : undefined;
      return seat(p, "jugo", {
        markers,
        minutes: Math.round(row.minutes),
        goals: row.goals,
        ...(logros ? { logros } : {}),
        ...(input.mvpVoteOpen ? { mvpCandidate: candidates.has(p.id) } : {}),
      });
    }
    const state: SeatState = row?.started || row?.benched || called.has(p.id) ? "nojugo" : absent.has(p.id) ? "ausente" : "noconvocado";
    return seat(p, state, { markers, ...(input.mvpVoteOpen ? { mvpCandidate: false } : {}) });
  });
  return { mode, seats, counts: null, sevenPublished };
}

/** The provisional ledger (ficha's matchSnapshot, the same stints as the server's); empty if the plays
 *  can't be read into one. Guests are left out: they have no seat. */
function safeSnapshot(match: ClubMatch, now: number): Record<string, Participation> {
  try {
    const players = matchSnapshot(match, now).players;
    return Object.fromEntries(Object.entries(players).filter(([id]) => !isGuestId(id)));
  } catch {
    return {};
  }
}
