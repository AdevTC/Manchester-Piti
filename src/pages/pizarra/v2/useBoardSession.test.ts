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
