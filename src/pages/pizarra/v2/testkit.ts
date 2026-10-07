// Fixtures for the pizarra tests: a squad of cromos and lineups, without Firebase.
import type { FormationName, Lineup, Zone } from "../formations";
import { seedLineup } from "../lineupOps";
import type { LineupDoc } from "../lineupDoc";
import { pairKey, type Cromo, type PairStats, type Squad } from "./model";
import type { BoardSession } from "./useBoardSession";

export function cromo(id: string, num: number, pos: Zone | undefined, extra: Partial<Cromo> = {}): Cromo {
  return {
    id,
    num,
    name: id.toUpperCase(),
    pos,
    rt: 70,
    stats: { played: 0, goals: 0, assists: 0, minutes: 0, starts: 0, mvps: 0 },
    recentMin: 0,
    recentGA: 0,
    ...extra,
  };
}

export function squadOf(list: Cromo[], pairs: [string, string, Partial<PairStats>][] = [], recentLabel = "J5–J7", games = 7): Squad {
  return {
    list,
    byId: new Map(list.map((c) => [c.id, c])),
    pairs: new Map(pairs.map(([a, b, p]) => [pairKey(a, b), { tog: 0, ast: 0, ...p }])),
    recentLabel,
    games,
  };
}

/** A lineup of `formation` with `ids` in slot order (null = empty), the rest of the squad on the bench. */
export function lineupOf(ids: (string | null)[], formation: FormationName = "2-3-1", squad?: Squad): Lineup {
  const L = seedLineup(formation, []);
  const slots = L.slots.map((s, i) => ({ ...s, playerId: ids[i] ?? null }));
  const on = new Set(ids.filter(Boolean));
  return { ...L, slots, bench: squad ? squad.list.map((c) => c.id).filter((id) => !on.has(id)) : [] };
}

/** The design's example squad: two keepers, defenders, midfielders, forwards. */
export function demoSquad(): Squad {
  return squadOf([
    cromo("evans", 1, "POR", { rt: 87 }),
    cromo("fer", 12, "POR", { rt: 55 }),
    cromo("illescas", 4, "DEF", { rt: 83 }),
    cromo("tello", 20, "DEF", { rt: 79 }),
    cromo("brawan", 33, "DEF", { rt: 62, baja: "Lesionado" }),
    cromo("huberoski", 14, "MED", { rt: 95 }),
    cromo("eguzquiza", 8, "MED", { rt: 81 }),
    cromo("almachi", 21, "MED", { rt: 74 }),
    cromo("andia", 19, "MED", { rt: 60, baja: "Sancionado" }),
    cromo("adrian", 10, "DEL", { rt: 96 }),
    cromo("erik", 9, "DEL", { rt: 96 }),
    cromo("kevin", 11, "DEL", { rt: 75 }),
  ]);
}

/** A board session for component tests: the lineup lives in the caller's state; every store action
 *  is a resolved no-op unless overridden. */
export function fakeSession(lineup: Lineup, over: Partial<BoardSession> = {}): BoardSession {
  return {
    key: "t1:b1",
    ready: true,
    id: "b1",
    name: "J8 · MAD SKY",
    lineup,
    readOnly: false,
    official: false,
    owner: "capi",
    matchId: null,
    status: "saved",
    savedAt: null,
    mine: [],
    officials: [],
    notice: null,
    commit: () => {},
    duplicate: () => {},
    openMine: () => {},
    open: () => {},
    newBoard: async () => "Tablero nuevo",
    copyBoard: async () => "Copia",
    rename: async () => {},
    remove: () => () => {},
    linkMatch: async () => {},
    publish: async () => {},
    unpublish: async () => {},
    ...over,
  };
}

/** A stored board as useLineups lists it. */
export function boardDoc(id: string, lineup: Lineup, over: Partial<LineupDoc> = {}): LineupDoc {
  return {
    ...lineup,
    id,
    ownerUid: "me",
    ownerNickname: "yo",
    seasonId: "t1",
    name: "Tablero " + id,
    isOfficial: false,
    matchId: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}
