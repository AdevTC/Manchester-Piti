// La pizarra «día de partido» — el partido en directo. While the board's match is being played (from its
// kick-off to its end plus the added time, and not finished) the clock comes from the match's date
// (liveMinute: it stays right with the phone locked, it is never counted on the device), the score from
// the acta's events, who is on the pitch from the convocatoria and the cambios written live (liveSides).
// Against the board's plan: which cambios are already in the acta, the tanda that is due, the next one
// and how long until it. Pure.
import type { Sub, Takers } from "../formations";
import { liveMinute, scoreOf } from "../../../lib/partidos";
import type { MatchEvent } from "../../../lib/clubData";
import { liveSides } from "../../admin/live/liveModel";
import { liveProblem } from "../../../../functions/src/liveLogic";
import type { CalMatch } from "./boards";
import { DURATION0, playedFromActa, wavesOf, type Wave } from "./cambios";
import { effectiveTaker, TAKER_KINDS, TAKER_LETTER } from "./takers";

/** Added time: the board stays live this long after the match's minutes are up. */
export const ADDED_MIN = 15;
const MIN = 60_000;

export const durationOf = (m: Pick<CalMatch, "duration"> | null): number => (m?.duration && m.duration > 1 ? m.duration : DURATION0);

export interface LiveNow {
  matchId: string;
  /** The minute being played (1–duration). */
  minute: number;
  duration: number;
  gf: number;
  ga: number;
  rival: string;
  /** On the pitch now, and who can still come in (called, not sent off). */
  field: string[];
  bench: string[];
  starters: string[];
  events: MatchEvent[];
  /** When the next minute starts (ms): the clock ticks then. */
  nextTick: number;
}

/** The board's match as it is being played (null when it isn't: not started, over, finished, called off). */
export function liveNow(m: CalMatch | null, now: number): LiveNow | null {
  if (!m || !m.dateMs || m.played) return null;
  if (m.status === "finished" || m.status === "cancelled" || m.status === "postponed") return null;
  const D = durationOf(m);
  const start = m.dateMs;
  if (now < start || now >= start + (D + ADDED_MIN) * MIN) return null;
  const minute = liveMinute({ date: start, duration: D }, now);
  if (minute == null) return null;
  const events = m.events ?? [];
  const { gf, ga } = scoreOf({ events });
  const starters = m.conv?.starters ?? [];
  const sides = liveSides(starters, m.conv?.bench ?? [], events);
  const k = Math.floor((now - start) / MIN) + 1;
  return { matchId: m.id, minute, duration: D, gf, ga, rival: m.rival, field: sides.field, bench: sides.bench, starters, events, nextTick: start + k * MIN };
}

/** When the clock should next look at the time (ms): the next minute while live, the kick-off before
 *  it (null = nothing to wait for). */
export function nextClockAt(m: CalMatch | null, now: number): number | null {
  if (!m || !m.dateMs || m.played) return null;
  const end = m.dateMs + (durationOf(m) + ADDED_MIN) * MIN;
  if (now >= end) return null;
  if (now < m.dateMs) return m.dateMs;
  return m.dateMs + (Math.floor((now - m.dateMs) / MIN) + 1) * MIN;
}

/** The planned cambios already in the acta (the same one leaving for the same one coming in). */
export function subsMade(subs: readonly Sub[], events: readonly MatchEvent[]): Set<string> {
  const ev = events.filter((e) => e.type === "substitution" && e.playerId && e.inPlayerId);
  return new Set(subs.filter((s) => ev.some((e) => e.playerId === s.out && e.inPlayerId === s.in)).map((s) => s.id));
}

export interface LiveWave {
  wave: Wave;
  /** The cambios of the tanda still to make (the ones already in the acta are not). */
  pending: Sub[];
  /** Its minute has come (or gone): «¡Toca el cambio!». */
  due: boolean;
  /** Minutes until it (0 when due). */
  inMin: number;
}

/** The tanda to make now (its minute has come) or the next one, with what is left of it. */
export function liveWave(subs: readonly Sub[], live: Pick<LiveNow, "minute" | "events" | "field">): LiveWave | null {
  const made = subsMade(subs, live.events);
  const field = new Set(live.field);
  for (const w of wavesOf(subs)) {
    // (a cambio whose player has already left — made some other way — is not pending any more)
    const pending = w.subs.filter((s) => !made.has(s.id) && field.has(s.out) && !field.has(s.in));
    if (!pending.length) continue;
    return { wave: w, pending, due: w.min <= live.minute, inMin: Math.max(0, w.min - live.minute) };
  }
  return null;
}

/** «Próximo cambio · 25′ (en 2′)» / «Toca el cambio · 25′» / «Sin más cambios». */
export function waveLine(w: LiveWave | null): string {
  if (!w) return "Sin más cambios en el plan";
  return w.due ? "Toca el cambio · " + w.wave.min + "′" : "Próximo cambio · " + w.wave.min + "′ (en " + w.inMin + "′)";
}

/** The plate's words: «EN DIRECTO · 23′ · PITI 1–0 MAD SKY». */
export const plateAria = (l: LiveNow): string => "En directo, minuto " + l.minute + ": Piti " + l.gf + ", " + l.rival + " " + l.ga;

/** Whether a planned cambio can be written in the acta now (the same checks as the admin's «En juego»,
 *  and the pitch as it is). Null = it can. */
export function subProblem(m: CalMatch, l: LiveNow, s: Sub, now: number, name: (id: string) => string): string | null {
  const p = liveProblem(
    { status: m.status, date: m.dateMs, duration: durationOf(m), starters: m.conv?.starters ?? [], bench: m.conv?.bench ?? [] },
    { type: "substitution", minute: l.minute, playerId: s.out, inPlayerId: s.in },
    now,
  );
  if (p) return p;
  if (!l.field.includes(s.out)) return name(s.out) + " ya no está en el campo";
  if (!l.bench.includes(s.in)) return name(s.in) + " no puede entrar: no está en el banquillo";
  return null;
}

/** Minutes each one has played so far (the acta). */
export const playedNow = (l: LiveNow): Map<string, number> => playedFromActa(l.starters, l.events, l.minute);

/** Who takes each dead ball right now (the first of each list on the pitch): «P TELLO · F — · E KEVIN». */
export function takersNow(t: Takers, field: readonly string[], name: (id: string) => string): { k: string; l: string; who: string }[] {
  const on = new Set(field);
  return TAKER_KINDS.map((k) => {
    const id = effectiveTaker(t[k], on);
    return { k, l: TAKER_LETTER[k], who: id ? name(id) : "—" };
  });
}
