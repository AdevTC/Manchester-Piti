import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { useBoardSession, type SessionArgs } from "./useBoardSession";
import { lineupOf } from "./testkit";

// Which board is on screen, who may edit it, and the autosave — with a fake store.

const SQUAD = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian", "kevin"];

function doc(id: string, over: Partial<LineupDoc> = {}): LineupDoc {
  return {
    ...lineupOf(["evans", "illescas"]),
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

function store(mine: LineupDoc[] = [], official: LineupDoc[] = []): UseLineups {
  return {
    mine,
    official,
    all: [...mine, ...official],
    loading: false,
    create: vi.fn(async () => "new1"),
    save: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    markOfficial: vi.fn(async () => undefined),
  };
}

const args = (lineups: UseLineups, over: Partial<SessionArgs> = {}): SessionArgs => ({
  seasonId: "t1",
  lineups,
  squadIds: SQUAD,
  squadReady: true,
  uid: "me",
  isAdmin: false,
  draftName: "J8 · MAD SKY",
  ...over,
});

const withPlayer = (L: Lineup, i: number, id: string): Lineup => ({ ...L, slots: L.slots.map((s, k) => (k === i ? { ...s, playerId: id } : s)) });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, "", "/pizarra");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useBoardSession", () => {
  it("without boards: a draft that becomes a board on its first change, then autosaves", async () => {
    const s = store();
    const { result } = renderHook(() => useBoardSession(args(s)));
    expect(result.current).toMatchObject({ ready: true, status: "draft", name: "J8 · MAD SKY", readOnly: false });
    expect(result.current.lineup.slots.every((x) => !x.playerId)).toBe(true);
    const key0 = result.current.key;
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 0, "evans"));
    });
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.create).mock.calls[0][1]).toBe("J8 · MAD SKY");
    // same key: the board keeps its history and selection
    expect(result.current.key).toBe(key0);
    expect(result.current.lineup.slots[0].playerId).toBe("evans");
    expect(result.current.status).toBe("saved");
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 1, "illescas"));
    });
    expect(result.current.status).toBe("saving");
    expect(s.save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.save).mock.calls[0][0]).toBe("new1");
    expect(vi.mocked(s.save).mock.calls[0][1].slots[1].playerId).toBe("illescas");
    expect(s.create).toHaveBeenCalledTimes(1);
  });

  it("opens your newest board; rapid edits make one write", async () => {
    const s = store([doc("old", { updatedAt: 5 }), doc("new", { updatedAt: 9 })]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    expect(result.current.name).toBe("Tablero new");
    expect(result.current.status).toBe("saved");
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 2, "tello"));
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 3, "huberoski"));
    });
    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(s.save).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(s.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(s.save).mock.calls[0][1];
    expect([saved.slots[2].playerId, saved.slots[3].playerId]).toEqual(["tello", "huberoski"]);
    // the stored bench follows the pitch
    expect(saved.bench).not.toContain("tello");
    expect(saved.bench).toContain("kevin");
  });

  it("the official board is read-only for a member: no writes, a copy to edit, back to yours", async () => {
    window.history.replaceState(null, "", "/pizarra?tablero=off");
    const off = doc("off", { isOfficial: true, ownerUid: "cap", ownerNickname: "capi", name: "Oficial · J8" });
    const s = store([doc("mine1")], [off]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    expect(result.current).toMatchObject({ readOnly: true, official: true, name: "Oficial · J8", owner: "capi" });
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 3, "huberoski"));
      vi.advanceTimersByTime(2000);
    });
    expect(s.save).not.toHaveBeenCalled();
    expect(s.create).not.toHaveBeenCalled();
    await act(async () => {
      result.current.duplicate();
    });
    expect(vi.mocked(s.create).mock.calls[0][1]).toBe("Copia del oficial");
    expect(result.current.readOnly).toBe(false);
    act(() => result.current.openMine());
    expect(result.current.name).toBe("Tablero mine1");
  });

  it("admins edit the official board; someone else's board is read-only", () => {
    window.history.replaceState(null, "", "/pizarra?tablero=off");
    const off = doc("off", { isOfficial: true, ownerUid: "cap" });
    expect(renderHook(() => useBoardSession(args(store([], [off]), { isAdmin: true }))).result.current.readOnly).toBe(false);
    window.history.replaceState(null, "", "/pizarra?tablero=his");
    const his = doc("his", { ownerUid: "other", ownerNickname: "pepe" });
    const r = renderHook(() => useBoardSession(args(store([], [his]))));
    expect(r.result.current).toMatchObject({ readOnly: true, official: false, owner: "pepe" });
  });

  it("an edit still waiting for its write is written when you leave", async () => {
    const s = store([doc("b1")]);
    const { result, unmount } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 6, "adrian"));
    });
    unmount();
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.save).mock.calls[0][1].slots[6].playerId).toBe("adrian");
  });

  it("waits for the squad and the boards before anything can change", () => {
    const s = { ...store(), loading: true };
    const { result } = renderHook(() => useBoardSession(args(s)));
    expect(result.current.ready).toBe(false);
    act(() => result.current.commit(withPlayer(result.current.lineup, 0, "evans")));
    expect(s.create).not.toHaveBeenCalled();
  });
});

// ── Phase 3: your boards around the one on screen ──

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("useBoardSession · tableros", () => {
  it("a new empty board and copies (the copy of the board on screen keeps its unsaved edits)", async () => {
    const s = store([doc("b1", { updatedAt: 9 })]);
    vi.mocked(s.create).mockResolvedValueOnce("n1").mockResolvedValueOnce("n2");
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      await result.current.newBoard();
    });
    const [L1, name1] = vi.mocked(s.create).mock.calls[0];
    expect(name1).toBe("Tablero nuevo");
    expect(L1.slots.every((x) => !x.playerId)).toBe(true);
    expect(result.current).toMatchObject({ id: "n1", name: "Tablero nuevo", readOnly: false });

    act(() => result.current.open("b1"));
    expect(result.current.id).toBe("b1");
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 5, "almachi"));
    });
    await act(async () => {
      await result.current.copyBoard(null, true);
    });
    const [L2, name2] = vi.mocked(s.create).mock.calls[1];
    expect(name2).toBe("Tablero b1 (copia)");
    expect(L2.slots[5].playerId).toBe("almachi");
    expect(result.current.id).toBe("n2");
    // the edit left behind is written as you leave the board
    expect(vi.mocked(s.save).mock.calls.at(-1)?.[0]).toBe("b1");
  });

  it("renames the board on screen: validated, unique among your boards", async () => {
    const s = store([doc("b1", { updatedAt: 9 }), doc("b2", { name: "Plan B" })]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    await expect(result.current.rename("  plan  b ")).rejects.toThrow("Ya tienes un tablero con ese nombre");
    await expect(result.current.rename("   ")).rejects.toThrow("Ponle un nombre al tablero");
    await act(async () => {
      await result.current.rename("  Mi   siete ");
    });
    expect(s.rename).toHaveBeenCalledWith("b1", "Mi siete");
    // the draft is stored under its new name
    const d = store();
    const r2 = renderHook(() => useBoardSession(args(d)));
    await act(async () => {
      await r2.result.current.rename("Primero");
    });
    expect(vi.mocked(d.create).mock.calls[0][1]).toBe("Primero");
  });

  it("deleting the board on screen opens your next one; Deshacer brings it back before it goes", () => {
    const s = store([doc("b1", { updatedAt: 9 }), doc("b2", { updatedAt: 5 })]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    expect(result.current.id).toBe("b1");
    let undoIt = () => {};
    act(() => {
      undoIt = result.current.remove("b1");
    });
    expect(result.current.id).toBe("b2");
    expect(result.current.mine.map((d) => d.id)).toEqual(["b2"]);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => undoIt());
    expect(result.current.id).toBe("b1");
    expect(result.current.mine.map((d) => d.id)).toEqual(["b1", "b2"]);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(s.remove).not.toHaveBeenCalled();
    // this time it goes
    act(() => {
      result.current.remove("b2");
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(s.remove).toHaveBeenCalledWith("b2");
  });

  it("a delete that fails brings the board back and says why; leaving the page sends a pending delete", async () => {
    const s = store([doc("b1", { updatedAt: 9 }), doc("b2", { updatedAt: 5 })]);
    vi.mocked(s.remove).mockRejectedValueOnce(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const { result, unmount } = renderHook(() => useBoardSession(args(s)));
    act(() => {
      result.current.remove("b2");
    });
    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    await flush();
    expect(result.current.mine.map((d) => d.id)).toContain("b2");
    expect(result.current.notice?.msg).toMatch(/No se ha podido guardar/);
    act(() => {
      result.current.remove("b2");
    });
    unmount();
    expect(s.remove).toHaveBeenCalledTimes(2);
  });

  it("links a match (an official's match is its scope); the draft is stored first", async () => {
    const s = store([doc("b1")]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      await result.current.linkMatch("m8");
    });
    expect(vi.mocked(s.save).mock.calls[0][0]).toBe("b1");
    expect(vi.mocked(s.save).mock.calls[0][2]).toBe("m8");

    window.history.replaceState(null, "", "/pizarra?tablero=off");
    const o = store([], [doc("off", { isOfficial: true, ownerUid: "cap", matchId: "m8" })]);
    const r2 = renderHook(() => useBoardSession(args(o, { isAdmin: true })));
    await act(async () => {
      await r2.result.current.linkMatch(null);
    });
    expect(o.markOfficial).toHaveBeenCalledWith("off", { matchId: null });

    window.history.replaceState(null, "", "/pizarra");
    const d = store();
    const r3 = renderHook(() => useBoardSession(args(d)));
    await act(async () => {
      await r3.result.current.linkMatch("m9");
    });
    expect(d.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.save).mock.calls[0][0]).toBe("new1");
    expect(vi.mocked(d.save).mock.calls[0][2]).toBe("m9");
  });

  it("only captains (admins) publish the official, for a match or the season, and take it down", async () => {
    const s = store([doc("b1")]);
    const member = renderHook(() => useBoardSession(args(s)));
    await expect(member.result.current.publish("m8")).rejects.toThrow(/capitanes/);
    expect(s.markOfficial).not.toHaveBeenCalled();
    const cap = renderHook(() => useBoardSession(args(s, { isAdmin: true })));
    await act(async () => {
      await cap.result.current.publish("m8");
    });
    expect(s.markOfficial).toHaveBeenCalledWith("b1", { matchId: "m8" });
    await act(async () => {
      await cap.result.current.publish(null);
      await cap.result.current.unpublish("b1");
    });
    expect(vi.mocked(s.markOfficial).mock.calls.slice(1)).toEqual([
      ["b1", { matchId: null }],
      ["b1", null],
    ]);
  });
});

describe("useBoardSession · lo que cambia por debajo", () => {
  it("another tab changes the board: it shows and says so (your own writes don't)", async () => {
    const s = store([doc("b1")]);
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(s) });
    expect(result.current.notice).toBeNull();
    // our own edit, saved and read back: no notice
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 4, "eguzquiza"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const written = vi.mocked(s.save).mock.calls[0][1];
    rerender(args(store([doc("b1", { ...written, updatedAt: 2 })])));
    expect(result.current.notice).toBeNull();
    // someone else's write
    const theirs = withPlayer(written, 6, "kevin");
    rerender(args(store([doc("b1", { ...theirs, updatedAt: 3 })])));
    expect(result.current.notice?.msg).toBe("Tablero actualizado desde otra pestaña o dispositivo");
    expect(result.current.lineup.slots[6].playerId).toBe("kevin");
  });

  it("the official replaced by another: whoever was looking at it goes on to the new one", () => {
    window.history.replaceState(null, "", "/pizarra?tablero=off");
    const off = doc("off", { isOfficial: true, ownerUid: "cap", matchId: "m8", name: "Oficial · J8" });
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(store([doc("mine1")], [off])) });
    expect(result.current).toMatchObject({ id: "off", official: true, readOnly: true });
    const was = { ...off, isOfficial: false };
    const next = doc("off2", { isOfficial: true, ownerUid: "cap", matchId: "m8", name: "Oficial nuevo" });
    const s2 = store([doc("mine1")], [next]);
    rerender(args({ ...s2, all: [doc("mine1"), was, next] }));
    expect(result.current.notice?.msg).toBe("Hay un oficial nuevo: «Oficial nuevo»");
    expect(result.current).toMatchObject({ id: "off2", official: true });
  });

  it("a board deleted on another device, and a link to a board that isn't there", () => {
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(store([doc("b1", { updatedAt: 9 }), doc("b2", { updatedAt: 5 })])) });
    expect(result.current.id).toBe("b1");
    rerender(args(store([doc("b2", { updatedAt: 5 })])));
    expect(result.current.id).toBe("b2");
    expect(result.current.notice?.msg).toBe("Ese tablero se ha borrado en otro dispositivo");

    window.history.replaceState(null, "", "/pizarra?tablero=zzz");
    const r2 = renderHook(() => useBoardSession(args(store([doc("b1")]))));
    expect(r2.result.current.id).toBe("b1");
    expect(r2.result.current.notice?.msg).toBe("Ese tablero ya no existe o no es de esta temporada");
  });

  it("a refused save says why once; without connection the edit waits", async () => {
    const s = store([doc("b1")]);
    vi.mocked(s.save).mockRejectedValue(Object.assign(new Error("denied"), { code: "permission-denied" }));
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 4, "eguzquiza"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await flush();
    expect(result.current.status).toBe("error");
    expect(result.current.notice).toMatchObject({ n: 1, msg: expect.stringMatching(/No se ha podido guardar/) });
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 5, "almachi"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await flush();
    expect(result.current.notice?.n).toBe(1);

    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const o = store([doc("b1")]);
    vi.mocked(o.save).mockReturnValue(new Promise(() => {}));
    const r2 = renderHook(() => useBoardSession(args(o)));
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await act(async () => {
      r2.result.current.commit(withPlayer(r2.result.current.lineup, 4, "eguzquiza"));
    });
    expect(r2.result.current.status).toBe("offline");
    spy.mockRestore();
  });
});
