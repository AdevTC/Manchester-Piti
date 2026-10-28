import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_DRAFTS, putClubDraft, type Drafts } from "./contentModel";
import { DEFAULT_CONTENT } from "../../../lib/clubContentDefaults";

// clubDrafts/content on a fake Firestore: one listener, the writes recorded, a write refused on demand.
const h = vi.hoisted(() => ({
  emit: null as null | ((d: Record<string, unknown> | undefined) => void),
  writes: [] as Record<string, unknown>[],
  deletes: 0,
  refuse: false,
}));
vi.mock("../../../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  serverTimestamp: () => "server-time",
  onSnapshot: (_ref: unknown, next: (s: { exists: () => boolean; data: () => Record<string, unknown> | undefined }) => void) => {
    h.emit = (d) => next({ exists: () => !!d, data: () => d });
    return () => undefined;
  },
  setDoc: vi.fn(async (_ref: unknown, data: Record<string, unknown>) => {
    if (h.refuse) throw Object.assign(new Error("refused"), { code: "permission-denied" });
    h.writes.push(data);
  }),
  deleteDoc: vi.fn(async () => {
    h.deletes++;
  }),
}));
const { DRAFT_WRITE_DELAY, resetContentDraftsForTests, useContentDraftState } = await import("./contentDraftStore");

const me = { uid: "u1", name: "jordi" };
const withIntro = (d: Drafts, intro: string) => putClubDraft(d, "frase", { intro, location: "", founded: "", venue: "" }, DEFAULT_CONTENT, 1);

describe("the content drafts on the server (M-20)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.writes = [];
    h.deletes = 0;
    h.refuse = false;
    localStorage.clear();
    resetContentDraftsForTests();
  });
  afterEach(() => vi.useRealTimers());

  it("a change shows at once and is written a moment later with rev + 1, by and byName", async () => {
    const { result } = renderHook(() => useContentDraftState(me));
    act(() => h.emit?.(undefined));
    act(() => result.current.update((d) => withIntro(d, "Hola")));
    expect(result.current.drafts.club.frase?.value.intro).toBe("Hola");
    expect(result.current.saving).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_WRITE_DELAY + 10);
    });
    expect(h.writes).toHaveLength(1);
    expect(h.writes[0]).toMatchObject({ rev: 0, by: "u1", byName: "jordi", at: "server-time" });
    expect(result.current.saving).toBe(false);
  });

  it("another captain's save under ours: «Otro capitán ha cambiado el borrador», ours stays until reload", async () => {
    const { result } = renderHook(() => useContentDraftState(me));
    act(() => h.emit?.({ rev: 3, club: {}, stories: {}, by: "u2", byName: "adrian" }));
    h.refuse = true;
    act(() => result.current.update((d) => withIntro(d, "La mía")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_WRITE_DELAY + 10);
    });
    expect(result.current.conflict).toBe(true);
    expect(result.current.drafts.club.frase?.value.intro).toBe("La mía");
    act(() => result.current.reload());
    expect(result.current.conflict).toBe(false);
    expect(result.current.drafts).toEqual(NO_DRAFTS);
  });

  it("emptying the draft deletes the doc", async () => {
    const { result } = renderHook(() => useContentDraftState(me));
    act(() => h.emit?.({ rev: 0, club: { frase: { value: { intro: "x" }, base: { intro: "" }, at: 1 } }, stories: {}, by: "u1" }));
    act(() => result.current.update(() => NO_DRAFTS));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_WRITE_DELAY + 10);
    });
    expect(h.deletes).toBe(1);
  });

  it("a draft left in this browser's localStorage from before is moved up once", async () => {
    localStorage.setItem("mp.admin.contentDrafts.v1:u1", JSON.stringify(withIntro(NO_DRAFTS, "De antes")));
    renderHook(() => useContentDraftState(me));
    act(() => h.emit?.(undefined));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_WRITE_DELAY + 10);
    });
    expect(h.writes).toHaveLength(1);
    expect(JSON.stringify(h.writes[0].club)).toContain("De antes");
    expect(localStorage.getItem("mp.admin.contentDrafts.v1:u1")).toBeNull();
  });
});
