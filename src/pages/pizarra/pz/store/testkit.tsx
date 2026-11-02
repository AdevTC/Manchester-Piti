// r14 «La pizarra»: a render harness for a place, a sheet or the shell with a fake board (no Firebase, no router).
//   const { P, host } = renderWithPz(<Plan region="lead" layout="desktop" />, { place: "plan" });
//   P.act.place("erik", 3); expect(host.commit).toHaveBeenCalled();
import { act, render, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactElement } from "react";
import { FORMATIONS, slotIdFor, type FormationName, type Lineup } from "../../formations";
import { defaultTactics } from "../../tactics";
import { createPzStore, type PzHost, type PzInputs, type PzStore } from "./store";
import { parsePizarra } from "./routes";
import { PzProvider } from "./PzProvider";
import type { Layout, PlaceId, PzBoard, PzMatch, PzMe, PzPlayer, PzWorld } from "./types";
import type { PosCode } from "../../../../lib/positions";

const P0: [string, string, number, PosCode, number | null][] = [
  ["evans", "EVANS", 1, "POR", 63],
  ["fer", "FER", 12, "LI", 61],
  ["erik", "ERIK", 9, "DFC", 66],
  ["jordi", "JORDI", 28, "LD", 60],
  ["adrian", "ADRIÁN T.C.", 10, "MC", 70],
  ["eguzquiza", "EGUZQUIZA", 22, "MC", 64],
  ["alcides", "ALCIDES", 7, "DC", 72],
  ["kevin", "KEVIN", 11, "MC", 58],
  ["josito", "JOSITO", 23, "DC", null],
];

export function fakePlayer(id: string, shirt: string, num: number, main: PosCode, global: number | null): PzPlayer {
  const line = main === "POR" ? "POR" : ["DFC", "LIB", "LI", "LD"].includes(main) ? "DEF" : ["DC", "EI", "ED"].includes(main) ? "DEL" : "MED";
  return { id, shirt, num, first: "", last: "", line, main, also: [], global, forma: global, provisional: false, type: "Bronce", pj: 2, starts: 2, min: 90, goals: 0, assists: 0, mvp: 0, notas: global ? [{ j: 2, matchId: "j2", rival: "Rival", n: 6.4, min: 50 }] : [], playedAt: {} };
}

/** A lineup of a system with players by slot (null = empty). */
export function fakeLineup(formation: FormationName = "3-2-1", ids: (string | null)[] = []): Lineup {
  return {
    formation,
    freeMode: false,
    slots: FORMATIONS[formation].map((d, i) => ({ ...d, slotId: slotIdFor(i), playerId: ids[i] ?? null })),
    bench: [],
    roles: {},
    tactics: defaultTactics(),
    playerPositions: {},
    pinned: [],
    drawings: [],
    plays: [],
  };
}

export function fakeBoard(o: Partial<PzBoard> & { ids?: (string | null)[] } = {}): PzBoard {
  const { ids, ...rest } = o;
  return { id: "b1", name: "J3 · Red Demons", ownerUid: "u-jordi", ownerNick: "jordi", matchId: "j3", isOfficial: false, draft: false, createdAt: 0, updatedAt: 0, lineup: fakeLineup("3-2-1", ids ?? ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", null]), ...rest };
}

export function fakeWorld(o: Partial<PzWorld> = {}): PzWorld {
  const now = Date.UTC(2026, 10, 5, 19, 0);
  const j3: PzMatch = { id: "j3", j: 3, rival: "Red Demons", home: true, at: Date.UTC(2026, 10, 8, 17, 0), played: false, gf: null, ga: null, venue: "", phase: "antes", cal: { id: "j3", j: 3, rival: "Red Demons", dateMs: Date.UTC(2026, 10, 8, 17, 0), played: false, gf: null, ga: null, home: true, venue: "" } };
  return { now, season: { id: "t1", name: "Temporada 1" }, squad: P0.map(([id, s, n, m, g]) => fakePlayer(id, s, n, m, g)), guests: [], matches: [j3], next: "j3", boards: [fakeBoard()], official: null, rsvp: { kevin: { v: "yes" }, josito: { v: "no" } }, absences: [], members: [], together: () => 30, games: 2, ...o };
}

export const ME_CAPTAIN: PzMe = { uid: "u-jordi", name: "Jordi", nick: "jordi", label: "Jordi, capitán", pid: "jordi", cap: true, general: false, socia: false, jugador: false, fuera: false, member: true };
export const ME_PLAYER: PzMe = { ...ME_CAPTAIN, uid: "u-erik", name: "Erik", nick: "erik", label: "Erik, jugador", pid: "erik", cap: false, jugador: true };

export interface PzHarness {
  P: PzStore;
  host: { [K in keyof PzHost]: ReturnType<typeof vi.fn> };
  /** Re-attach with changed inputs (as the bridge does on a data change). */
  attach(patch: Partial<PzInputs>): void;
}

/** A store with a fake world and a host of spies (commit, navigate… record the calls; navigate follows the route). */
export function makeTestStore(o: { world?: PzWorld; me?: PzMe; boardId?: string; layout?: Layout; place?: PlaceId; sub?: string; q?: Record<string, string> } = {}): PzHarness {
  const P = createPzStore({ layout: o.layout ?? "desktop", route: { place: o.place ?? "siete", sub: o.sub ?? "", q: o.q ?? {} } });
  const host = {
    // (the address follows, as the router does: P.state.route moves)
    navigate: vi.fn((href: string) => {
      const u = new URL(href, "http://x");
      P.setRoute(parsePizarra(u.pathname, Object.fromEntries(u.searchParams)));
    }),
    commit: vi.fn(),
    save: vi.fn(),
    open: vi.fn(),
    duplicate: vi.fn(async (): Promise<string | void> => "b-copia"),
    remove: vi.fn(() => () => undefined),
    publish: vi.fn(async (_o: { convocatoria: boolean; boardId: string; matchId: string | null }) => undefined),
    unpublish: vi.fn(async () => undefined),
    react: vi.fn(),
    retry: vi.fn(),
    stills: vi.fn(() => undefined),
    season: vi.fn(() => "t1"),
    prefs: vi.fn(() => null),
    setPrefs: vi.fn(),
  };
  P.setHost(host as unknown as Partial<PzHost>);
  let inputs: PzInputs = { W: o.world ?? fakeWorld(), me: o.me ?? ME_CAPTAIN, boardId: o.boardId ?? "b1", estado: "normal", saveStatus: "saved", saved: Date.UTC(2026, 10, 5, 17, 2) };
  P.attach(inputs);
  return {
    P,
    host: host as unknown as PzHarness["host"],
    attach(patch) {
      inputs = { ...inputs, ...patch };
      P.attach(inputs);
    },
  };
}

/** Render a place/sheet/shell piece with the fake store. */
export function renderWithPz(ui: ReactElement, o: Parameters<typeof makeTestStore>[0] = {}): PzHarness & { r: RenderResult; flush: () => Promise<void> } {
  const h = makeTestStore(o);
  const r = render(<PzProvider store={h.P}>{ui}</PzProvider>);
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };
  return { ...h, r, flush };
}
