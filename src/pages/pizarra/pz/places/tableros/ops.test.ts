// @vitest-environment jsdom
// r14 «La pizarra» · Tableros: the board operations over the app's data (rename with its errors, link, take the
// official off with 12 s, duplicate with its voices, new boards, recover a snapshot, la mesa's copies).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({ updateDoc: vi.fn(async () => undefined) }));
vi.mock("firebase/firestore", async (orig) => ({ ...(await orig<typeof import("firebase/firestore")>()), updateDoc: fs.updateDoc, doc: (_db: unknown, ...p: string[]) => ({ path: p.join("/") }), serverTimestamp: () => "ts" }));
vi.mock("../../../../../firebase", () => ({ db: {} }));
const data = vi.hoisted(() => ({ copyBoardVoices: vi.fn(async () => 2 as number | null), deleteMesaCopies: vi.fn(async () => [] as string[]) }));
vi.mock("../../../data/boards", async (orig) => ({ ...(await orig<typeof import("../../../data/boards")>()), copyBoardVoices: data.copyBoardVoices, deleteMesaCopies: data.deleteMesaCopies }));

import { fakeBoard, fakeWorld, makeTestStore, ME_CAPTAIN, ME_PLAYER } from "../../store/testkit";
import type { LineupDoc } from "../../../lineupDoc";
import type { PzMatch, PzWorld } from "../../store/types";
import { makeOps } from "./ops";
import { pb } from "./pb";

const docOf = (o: Partial<LineupDoc> & { id: string; name: string; ownerUid: string }): LineupDoc => ({ ownerNickname: "x", seasonId: "t1", isOfficial: false, matchId: null, fromMesa: false, fanToken: null, sevenKey: null, sevenRev: 0, ...fakeBoard().lineup, ...o }) as LineupDoc;

function setup(o: { world?: PzWorld; docs?: LineupDoc[]; me?: typeof ME_CAPTAIN } = {}) {
  const h = makeTestStore({ world: o.world, me: o.me, place: "tableros" });
  const lineups = {
    all: o.docs ?? [docOf({ id: "b1", name: "J3 · Red Demons", ownerUid: "u-jordi" }), docOf({ id: "b2", name: "Probando", ownerUid: "u-jordi" }), docOf({ id: "e1", name: "Mi siete", ownerUid: "u-erik" })],
    create: vi.fn(async () => "nuevo-1"),
    rename: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    markOfficial: vi.fn(async () => undefined),
  };
  const ops = makeOps(h.P, lineups, (o.me ?? ME_CAPTAIN).uid);
  return { ...h, lineups, ops };
}

beforeEach(() => {
  pb.reset();
  fs.updateDoc.mockClear();
  data.copyBoardVoices.mockClear();
  data.deleteMesaCopies.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("rename", () => {
  const world = fakeWorld({ boards: [fakeBoard(), fakeBoard({ id: "b2", name: "Probando" }), fakeBoard({ id: "e1", name: "Mi siete", ownerUid: "u-erik", ownerNick: "erik" })] });
  it("says why a name can't be used (empty, too long, another of the owner's boards has it)", async () => {
    const { ops, lineups } = setup({ world });
    expect(await ops.rename("b1", "   ")).toBe("Ponle un nombre al tablero");
    expect(await ops.rename("b1", "x".repeat(41))).toBe("Máximo 40 caracteres");
    expect(await ops.rename("b1", "probando")).toBe("Ya tienes un tablero con ese nombre");
    expect(lineups.rename).not.toHaveBeenCalled();
  });
  it("names the owner when a captain renames someone else's board into a clash", async () => {
    const docs = [docOf({ id: "e1", name: "Mi siete", ownerUid: "u-erik" }), docOf({ id: "e2", name: "Otro", ownerUid: "u-erik" })];
    const { ops } = setup({ world: { ...world, boards: [...world.boards, fakeBoard({ id: "e2", name: "Otro", ownerUid: "u-erik", ownerNick: "erik" })] }, docs });
    expect(await ops.rename("e1", "otro")).toBe("@erik ya tiene un tablero con ese nombre");
  });
  it("a player can't rename a board that isn't his", async () => {
    const { ops } = setup({ world, me: ME_PLAYER });
    expect(await ops.rename("b1", "Nuevo")).toBe("Solo lectura");
  });
  it("renames (spaces folded) and «Deshacer» puts the old name back", async () => {
    const { ops, lineups, P } = setup({ world });
    expect(await ops.rename("b1", "  Contra   Red Demons ")).toBe("");
    expect(lineups.rename).toHaveBeenCalledWith("b1", "Contra Red Demons");
    expect(P.state.toast?.text).toBe("Renombrado: «Contra Red Demons»");
    P.act.undo();
    expect(lineups.rename).toHaveBeenLastCalledWith("b1", "J3 · Red Demons");
  });
});

describe("link", () => {
  it("a board that isn't official: only its match changes (never its seven), undoable", async () => {
    const { ops, P } = setup();
    await ops.link("b1", null);
    expect(fs.updateDoc).toHaveBeenCalledWith({ path: "lineups/b1" }, { matchId: null, updatedAt: "ts" });
    expect(P.state.toast?.text).toBe("Sin partido vinculado");
    P.act.undo();
    await Promise.resolve();
    expect(fs.updateDoc).toHaveBeenLastCalledWith({ path: "lineups/b1" }, { matchId: "j3", updatedAt: "ts" });
  });
  it("the official: its match is its scope (published again for the new one)", async () => {
    const world = fakeWorld({ boards: [fakeBoard({ isOfficial: true })], official: { boardId: "b1", matchId: "j3" } });
    const { ops, lineups } = setup({ world });
    await ops.link("b1", null);
    expect(lineups.markOfficial).toHaveBeenCalledWith("b1", { matchId: null });
    expect(fs.updateDoc).not.toHaveBeenCalled();
  });
});

describe("take the official off", () => {
  const world = fakeWorld({ boards: [fakeBoard({ isOfficial: true })], official: { boardId: "b1", matchId: "j3" } });
  it("waits 12 s (it can be undone meanwhile, without losing its reactions), then unpublishes", () => {
    vi.useFakeTimers();
    const { ops, lineups, P } = setup({ world });
    ops.quitarOficial("b1");
    expect(pb.get().pend).toMatchObject({ kind: "quitar", ids: ["b1"] });
    expect(P.state.toast?.long).toBe(true);
    vi.advanceTimersByTime(11_000);
    expect(lineups.markOfficial).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_100);
    expect(lineups.markOfficial).toHaveBeenCalledWith("b1", null);
    expect(pb.get().pend).toBeNull();
  });
  it("«Deshacer» within the 12 s: nothing is written", () => {
    vi.useFakeTimers();
    const { ops, lineups, P } = setup({ world });
    ops.quitarOficial("b1");
    P.act.undo();
    expect(pb.get().pend).toBeNull();
    vi.advanceTimersByTime(20_000);
    expect(lineups.markOfficial).not.toHaveBeenCalled();
  });
  it("only a captain", () => {
    const { ops } = setup({ world, me: ME_PLAYER });
    ops.quitarOficial("b1");
    expect(pb.get().pend).toBeNull();
  });
});

describe("new boards and copies", () => {
  it("duplicate: a copy of yours on the same match, its voices copied (PZ-D08), undoable", async () => {
    const world = fakeWorld({ boards: [fakeBoard({ id: "e1", name: "Mi siete", ownerUid: "u-erik", ownerNick: "erik" })] });
    const { ops, lineups, P, attach } = setup({ world });
    const p = ops.duplicate("e1");
    await Promise.resolve();
    // the copy reaches the store (as the season's query would bring it)
    attach({ W: { ...world, boards: [...world.boards, fakeBoard({ id: "nuevo-1", name: "Mi siete (copia)" })] } });
    expect(await p).toBe("nuevo-1");
    expect(lineups.create).toHaveBeenCalledWith(expect.objectContaining({ formation: "3-2-1" }), "Mi siete (copia)", "j3");
    expect(data.copyBoardVoices).toHaveBeenCalledWith("e1", "nuevo-1", "u-jordi");
    expect(pb.get().sel).toBe("nuevo-1");
    P.act.undo();
    expect(lineups.remove).toHaveBeenCalledWith("nuevo-1");
  });
  it("says when the voices couldn't be copied", async () => {
    data.copyBoardVoices.mockResolvedValueOnce(null);
    const world = fakeWorld();
    const { ops, P, attach } = setup({ world });
    const p = ops.duplicate("b1");
    await Promise.resolve();
    attach({ W: { ...world, boards: [...world.boards, fakeBoard({ id: "nuevo-1" })] } });
    await p;
    await Promise.resolve();
    expect(P.state.toast?.text).toBe("Copia creada, pero la voz no se ha copiado");
  });
  it("a new board from a seven: its players by slot, a unique name, the next match", async () => {
    const world = fakeWorld();
    const { ops, lineups, attach } = setup({ world });
    const p = ops.create({ formation: "2-3-1", ids: ["evans", null, "erik"], name: "Probando" });
    await Promise.resolve();
    attach({ W: { ...world, boards: [...world.boards, fakeBoard({ id: "nuevo-1" })] } });
    await p;
    const [L, name, matchId] = lineups.create.mock.calls[0] as unknown as [{ formation: string; slots: { playerId: string | null }[] }, string, string];
    expect(L.formation).toBe("2-3-1");
    expect(L.slots.slice(0, 3).map((s) => s.playerId)).toEqual(["evans", null, "erik"]);
    expect(name).toBe("Probando 2");
    expect(matchId).toBe("j3");
  });
  it("someone without a ficha can't make boards", async () => {
    const { ops, lineups } = setup({ me: { ...ME_PLAYER, socia: true, pid: null } });
    expect(await ops.create({ formation: "2-3-1", ids: [], name: "X" })).toBeNull();
    expect(lineups.create).not.toHaveBeenCalled();
  });
});

describe("la mesa's copies (PZ-D22T)", () => {
  const played: PzMatch = { ...fakeWorld().matches[0], id: "j1", j: 1, played: true, phase: "jugado" };
  const world = fakeWorld({ matches: [played, ...fakeWorld().matches], boards: [fakeBoard(), fakeBoard({ id: "m1", name: "Siete del campo · J1", ownerUid: "u-fer", matchId: "j1" })] });
  const docs = [docOf({ id: "b1", name: "J3 · Red Demons", ownerUid: "u-jordi", matchId: "j3" }), docOf({ id: "m1", name: "Siete del campo · J1", ownerUid: "u-fer", matchId: "j1" }), docOf({ id: "m3", name: "Siete del partido", ownerUid: "u-fer", matchId: "j3", fromMesa: true })];
  it("only the copies of matches already played, deleted after 12 s (undo keeps them)", () => {
    vi.useFakeTimers();
    const { ops, P } = setup({ world, docs });
    expect(ops.isMesa("m1")).toBe(true);
    expect(ops.isMesa("m3")).toBe(true);
    expect(ops.isMesa("b1")).toBe(false);
    expect(ops.mesaCopies()).toEqual(["m1"]);
    ops.cleanMesa();
    expect(pb.get().pend).toMatchObject({ kind: "mesa", ids: ["m1"] });
    P.act.undo();
    vi.advanceTimersByTime(13_000);
    expect(data.deleteMesaCopies).not.toHaveBeenCalled();
    P.act.redo();
    vi.advanceTimersByTime(12_100);
    expect(data.deleteMesaCopies).toHaveBeenCalledWith(["m1"]);
  });
  it("a player can't", () => {
    const { ops } = setup({ world, docs, me: ME_PLAYER });
    ops.cleanMesa();
    expect(pb.get().pend).toBeNull();
  });
});

describe("recover a snapshot", () => {
  it("writes the snapshot's seven and system through the board (undoable); a read-only board says so", () => {
    const { ops, P, host } = setup();
    const snap = { id: "h1", kind: "sistema" as const, label: "Pasa al 2-3-1", entra: [], formation: "2-3-1" as const, freeMode: false, system: "2-3-1", slots: Array.from({ length: 7 }, (_, i) => ({ playerId: i === 0 ? "evans" : null, code: "MC", x: 50, y: 50 })), roles: { captainId: "evans" }, takers: {}, tactics: {}, isOfficial: false, at: 0 };
    ops.restore("b1", snap);
    expect(host.commit).toHaveBeenCalledWith(expect.objectContaining({ formation: "2-3-1", roles: { captainId: "evans" } }));
    expect(P.state.toast?.text).toBe("Recuperado: «Pasa al 2-3-1»");
    const r = setup({ me: ME_PLAYER });
    r.ops.restore("b1", snap);
    expect(r.host.commit).not.toHaveBeenCalled();
  });
});
