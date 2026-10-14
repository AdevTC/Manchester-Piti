import { describe, expect, it } from "vitest";
import { boardCovers, parseSiete, SIETE_WINDOW_MS, sieteKey, sieteLog, sieteStep, type SieteClaim } from "../../functions/src/pushLogic";

// One «siete» per match: «Ya está el siete» (the pizarra's official) and the convocatoria's notice never
// both tell the team the same seven within 10 minutes.
const NOW = Date.UTC(2026, 9, 14, 18, 0);
const S = sieteKey(["a", "b", "c", "d", "e", "f", "g"]);
const OTHER = sieteKey(["a", "b", "c", "d", "e", "f", "h"]);
const sentBy = (by: "lineup" | "conv", at = NOW - 60_000, seven = S, board: string | null = by === "lineup" ? "B" : null): SieteClaim => ({ at, by, seven, board, sent: true });
const reserved = (at = NOW - 5_000, board = "B"): SieteClaim => ({ at, by: "lineup", seven: S, board, sent: false });

describe("the siete key and its pushLog", () => {
  it("compares who, not the order (and never empty or repeated ids)", () => {
    expect(sieteKey(["g", "a", "c"])).toBe(sieteKey(["a", "c", "g"]));
    expect(sieteKey(["a", "", null, "a", 3, "b"])).toBe("a,b");
    expect(sieteKey(undefined)).toBe("");
    expect(sieteLog("m8")).toBe("siete-m8");
  });
  it("reads a stored claim back (malformed = none; sent unless it says it isn't)", () => {
    expect(parseSiete({ at: 1, by: "conv", seven: "a" })).toEqual({ at: 1, by: "conv", seven: "a", board: null, sent: true });
    expect(parseSiete({ at: 1, by: "lineup", seven: "a", board: "B", sent: false })?.sent).toBe(false);
    expect(parseSiete({ at: "1", by: "conv", seven: "a" })).toBeNull();
    expect(parseSiete({ at: 1, by: "otro", seven: "a" })).toBeNull();
    expect(parseSiete(undefined)).toBeNull();
  });
});

describe("«Ya está el siete» (pushOnLineup)", () => {
  it("goes when nobody told this seven, and claims it", () => {
    expect(sieteStep(null, { by: "lineup", board: "B", seven: S }, NOW)).toEqual({ send: true, write: { at: NOW, by: "lineup", seven: S, board: "B", sent: true } });
  });
  it("stays quiet after the convocatoria told the same seven within the window", () => {
    expect(sieteStep(sentBy("conv"), { by: "lineup", board: "B", seven: S }, NOW)).toEqual({ send: false, write: null });
  });
  it("goes for another seven, or once the window is over", () => {
    expect(sieteStep(sentBy("conv", NOW - 60_000, OTHER), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
    expect(sieteStep(sentBy("conv", NOW - SIETE_WINDOW_MS), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
  });
  it("goes when the convocatoria reserved it for this board (and marks it sent, keeping its time)", () => {
    const r = reserved();
    expect(sieteStep(r, { by: "lineup", board: "B", seven: OTHER }, NOW)).toEqual({ send: true, write: { ...r, sent: true } });
  });
  it("a claim from the future (a reset clock) counts as none", () => {
    expect(sieteStep(sentBy("conv", NOW + 60_000), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
  });
});

describe("the convocatoria's notice (setConvocatoria, the legacy trigger)", () => {
  it("goes when nobody told this seven, and claims it", () => {
    expect(sieteStep(null, { by: "conv", seven: S }, NOW)).toEqual({ send: true, write: { at: NOW, by: "conv", seven: S, sent: true } });
  });
  it("is covered by «Ya está el siete» of the same seven within the window — sent or about to go", () => {
    expect(sieteStep(sentBy("lineup"), { by: "conv", seven: S }, NOW)).toEqual({ send: false, write: null });
    expect(sieteStep(reserved(), { by: "conv", seven: S }, NOW)).toEqual({ send: false, write: null });
  });
  it("goes for another seven, or after the window", () => {
    expect(sieteStep(sentBy("lineup"), { by: "conv", seven: OTHER }, NOW).send).toBe(true);
    expect(sieteStep(sentBy("lineup", NOW - SIETE_WINDOW_MS - 1), { by: "conv", seven: S }, NOW).send).toBe(true);
  });
});

describe("«Usar este siete como convocatoria» (reserve)", () => {
  it("never sends: it reserves the claim for the board's notice", () => {
    expect(sieteStep(null, { by: "reserve", board: "B", seven: S }, NOW)).toEqual({ send: false, write: { at: NOW, by: "lineup", seven: S, board: "B", sent: false } });
  });
  it("the board's notice already went (the trigger ran first): left as it is", () => {
    expect(sieteStep(sentBy("lineup"), { by: "reserve", board: "B", seven: S }, NOW)).toEqual({ send: false, write: null });
  });
  it("the same seven was just told by the convocatoria: left as it is (the board's notice stays quiet too)", () => {
    expect(sieteStep(sentBy("conv"), { by: "reserve", board: "B", seven: S }, NOW)).toEqual({ send: false, write: null });
  });
  it("either order ends in one notice", () => {
    // trigger first, then the call
    const t1 = sieteStep(null, { by: "lineup", board: "B", seven: S }, NOW);
    const c1 = sieteStep(t1.write, { by: "reserve", board: "B", seven: S }, NOW + 1000);
    expect([t1.send, c1.send]).toEqual([true, false]);
    // the call first, then the trigger
    const c2 = sieteStep(null, { by: "reserve", board: "B", seven: S }, NOW);
    const t2 = sieteStep(c2.write, { by: "lineup", board: "B", seven: S }, NOW + 1000);
    expect([c2.send, t2.send]).toEqual([false, true]);
    // and a later «Convocar y avisar» of that seven stays quiet
    expect(sieteStep(t2.write, { by: "conv", seven: S }, NOW + 120_000).send).toBe(false);
  });
});

describe("boardCovers: the official just published tells the convocatoria", () => {
  const base = {
    board: { isOfficial: true, matchId: "m8" },
    lock: { lineupId: "B", at: NOW - 3_000 },
    boardId: "B",
    matchId: "m8",
    lineupLoggedAt: null as number | null,
    now: NOW,
  };
  it("covers while its notice is still to go or has just gone", () => {
    expect(boardCovers(base)).toBe(true);
    expect(boardCovers({ ...base, lineupLoggedAt: NOW - 2_000 })).toBe(true);
  });
  it("not when its notice went long ago (it won't go again)", () => {
    expect(boardCovers({ ...base, lineupLoggedAt: NOW - SIETE_WINDOW_MS - 1 })).toBe(false);
  });
  it("not when it isn't this match's official, or wasn't published just now", () => {
    expect(boardCovers({ ...base, board: { isOfficial: false, matchId: "m8" } })).toBe(false);
    expect(boardCovers({ ...base, board: { isOfficial: true, matchId: null } })).toBe(false);
    expect(boardCovers({ ...base, board: null })).toBe(false);
    expect(boardCovers({ ...base, lock: { lineupId: "OTRO", at: NOW } })).toBe(false);
    expect(boardCovers({ ...base, lock: { lineupId: "B", at: NOW - SIETE_WINDOW_MS } })).toBe(false);
    expect(boardCovers({ ...base, lock: { lineupId: "B", at: null } })).toBe(false);
    expect(boardCovers({ ...base, lock: null })).toBe(false);
  });
});
