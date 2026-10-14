import { describe, expect, it } from "vitest";
import { boardNotice, parseSiete, SIETE_WINDOW_MS, sieteKey, sieteLog, sieteMayCover, sieteStep, type SieteClaim } from "../../functions/src/pushLogic";

// One «siete» per match: «Ya está el siete» (the pizarra's official) and the convocatoria's notice never both
// tell the team the same seven within 10 minutes — and a convocatoria notice is only ever covered by
// «Ya está el siete», never by another convocatoria notice.
const NOW = Date.UTC(2026, 9, 14, 18, 0);
const S = sieteKey(["a", "b", "c", "d", "e", "f", "g"]);
const OTHER = sieteKey(["a", "b", "c", "d", "e", "f", "h"]);
const sentBy = (by: "lineup" | "conv", at = NOW - 60_000, seven = S, board: string | null = by === "lineup" ? "B" : null): SieteClaim => ({ at, by, seven, board, sent: true });
const reserved = (at = NOW - 5_000, board = "B", seven = S): SieteClaim => ({ at, by: "lineup", seven, board, sent: false });
const asConv = (seven = S) => ({ send: true, write: { at: NOW, by: "conv", seven, sent: true }, coveredBy: null });
const quiet = (by: "lineup" | "conv") => ({ send: false, write: null, coveredBy: by });

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
    expect(sieteStep(null, { by: "lineup", board: "B", seven: S }, NOW)).toEqual({ send: true, write: { at: NOW, by: "lineup", seven: S, board: "B", sent: true }, coveredBy: null });
  });
  it("stays quiet after the convocatoria told the same seven within the window", () => {
    expect(sieteStep(sentBy("conv"), { by: "lineup", board: "B", seven: S }, NOW)).toEqual(quiet("conv"));
  });
  it("goes for another seven, or once the window is over", () => {
    expect(sieteStep(sentBy("conv", NOW - 60_000, OTHER), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
    expect(sieteStep(sentBy("conv", NOW - SIETE_WINDOW_MS), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
  });
  it("goes when the convocatoria reserved it for this board (and marks it sent, keeping its time)", () => {
    const r = reserved();
    expect(sieteStep(r, { by: "lineup", board: "B", seven: OTHER }, NOW)).toEqual({ send: true, write: { ...r, sent: true }, coveredBy: null });
  });
  it("a claim from the future (a reset clock) counts as none", () => {
    expect(sieteStep(sentBy("conv", NOW + 60_000), { by: "lineup", board: "B", seven: S }, NOW).send).toBe(true);
  });
});

describe("the convocatoria's notice (setConvocatoria, the legacy trigger)", () => {
  it("goes when nobody told this seven, and claims it", () => {
    expect(sieteStep(null, { by: "conv", seven: S }, NOW)).toEqual(asConv());
  });
  it("is covered by «Ya está el siete» of the same seven within the window — sent or about to go", () => {
    expect(sieteStep(sentBy("lineup"), { by: "conv", seven: S }, NOW)).toEqual(quiet("lineup"));
    expect(sieteStep(reserved(), { by: "conv", seven: S }, NOW)).toEqual(quiet("lineup"));
  });
  it("is never covered by another convocatoria notice, even of the same seven", () => {
    expect(sieteStep(sentBy("conv"), { by: "conv", seven: S }, NOW)).toEqual(asConv());
  });
  it("goes for another seven, or after the window", () => {
    expect(sieteStep(sentBy("lineup"), { by: "conv", seven: OTHER }, NOW)).toEqual(asConv(OTHER));
    expect(sieteStep(sentBy("lineup", NOW - SIETE_WINDOW_MS - 1), { by: "conv", seven: S }, NOW).send).toBe(true);
  });
});

describe("«Usar este siete como convocatoria» (reserve: the board's notice still to go)", () => {
  it("reserves the claim for the board's notice, and stays quiet", () => {
    expect(sieteStep(null, { by: "reserve", board: "B", seven: S }, NOW)).toEqual({ send: false, write: { at: NOW, by: "lineup", seven: S, board: "B", sent: false }, coveredBy: "lineup" });
    // another board's reservation or another seven told: ours replaces it
    expect(sieteStep(reserved(NOW - 5_000, "OTRO", OTHER), { by: "reserve", board: "B", seven: S }, NOW).write).toMatchObject({ board: "B", sent: false });
    expect(sieteStep(sentBy("conv", NOW - 60_000, OTHER), { by: "reserve", board: "B", seven: S }, NOW).write).toMatchObject({ board: "B", sent: false });
  });
  it("the board's notice of this seven already went (the trigger ran first), or its reservation stands: left as it is", () => {
    expect(sieteStep(sentBy("lineup"), { by: "reserve", board: "B", seven: S }, NOW)).toEqual(quiet("lineup"));
    expect(sieteStep(reserved(), { by: "reserve", board: "B", seven: S }, NOW)).toEqual(quiet("lineup"));
    // another board told this same seven a moment ago: quiet too
    expect(sieteStep(sentBy("lineup", NOW - 60_000, S, "OTRO"), { by: "reserve", board: "B", seven: S }, NOW)).toEqual(quiet("lineup"));
  });
  it("the board already told ANOTHER seven: the convocatoria tells this one", () => {
    expect(sieteStep(sentBy("lineup", NOW - 60_000, OTHER), { by: "reserve", board: "B", seven: S }, NOW)).toEqual(asConv());
  });
  it("a convocatoria notice told this very seven: it goes as a convocatoria notice (never covered by one)", () => {
    expect(sieteStep(sentBy("conv"), { by: "reserve", board: "B", seven: S }, NOW)).toEqual(asConv());
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

describe("sieteMayCover: only when the seven is all the convocatoria notice would tell", () => {
  const L = { starters: ["a", "b"], bench: ["c"] };
  it("the first notice: the seven is the news", () => {
    expect(sieteMayCover("first", L, null)).toBe(true);
  });
  it("«Cambios» that call the same players as announced (who starts changed): yes", () => {
    expect(sieteMayCover("changes", { starters: ["a", "c"], bench: ["b"] }, { starters: ["a", "b"], bench: ["c"] })).toBe(true);
  });
  it("«Cambios» that call someone new or leave someone out: no — that goes", () => {
    expect(sieteMayCover("changes", { starters: ["a", "b"], bench: ["c", "d"] }, { starters: ["a", "b"], bench: ["c"] })).toBe(false);
    expect(sieteMayCover("changes", { starters: ["a", "b"], bench: [] }, { starters: ["a", "b"], bench: ["c"] })).toBe(false);
  });
  it("what was announced is unknown (a notice from before): no", () => {
    expect(sieteMayCover("changes", L, null)).toBe(false);
    expect(sieteMayCover("changes", L, { starters: ["a", "b"] })).toBe(false);
  });
});

describe("boardNotice: where the official just published stands", () => {
  const base = {
    board: { isOfficial: true, matchId: "m8" },
    lock: { lineupId: "B", at: NOW - 3_000 },
    boardId: "B",
    matchId: "m8",
    lineupLoggedAt: null as number | null,
    now: NOW,
  };
  it("pending while its notice is still to go; sent when it went for this publish", () => {
    expect(boardNotice(base)).toBe("pending");
    expect(boardNotice({ ...base, lineupLoggedAt: NOW - 2_000 })).toBe("sent");
  });
  it("its notice claimed by an earlier publish (it won't go again for this one): none", () => {
    // republished minutes later: the claim is older than this publish
    expect(boardNotice({ ...base, lineupLoggedAt: NOW - 4_000 })).toBeNull();
    expect(boardNotice({ ...base, lineupLoggedAt: NOW - SIETE_WINDOW_MS - 1 })).toBeNull();
  });
  it("not this match's official, or not published just now: none", () => {
    expect(boardNotice({ ...base, board: { isOfficial: false, matchId: "m8" } })).toBeNull();
    expect(boardNotice({ ...base, board: { isOfficial: true, matchId: null } })).toBeNull();
    expect(boardNotice({ ...base, board: null })).toBeNull();
    expect(boardNotice({ ...base, lock: { lineupId: "OTRO", at: NOW } })).toBeNull();
    expect(boardNotice({ ...base, lock: { lineupId: "B", at: NOW - SIETE_WINDOW_MS } })).toBeNull();
    expect(boardNotice({ ...base, lock: { lineupId: "B", at: null } })).toBeNull();
    expect(boardNotice({ ...base, lock: null })).toBeNull();
  });
});
