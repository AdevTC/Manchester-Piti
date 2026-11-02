// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../../../../../lib/clubData";
import { fakeBoard, fakeLineup, fakeWorld, makeTestStore, ME_CAPTAIN, ME_PLAYER } from "../../store/testkit";
import type { PzMatch } from "../../store/types";
import { EMPTY_FEED, type PtFeed } from "./partidoView";
import { matchAt } from "./testMatch";

const addSubs = vi.fn(async () => ({ data: { events: 1 } }));
const mesaEvent = vi.fn(async () => ({ data: { events: 0 } }));
const setMatchLineup = vi.fn(async () => ({ data: { ok: true, changed: true, officialId: "b1", starters: [], bench: [] } }));
vi.mock("../../../../mesa/api", () => ({ addSubs, waveIds: (r: string, n: number) => Array.from({ length: n }, (_, i) => `live-${r}-${i}`) }));
vi.mock("../../../../../lib/clubApi", () => ({ mesaEvent, setMatchLineup, apiError: (e: unknown) => String((e as Error)?.message ?? e) }));

const { applyProp, doDesc, doNext, mesaBlock, model, propose, sendMesa } = await import("./actions");

const SEVEN = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
const CODES = ["POR", "DFC", "LI", "LD", "MC", "MC", "DC"] as const;
const lineup = { system: "3-2-1", slots: SEVEN.map((p, i) => ({ playerId: p, code: CODES[i], x: 10 + i * 10, y: 90 - i * 10 })), boardId: "b1", setAt: 0 };
const feed = (o: Partial<PtFeed> = {}): PtFeed => ({ ...EMPTY_FEED, matchId: "j3", lineup, present: [...SEVEN, "kevin", "josito"], revision: 2, ...o });
function store(phase: PzMatch["phase"], o: { me?: typeof ME_CAPTAIN; ids?: (string | null)[]; variants?: unknown[] } = {}) {
  const W = fakeWorld();
  const L = { ...fakeLineup("3-2-1", o.ids ?? SEVEN), subs: [{ id: "s1", min: 25, out: "eguzquiza", in: "kevin" }] };
  if (o.variants) Object.assign(L, { variants: o.variants });
  const h = makeTestStore({ world: { ...W, matches: [matchAt(W, phase)], boards: [fakeBoard({ isOfficial: true, lineup: L })], official: { boardId: "b1", matchId: "j3" }, rsvp: { kevin: { v: "yes" }, josito: { v: "yes" } } }, place: "partido", me: o.me ?? ME_CAPTAIN });
  return h;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  addSubs.mockClear();
  mesaEvent.mockClear();
  setMatchLineup.mockClear();
});

describe("Partido · «Hacer el cambio» writes the acta (la mesa's addMany), with a 5 s «Deshacer»", () => {
  it("writes the next change at the live minute with the clock's revision, then undoes it by deleting the events", async () => {
    const { P } = store("juego");
    P.slice("pt-feed").set(feed({ minute: 26, events: [] }), { undoable: false, toast: false });
    expect(await doNext(P)).toBe(true);
    expect(addSubs).toHaveBeenCalledWith("j3", expect.any(String), [{ playerId: "eguzquiza", inPlayerId: "kevin", minute: 26, clockRevision: 2 }]);
    expect(P.state.toast?.text).toBe("En el acta, 26′: entra KEVIN por EGUZQUIZA");
    expect(P.state.toast?.undo).toBeTruthy();
    const rid = (addSubs.mock.calls[0] as unknown[])[1] as string;
    P.act.undo();
    await flush();
    expect(mesaEvent).toHaveBeenCalledWith({ action: "delete", matchId: "j3", eventId: `live-${rid}-0` });
  });

  it("a player can't write it; a change whose man already left is refused with its reason", async () => {
    const p = store("juego", { me: ME_PLAYER });
    p.P.slice("pt-feed").set(feed({ minute: 26 }), { undoable: false, toast: false });
    expect(await doNext(p.P)).toBe(false);
    expect(addSubs).not.toHaveBeenCalled();
    const c = store("juego");
    c.P.slice("pt-feed").set(feed({ minute: 26, events: [{ id: "x", type: "substitution", minute: 20, playerId: "eguzquiza", inPlayerId: "josito" } as MatchEvent] }), { undoable: false, toast: false });
    // (EGUZQUIZA is off: the next change is no longer that one)
    expect(model(c.P).next).toBeNull();
  });

  it("offline: nothing is sent and it says so", async () => {
    const h = store("juego");
    h.attach({ estado: "offline" });
    h.P.slice("pt-feed").set(feed({ minute: 26 }), { undoable: false, toast: false });
    expect(await doNext(h.P)).toBe(false);
    expect(addSubs).not.toHaveBeenCalled();
    expect(h.P.state.toast?.text).toMatch(/Sin conexión/);
  });

  it("half-time: the 2ª parte in one wave", async () => {
    const v2 = { id: "v2", name: "2ª parte", formation: "3-2-1", freeMode: false, slots: fakeLineup("3-2-1", ["evans", "fer", "erik", "jordi", "adrian", "kevin", "alcides"]).slots, tactics: fakeLineup().tactics };
    const { P } = store("descanso", { variants: [v2] });
    P.slice("pt-feed").set(feed({ minute: 25, clock: "halftime" }), { undoable: false, toast: false });
    expect(await doDesc(P)).toBe(true);
    expect(addSubs).toHaveBeenCalledWith("j3", expect.any(String), [{ playerId: "eguzquiza", inPlayerId: "kevin", minute: 25, clockRevision: 2 }]);
  });
});

describe("Partido · «Mandar a la mesa» and the minutes plan", () => {
  it("sends the plan board with setMatchLineup; blocked (with its reason) while the seven isn't complete", async () => {
    const ok = store("antes");
    ok.P.slice("pt-feed").set(feed({ lineup: null }), { undoable: false, toast: false });
    expect(mesaBlock(ok.P, model(ok.P))).toBe("");
    expect(await sendMesa(ok.P)).toBe(true);
    expect(setMatchLineup).toHaveBeenCalledWith({ matchId: "j3", boardId: "b1" });
    expect(ok.P.state.toast?.text).toBe("Siete en la mesa · 3-2-1");
    const short = store("antes", { ids: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", null] });
    short.P.slice("pt-feed").set(feed({ lineup: null }), { undoable: false, toast: false });
    expect(mesaBlock(short.P, model(short.P))).toBe("El siete tiene que estar completo: falta un DC.");
    expect(await sendMesa(short.P)).toBe(false);
    expect(setMatchLineup).toHaveBeenCalledTimes(1);
  });

  it("a match that started never goes to la mesa again (B-PZ-18)", () => {
    const h = store("juego");
    h.P.slice("pt-feed").set(feed({ minute: 5 }), { undoable: false, toast: false });
    expect(mesaBlock(h.P, model(h.P))).toMatch(/ya ha empezado/);
  });

  it("«Repartir minutos» proposes and «Aplicar» saves the board's subs (undoable)", () => {
    const h = store("antes");
    h.P.slice("pt-feed").set(feed(), { undoable: false, toast: false });
    propose(h.P);
    const prop = model(h.P).ui.prop;
    expect(prop?.kind).toBe("repartir");
    expect(prop!.subs.length).toBeGreaterThan(0);
    applyProp(h.P);
    expect(h.host.commit).toHaveBeenCalled();
    expect(model(h.P).ui.prop).toBeNull();
  });
});
