// DEV only: the boards' «Maqueta» strip over production's data. `?maqueta=antes|pitido|directo|descanso|final|
// acta|semana|aplazado|pendiente` (with `&reloj=36` for the live minute) turns the last match played into that
// moment, and `?quien=fan|socio|jugador|anotador` looks at it as someone else, so every state of the portada can
// be checked against its board with real names, plays and changes. The production build never reads it.
import type { ClubMatch } from "../../../lib/clubData";
import { dateMillis } from "../../../lib/clubData";
import type { MatchdayModel } from "../../../lib/derived/matchday";
import { scoreOf } from "../../../lib/partidos";
import type { Quien } from "./model";

const MIN = 60_000;
export interface Maqueta {
  fase: string;
  reloj: number;
  quien: Quien | null;
}

export function readMaqueta(): Maqueta | null {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  const q = new URLSearchParams(location.search);
  const fase = q.get("maqueta");
  const quien = q.get("quien");
  if (!fase && !quien) return null;
  return { fase: fase ?? "", reloj: Number(q.get("reloj")) || 36, quien: quien === "fan" || quien === "socio" || quien === "jugador" || quien === "anotador" ? quien : null };
}

const blank = (m: ClubMatch): ClubMatch => ({ ...m, status: "scheduled", events: [], ledger: undefined, goalsFor: undefined, goalsAgainst: undefined, voteClosesAt: undefined, clock: undefined });

export function applyMaqueta(mq: Maqueta | null, day: MatchdayModel, now: number): { day: MatchdayModel; now: number } {
  if (!mq?.fase) return { day, now };
  const base = day.last ?? day.match;
  if (!base) return { day, now };
  const ko = dateMillis(base.date);
  const next = day.match && day.match.id !== base.id ? day.match : day.next;
  const D = base.duration ?? 50;
  const at = (m: ClubMatch, phase: MatchdayModel["phase"], t: number, minute: number | null = null) => ({ day: { ...day, phase, match: m, next, last: base, kickoff: ko, minute, score: null as MatchdayModel["score"] }, now: t });
  switch (mq.fase) {
    case "antes":
      return at(blank(base), "antes", ko - 134 * MIN);
    case "pitido":
      return at(blank(base), "pitido", ko + 2 * MIN);
    case "directo":
    case "descanso": {
      const r = mq.fase === "descanso" ? Math.round(D / 2) : Math.max(1, Math.min(D - 1, mq.reloj));
      const m: ClubMatch = { ...base, status: "scheduled", ledger: undefined, goalsFor: undefined, goalsAgainst: undefined, voteClosesAt: undefined, events: (base.events ?? []).filter((e) => (e.minute ?? 0) <= r) };
      const s = scoreOf(m);
      const o = at(m, mq.fase === "descanso" ? "descanso" : r > D / 2 ? "directo2" : "directo1", ko + r * MIN, r);
      o.day.score = s;
      return o;
    }
    case "final": {
      const m: ClubMatch = { ...base, status: "scheduled", voteClosesAt: undefined };
      return { day: { ...at(m, "final", ko + 70 * MIN).day, score: scoreOf(base) }, now: ko + 70 * MIN };
    }
    case "acta":
      return { day: { ...at(base, "acta", now).day, score: scoreOf(base) }, now };
    case "semana":
      return next ? { day: { ...day, phase: "semana", match: next, last: base, next: null, kickoff: dateMillis(next.date), minute: null, score: null }, now: dateMillis(next.date) - 3 * 86_400_000 } : { day, now };
    case "aplazado":
      return at({ ...blank(base), status: "postponed", postponedReason: "El CDM cerró el campo por un torneo de base." }, "aplazado", ko - 3 * 3_600_000);
    case "pendiente":
      return at(blank(base), "pendiente", ko + 3 * 3_600_000);
    default:
      return { day, now };
  }
}
