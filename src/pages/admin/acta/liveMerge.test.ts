import { describe, expect, it } from "vitest";
import { liveConflicts, mergeLive, newLiveEvents, removedIds } from "./liveMerge";
import { defaultSheet, type MatchEvent, type MatchSheet } from "./sheetModel";

// M4: an acta edited while the touchline keeps writing. Live jugadas are append-only with unique
// `live-*` ids; the merge takes them in by id without touching the editor's own changes.
const ev = (id: string, minute: number, extra: Partial<MatchEvent> = {}): MatchEvent => ({ id, type: "goal", minute, playerId: "erik", ...extra });
const sheet = (events: MatchEvent[], extra: Partial<MatchSheet> = {}): MatchSheet => defaultSheet("t1", { rival: "Rival", date: 1, events, revision: 3, ...extra });

const A = ev("live-a", 5);
const B = ev("live-b", 9, { type: "yellow_card", playerId: "pablo" });
const C = ev("live-c", 14);
const D = ev("live-d", 20, { type: "opponent_goal", playerId: undefined });

describe("newLiveEvents", () => {
  it("counts the server's live jugadas the editor hasn't got, nor removed", () => {
    const base = sheet([A, B]);
    const local = sheet([A, { ...B, minute: 10 }, ev("mine", 30)]);
    const server = sheet([A, B, C, D, ev("other", 40)], { revision: 5 });
    expect(newLiveEvents(local, base, server, new Set()).map((e) => e.id)).toEqual(["live-c", "live-d"]);
    expect(newLiveEvents(local, base, server, new Set(["live-d"])).map((e) => e.id)).toEqual(["live-c"]);
    expect(newLiveEvents(local, base, base, new Set())).toEqual([]);
  });

  it("an event removed in the editor isn't new, even after a saved draft made the edits the base", () => {
    const base = sheet([A]); // the saved draft: B already removed
    const server = sheet([A, B, C], { revision: 6 }); // the live match still has B
    expect(newLiveEvents(base, base, server, new Set(["live-b"])).map((e) => e.id)).toEqual(["live-c"]);
  });
});

describe("mergeLive", () => {
  it("keeps every local edit, appends the new jugadas and takes the server's revision", () => {
    const base = sheet([A, B], { report: "", venue: "Campo" });
    const local = sheet([{ ...A, assistPlayerId: "raul" }, ev("mine", 30)], { report: "Partidazo", venue: "Campo" }); // B removed here
    const server = sheet([A, B, C, D], { revision: 7, report: "", venue: "Campo" });
    const merged = mergeLive(local, base, server, new Set(["live-b"]));
    expect(merged.events.map((e) => e.id)).toEqual(["live-a", "mine", "live-c", "live-d"]);
    expect(merged.events[0].assistPlayerId).toBe("raul");
    expect(merged.report).toBe("Partidazo");
    expect(merged.revision).toBe(7);
  });

  it("an event removed in the editor never comes back (also without the removed set: it was in the base)", () => {
    const base = sheet([A, B]);
    const local = sheet([A]);
    const server = sheet([A, B, C], { revision: 4 });
    expect(mergeLive(local, base, server, new Set()).events.map((e) => e.id)).toEqual(["live-a", "live-c"]);
  });

  it("follows the server for what the editor didn't touch: an undone jugada goes, the clock and fields come", () => {
    const base = sheet([A, B], { duration: 50 });
    const local = sheet([A, { ...B, minute: 11 }], { duration: 50, report: "Mío" });
    const server = sheet([A, C], { revision: 9, duration: 52, durationSeconds: 3100, clock: { phase: "second", revision: 4 } as unknown as MatchSheet["clock"] });
    const merged = mergeLive(local, base, server, new Set());
    // B was edited here: the edit stays even though the touchline undid it; A untouched follows the server
    expect(merged.events.map((e) => e.id)).toEqual(["live-a", "live-b", "live-c"]);
    expect(merged.duration).toBe(52);
    expect(merged.durationSeconds).toBe(3100);
    expect(merged.clock).toEqual({ phase: "second", revision: 4 });
    expect(merged.report).toBe("Mío");
    // …but the touchline undid the jugada edited here: a conflict, so the edits keep their own revision
    // and saveMatchSheet refuses them instead of silently bringing B back
    expect(merged.revision).toBe(3);

    const untouched = mergeLive(sheet([A, B], { report: "Mío" }), base, server, new Set());
    expect(untouched.events.map((e) => e.id)).toEqual(["live-a", "live-c"]);
    expect(untouched.revision).toBe(9);
  });

  it("a field changed on both sides is a conflict: the editor's value, its own revision (the save is refused)", () => {
    const base = sheet([], { venue: "Campo" });
    const merged = mergeLive(sheet([], { venue: "Mío" }), base, sheet([], { venue: "Suyo", revision: 8 }), new Set());
    expect(merged.venue).toBe("Mío");
    expect(merged.revision).toBe(3);
    // the same change on both sides is no conflict
    expect(mergeLive(sheet([], { venue: "Suyo" }), base, sheet([], { venue: "Suyo", revision: 8 }), new Set()).revision).toBe(8);
  });

  it("an edited jugada the touchline undid: the edit stays, the new ones arrive, the revision doesn't move", () => {
    const base = sheet([A, B]);
    const local = sheet([A, { ...B, playerId: "raul" }]);
    const server = sheet([A, C], { revision: 5 });
    const merged = mergeLive(local, base, server, new Set());
    expect(merged.events.map((e) => e.id)).toEqual(["live-a", "live-b", "live-c"]);
    expect(merged.revision).toBe(3);
  });
});

describe("liveConflicts", () => {
  const base = sheet([A, B], { venue: "Campo" });
  it("new jugadas and server changes to what the editor didn't touch are no conflict", () => {
    expect(liveConflicts(sheet([A, B], { venue: "Mío" }), base, sheet([A, B, C], { venue: "Campo" }))).toBe(false);
    expect(liveConflicts(sheet([A], { venue: "Campo" }), base, sheet([A, C], { venue: "Campo" }))).toBe(false); // both dropped B
    expect(liveConflicts(sheet([A, B]), base, sheet([A, B], { duration: 55 }))).toBe(false);
  });
  it("the same field or jugada changed on both sides is", () => {
    expect(liveConflicts(sheet([A, B], { venue: "Mío" }), base, sheet([A, B], { venue: "Suyo" }))).toBe(true);
    expect(liveConflicts(sheet([{ ...A, minute: 6 }, B], { venue: "Campo" }), base, sheet([{ ...A, minute: 7 }, B], { venue: "Campo" }))).toBe(true);
    expect(liveConflicts(sheet([{ ...A, minute: 6 }, B], { venue: "Campo" }), base, sheet([B], { venue: "Campo" }))).toBe(true); // undone there
    expect(liveConflicts(sheet([B], { venue: "Campo" }), base, sheet([{ ...A, minute: 7 }, B], { venue: "Campo" }))).toBe(true); // removed here, changed there
  });
});

describe("removedIds", () => {
  it("adds what the edits dropped, forgets what came back, and keeps its identity when nothing changed", () => {
    const one = removedIds(new Set(), [A, B, C], [A, C]);
    expect([...one]).toEqual(["live-b"]);
    expect(removedIds(one, [A, C], [A, C])).toBe(one);
    expect([...removedIds(one, [A, C], [A, B, C])]).toEqual([]);
  });
});
