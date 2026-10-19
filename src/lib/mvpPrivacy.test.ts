// MVP privacy: while the vote is open nothing public says who is ahead (functions/src/mvpLogic.ts writes
// only the turnout; the app's mapper never yields counts from an open doc, whatever it holds).
import { describe, expect, it } from "vitest";
import { mvpCloseDue, mvpDoc, tallyVotes } from "../../functions/src/mvpLogic";
import { mapMvp, mvpPrivateWhileOpen } from "./firestoreMappers";

const ledger = { a: { played: true }, b: { played: true }, c: { played: false } };
const votes = [{ playerId: "a" }, { playerId: "a" }, { playerId: "b" }, { playerId: "c" }, { playerId: 7 }];

describe("mvpLogic", () => {
  it("counts the valid votes only (someone who played)", () => {
    expect(tallyVotes(ledger, votes)).toEqual({ counts: { a: 2, b: 1 }, total: 3 });
    expect(tallyVotes(undefined, votes)).toEqual({ counts: {}, total: 0 });
  });
  it("open: the turnout only; closed: the counts", () => {
    const t = tallyVotes(ledger, votes);
    const open = mvpDoc(t, 2_000, 1_000, 14);
    expect(open).toEqual({ total: 3, eligible: 14, open: true });
    expect("counts" in open).toBe(false);
    expect(mvpDoc(t, 2_000, 2_000, 14)).toEqual({ counts: { a: 2, b: 1 }, total: 3, eligible: 14, open: false });
    // no vote window (a match not played): nothing open
    expect(mvpDoc(t, null, 1_000, undefined)).toEqual({ counts: { a: 2, b: 1 }, total: 3, eligible: 0, open: false });
  });
  it("a closed vote still in its open shape is owed its counts", () => {
    expect(mvpCloseDue({ total: 3, eligible: 14, open: true }, 2_000, 2_500)).toBe(true);
    // an older doc without the flag already holds its counts (maybe a historical import): left as it is
    expect(mvpCloseDue({ total: 3, counts: { a: 3 } }, 2_000, 2_500)).toBe(false);
    expect(mvpCloseDue({ counts: { a: 1 }, total: 1, open: false }, 2_000, 2_500)).toBe(false);
    expect(mvpCloseDue({ total: 3, open: true }, 2_000, 1_500)).toBe(false);
    expect(mvpCloseDue(undefined, 2_000, 2_500)).toBe(true);
    expect(mvpCloseDue(undefined, undefined, 2_500)).toBe(false);
  });
});

describe("mvpPrivateWhileOpen (the page's and the server render's second lock)", () => {
  it("hides an older doc's counts while its match's vote is open; a closed one keeps them", () => {
    const old = { id: "m1", counts: { a: 2 }, total: 2 };
    const done = { id: "m2", counts: { b: 1 }, total: 1, open: false };
    const out = mvpPrivateWhileOpen([old, done], [{ id: "m1", voteClosesAt: 5_000 }, { id: "m2", voteClosesAt: 1_000 }], 2_000);
    expect(out).toEqual([{ id: "m1", counts: {}, total: 2, open: true }, done]);
  });
});

describe("mapMvp", () => {
  it("never yields counts from an open doc", () => {
    expect(mapMvp("m1", { total: 3, eligible: 14, open: true, counts: { a: 2 } })).toEqual({ id: "m1", counts: {}, total: 3, eligible: 14, open: true });
  });
  it("reads a closed doc and an older one without the flag", () => {
    expect(mapMvp("m1", { counts: { a: 2, b: "x" }, total: 2, eligible: 14, open: false })).toEqual({ id: "m1", counts: { a: 2 }, total: 2, eligible: 14, open: false });
    expect(mapMvp("m2", { counts: { a: 1 }, total: 1 })).toEqual({ id: "m2", counts: { a: 1 }, total: 1 });
    expect(mapMvp("m3", undefined)).toEqual({ id: "m3", counts: {}, total: 0 });
  });
});
