// The J1 scenario of the tests (Sunday 18 Oct 2026, Orduña fc at 19:00 Madrid), one match per phase of the day.
import { readyClock, transitionClock, type MatchClock } from "../../../functions/src/matchClock";
import type { ClubMatch, MatchEvent } from "../../lib/clubData";
import type { PlayerDoc } from "../../lib/schemas";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
/** 19:00 Madrid (CEST) = 17:00 UTC. */
export const KO = Date.UTC(2026, 9, 18, 17);
const J2 = Date.UTC(2026, 9, 25, 13);
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });

export const started = transitionClock(readyClock(), "start", KO);
export const half = transitionClock(started, "halftime", KO + 25 * MIN);
export const second = transitionClock(half, "second", KO + 32 * MIN);
export const ended = transitionClock(transitionClock(second, "added", KO + 55 * MIN, [], 2), "finish", KO + 59 * MIN);
export const WHISTLE = KO + 59 * MIN;

const ev = (id: string, type: MatchEvent["type"], playerId: string | undefined, seconds: number, period: 1 | 2, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type, playerId, elapsedSeconds: seconds, period, ...extra });
export const EVENTS: MatchEvent[] = [
  ev("e1", "goal", "alcides", 5 * 60 + 10, 1, { assistPlayerId: "adrian" }),
  ev("e2", "opponent_goal", undefined, 10 * 60 + 5, 1),
  ev("e3", "goal", "adrian", 20 * 60 + 30, 1, { assistPlayerId: "jordi" }),
  ev("e4", "goal", "kevin", 43 * 60, 2),
];

export const SEVEN = ["evans", "fer", "illescas", "jordi", "adrian", "eguzquiza", "alcides"];
export const base: ClubMatch = {
  id: "j1",
  seasonId: "t1",
  version: 2,
  status: "scheduled",
  rival: "Orduña fc",
  date: ts(KO),
  duration: 50,
  home: true,
  venue: "CDM Palomeras",
  clock: readyClock(),
  starters: SEVEN,
  bench: ["erik", "kevin"],
  notCalled: ["josito", "huberoski", "andia"],
  events: [],
};
export const j2: ClubMatch = { ...base, id: "j2", rival: "Pitutis", date: ts(J2), home: false, venue: "Moratalaz", starters: [], bench: [], notCalled: [] };
export const j1 = (clock: MatchClock, extra: Partial<ClubMatch> = {}): ClubMatch => ({ ...base, clock, events: EVENTS, ...extra });
const ledger = Object.fromEntries([...SEVEN, "kevin"].map((id) => [id, { played: true, minutes: id === "kevin" ? 15 : 50, goals: id === "kevin" || id === "adrian" || id === "alcides" ? 1 : 0 }]));
export const published = j1(ended, { status: "finished", goalsFor: 3, goalsAgainst: 1, voteClosesAt: WHISTLE + 48 * HOUR, liveEndedAt: WHISTLE, ledger: ledger as ClubMatch["ledger"] });

/** Each phase: the matches and the instant. */
export const SCENES = {
  pretemporada: { matches: [] as ClubMatch[], now: KO - 30 * DAY },
  semana: { matches: [base, j2], now: KO - 4 * DAY },
  antes: { matches: [base, j2], now: KO - 2 * HOUR },
  pitido: { matches: [base, j2], now: KO + 5 * MIN },
  directo1: { matches: [j1(started, { events: EVENTS.slice(0, 3) }), j2], now: KO + 22 * MIN },
  descanso: { matches: [j1(half, { events: EVENTS.slice(0, 3) }), j2], now: KO + 28 * MIN },
  directo2: { matches: [j1(second, { events: EVENTS.slice(0, 3) }), j2], now: KO + 50 * MIN },
  final: { matches: [j1(ended), j2], now: KO + 70 * MIN },
  /** Nobody started la mesa's clock and its window is over (2 h of grace after the planned end). */
  pendiente: { matches: [base, j2], now: KO + 50 * MIN + 2 * HOUR + 5 * MIN },
  acta: { matches: [published, j2], now: KO + 3 * HOUR },
  despues: { matches: [published, j2], now: KO + 52 * HOUR },
  aplazado: { matches: [{ ...base, status: "postponed" } as ClubMatch, j2], now: KO - 3 * HOUR },
};

const NAMES: Record<string, [string, number]> = {
  evans: ["EVANS", 1], fer: ["FER", 12], illescas: ["ILLESCAS", 4], jordi: ["JORDI", 28], adrian: ["ADRIÁN T.C.", 10], eguzquiza: ["EGUZQUIZA", 22],
  alcides: ["ALCIDES", 7], erik: ["ERIK", 9], kevin: ["KEVIN", 11], josito: ["JOSITO", 8], huberoski: ["HUBEROSKI", 14], andia: ["ANDIA", 19],
};
export const PLAYERS = Object.entries(NAMES).map(([id, [shirtName, number]]) => ({ id, shirtName, number, seasons: ["t1"] }) as unknown as PlayerDoc);
export const nameOf = (id: string) => NAMES[id]?.[0] ?? id;
