import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lineup } from "../formations";
import type { LineupDoc } from "../lineupDoc";
import type { UseLineups } from "../useLineups";
import { DELETE_MS, RETRY_MS, useBoardSession, type SessionArgs } from "./useBoardSession";
import { lineupOf } from "./testkit";

// Heavy suite (long fake-timer runs of the autosave and the deletes): under load it crossed the 5 s default.
vi.setConfig({ testTimeout: 15_000 });

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
      vi.advanceTimersByTime(DELETE_MS + 1000);
    });
    expect(s.remove).not.toHaveBeenCalled();
    // this time it goes
    act(() => {
      result.current.remove("b2");
    });
    act(() => {
      vi.advanceTimersByTime(DELETE_MS);
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
      vi.advanceTimersByTime(DELETE_MS);
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

  it("publishing writes the edit still waiting for its autosave first: the official carries the seven on screen", async () => {
    const s = store([doc("b1")]);
    const order: string[] = [];
    vi.mocked(s.save).mockImplementation(async () => {
      order.push("save");
    });
    vi.mocked(s.markOfficial).mockImplementation(async () => {
      order.push("official");
    });
    const { result } = renderHook(() => useBoardSession(args(s, { isAdmin: true })));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 3, "adrian"));
    });
    // (the autosave's debounce hasn't run yet)
    expect(s.save).not.toHaveBeenCalled();
    let bid: string | void = undefined;
    await act(async () => {
      bid = await result.current.publish("m8");
    });
    expect(bid).toBe("b1");
    expect(order).toEqual(["save", "official"]);
    expect(vi.mocked(s.save).mock.calls[0][0]).toBe("b1");
    expect(vi.mocked(s.save).mock.calls[0][1].slots[3].playerId).toBe("adrian");
    expect(result.current.status).toBe("saved");
    // nothing pending any more: the debounce doesn't write it again
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(s.save).toHaveBeenCalledTimes(1);
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

  it("a link to a board of another season waits for its season: no «ya no existe», then that board", () => {
    // /pizarra?season=t2&tablero=x8 opened while t1 is selected: t1's boards come first
    window.history.replaceState(null, "", "/pizarra?season=t2&tablero=x8");
    const t1 = store([doc("b1")]);
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(t1, { seasonId: "t1", urlSeason: "t2" }) });
    expect(result.current.ready).toBe(false);
    expect(result.current.notice).toBeNull();
    // the season is adopted, its boards still on their way
    rerender(args({ ...store(), loading: true }, { seasonId: "t2", urlSeason: "t2" }));
    expect(result.current.notice).toBeNull();
    // they arrive: the linked board opens, and nothing is said
    rerender(args(store([doc("mine2", { seasonId: "t2" })], [doc("x8", { seasonId: "t2", isOfficial: true, ownerUid: "cap" })]), { seasonId: "t2", urlSeason: "t2" }));
    expect(result.current).toMatchObject({ ready: true, id: "x8" });
    expect(result.current.notice).toBeNull();
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

describe("useBoardSession · no edit is lost", () => {
  it("hiding the page (closing the tab, switching app) writes the edit waiting for its debounce", async () => {
    const s = store([doc("b1")]);
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 6, "adrian"));
    });
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    vis.mockRestore();
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.save).mock.calls[0][1].slots[6].playerId).toBe("adrian");
    // the debounce does not send it a second time, nor does pagehide while it is on its way
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(s.save).toHaveBeenCalledTimes(1);

    const s2 = store([doc("b2")]);
    const r2 = renderHook(() => useBoardSession(args(s2)));
    await act(async () => {
      r2.result.current.commit(withPlayer(r2.result.current.lineup, 5, "almachi"));
    });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(s2.save).toHaveBeenCalledTimes(1);
  });

  it("a failed save is retried with backoff and stays «Sin guardar» until one goes through", async () => {
    const s = store([doc("b1")]);
    const down = Object.assign(new Error("unavailable"), { code: "unavailable" });
    vi.mocked(s.save).mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(undefined);
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 4, "eguzquiza"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await flush();
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
    await act(async () => {
      vi.advanceTimersByTime(RETRY_MS[0]);
    });
    await flush();
    expect(s.save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error"); // a quiet retry: still «Sin guardar»
    expect(result.current.notice?.n).toBe(1); // said once
    await act(async () => {
      vi.advanceTimersByTime(RETRY_MS[1]);
    });
    await flush();
    expect(s.save).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("saved");
    expect(vi.mocked(s.save).mock.calls[2][1].slots[4].playerId).toBe("eguzquiza");
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(s.save).toHaveBeenCalledTimes(3);
  });

  it("after the retries, the connection coming back tries again", async () => {
    const s = store([doc("b1")]);
    const down = Object.assign(new Error("unavailable"), { code: "unavailable" });
    vi.mocked(s.save).mockRejectedValue(down);
    const { result } = renderHook(() => useBoardSession(args(s)));
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 4, "eguzquiza"));
    });
    for (const ms of [1000, ...RETRY_MS, 60_000]) {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
      await flush();
    }
    expect(s.save).toHaveBeenCalledTimes(1 + RETRY_MS.length);
    vi.mocked(s.save).mockResolvedValue(undefined);
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    spy.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await flush();
    spy.mockRestore();
    expect(s.save).toHaveBeenCalledTimes(2 + RETRY_MS.length);
    expect(result.current.status).toBe("saved");
  });

  it("offline, a write on its way is not sent again (the squad rebuilt every minute must not resend it)", async () => {
    const s = store([doc("b1")]);
    vi.mocked(s.save).mockReturnValue(new Promise(() => {})); // offline: no server ack
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(s) });
    await act(async () => {
      result.current.commit(withPlayer(result.current.lineup, 4, "eguzquiza"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(s.save).toHaveBeenCalledTimes(1);
    for (let minute = 0; minute < 3; minute++) {
      rerender(args(s, { squadIds: [...SQUAD] })); // a new array with the same squad
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
    }
    expect(s.save).toHaveBeenCalledTimes(1);
  });

  it("a board just made is no news: it showing up in the store says nothing about another tab", async () => {
    const s = store([doc("b1", { updatedAt: 9 })]);
    vi.mocked(s.create).mockResolvedValueOnce("n1");
    const { result, rerender } = renderHook((p: SessionArgs) => useBoardSession(p), { initialProps: args(s) });
    await act(async () => {
      await result.current.newBoard();
    });
    expect(result.current.id).toBe("n1");
    // the write lands in the local cache a moment later: the new board appears in the store
    rerender(args({ ...s, mine: [doc("b1", { updatedAt: 9 }), doc("n1", { name: "Tablero nuevo", updatedAt: 10 })], all: [doc("b1", { updatedAt: 9 }), doc("n1", { name: "Tablero nuevo", updatedAt: 10 })] }));
    expect(result.current.id).toBe("n1");
    expect(result.current.notice).toBeNull();
  });

  it("«Nuevo» and «Duplicar» tapped twice make one board", async () => {
    const s = store([doc("b1", { updatedAt: 9 })]);
    let done: (id: string) => void = () => {};
    vi.mocked(s.create).mockReturnValue(new Promise<string>((ok) => (done = ok)));
    const { result } = renderHook(() => useBoardSession(args(s)));
    let a: Promise<string> = Promise.resolve("");
    let b: Promise<string> = Promise.resolve("");
    act(() => {
      a = result.current.newBoard();
      b = result.current.newBoard();
    });
    await act(async () => {
      done("n1");
      await Promise.all([a, b]);
    });
    expect(s.create).toHaveBeenCalledTimes(1);
    expect(result.current.id).toBe("n1");
    vi.mocked(s.create).mockResolvedValue("n2");
    await act(async () => {
      await Promise.all([result.current.copyBoard(null, true), result.current.copyBoard(null, true)]);
    });
    expect(s.create).toHaveBeenCalledTimes(2);
  });
});

describe("useSameIds", () => {
  it("keeps the same array while the ids are the same", async () => {
    const { useSameIds } = await import("./useBoardData");
    const { result, rerender } = renderHook((ids: string[]) => useSameIds(ids), { initialProps: ["a", "b"] });
    const first = result.current;
    rerender(["a", "b"]);
    expect(result.current).toBe(first);
    rerender(["a", "c"]);
    expect(result.current).toEqual(["a", "c"]);
    expect(result.current).not.toBe(first);
    rerender([]);
    expect(result.current).toEqual([]);
  });
});
