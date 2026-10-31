// «Tu juego»'s test season, shared by juegoView.test.ts and Juego.test.tsx. Production-shaped (2026-10-31):
// Temporada 1, the J1 played (Jordi 40′ at right back in two stints), the J2 seen from outside (not called up),
// twenty jornadas to come.
import type { ClubMatch, Participation } from "../../../../../lib/clubData";
import type { PlayerDoc } from "../../../../../lib/schemas";
import type { PlayerPositions } from "../../../../../lib/positionStats";
import { MODEL_VERSION } from "../../../../../lib/rating/constants";
import type { PositionsInfo } from "../../../profileData";
import type { Answer, MeInput } from "../../me";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 12);
export const NOW = T0 + 14 * DAY;
const player = (id: string, number: number, shirtName: string, firstName: string): PlayerDoc => ({ id, number, shirtName, firstName, lastName: "", seasons: ["t1"], active: true }) as unknown as PlayerDoc;
export const PLAYERS = [player("jordi", 28, "JORDI", "Jordi"), player("alcides", 7, "ALCIDES", "Alcides"), player("kevin", 10, "KEVIN", "Kevin"), player("erik", 9, "ERIK", "Erik")];
const row = (o: Partial<Participation>): Participation =>
  ({ minutes: 0, started: false, benched: false, notCalled: false, played: false, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...o }) as Participation;
const notas = (players: Record<string, number>) => ({ model: MODEL_VERSION, rival: 1, players: Object.fromEntries(Object.entries(players).map(([id, nota]) => [id, { nota, minutes: 40, weight: 0.8, narrated: false }])) });
const finished = (id: string, day: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>): ClubMatch =>
  ({ id, seasonId: "t1", rival: `Rival ${id}`, home: true, status: "finished", date: T0 + day * DAY, duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ledger, notas: notas(nts) }) as ClubMatch;
const upcoming = Array.from({ length: 20 }, (_, i) => ({ id: `u${i + 3}`, seasonId: "t1", rival: `Rival ${i + 3}`, home: true, status: "scheduled", date: T0 + (21 + i * 7) * DAY, events: [] }) as unknown as ClubMatch);
const J1 = finished(
  "j1",
  0,
  1,
  8,
  {
    jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 25 }, { from: 35, to: 50 }], positionsPlayed: { LD: 40 } }),
    alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }], goals: 1 }),
    kevin: row({ played: true, minutes: 10, stints: [{ from: 25, to: 35 }] }),
    erik: row({ notCalled: true }),
  },
  { jordi: 4.7, alcides: 6.2, kevin: 5.1 },
);
const J2 = finished("j2", 7, 3, 1, { jordi: row({ notCalled: true }), alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }] }), kevin: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }], assists: 2 }), erik: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }] }) }, { alcides: 7.1, kevin: 6.4, erik: 6.8 });

export const input: MeInput = { playerId: "jordi", seasonId: "t1", matches: [J1, J2, ...upcoming], players: PLAYERS, seasons: [{ id: "t1", name: "Temporada 1" }], mvpResults: new Map(), standings: [], now: NOW, answers: new Map<string, Answer>(), card: null };

/** His minutes by position (data.played): 40′ at right back in the J1. */
export const PLAYED: PlayerPositions = { lines: [{ code: "LD", minutes: 40 }], minutes: 40, estimatedMatches: 0, matches: 1, top: "LD" } as PlayerPositions;
/** His ficha's positions (data.positions): right back ★, left back ✓. */
export const info = (o: Partial<PositionsInfo> = {}): PositionsInfo => ({ approved: { main: "LD", also: ["LI"] }, proposal: null, state: "ninguna", inSeason: true, ...o });
