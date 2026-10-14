import { describe, expect, it } from "vitest";
import { kickoffWindow, mvpCandidates, mvpVoteOpen } from "./memberWindows";

// The windows firestore.rules enforces: upcoming() (availability, predictions) and mvpOpen() (votes).
const NOW = Date.UTC(2026, 9, 14, 18);

describe("kickoffWindow (convocatoria and porra)", () => {
  it("open for a scheduled match before its date", () => {
    expect(kickoffWindow({ status: "scheduled", date: NOW + 60_000 }, NOW)).toBe("open");
    // (a Firestore timestamp or an ISO string date too)
    expect(kickoffWindow({ status: "scheduled", date: { seconds: (NOW + 3_600_000) / 1000 } }, NOW)).toBe("open");
    expect(kickoffWindow({ status: "scheduled", date: new Date(NOW + 1).toISOString() }, NOW)).toBe("open");
  });
  it("closed from its date on, even while nobody has started the clock", () => {
    expect(kickoffWindow({ status: "scheduled", date: NOW }, NOW)).toBe("closed");
    expect(kickoffWindow({ status: "scheduled", date: NOW - 1 }, NOW)).toBe("closed");
  });
  it("closed for any match that is not scheduled (live, finished, called off, legacy without status)", () => {
    for (const status of ["live", "finished", "cancelled", "postponed", undefined]) expect(kickoffWindow({ status, date: NOW + 86_400_000 }, NOW)).toBe("closed");
  });
  it("undated while the match has no date", () => {
    expect(kickoffWindow({ status: "scheduled" }, NOW)).toBe("undated");
    expect(kickoffWindow({ status: "scheduled", date: "por confirmar" }, NOW)).toBe("undated");
  });
});

describe("mvpVoteOpen", () => {
  it("a finished match inside its window", () => {
    expect(mvpVoteOpen({ status: "finished", voteClosesAt: NOW + 1 }, NOW)).toBe(true);
  });
  it("closed at the deadline, without one, or before the match is finished", () => {
    expect(mvpVoteOpen({ status: "finished", voteClosesAt: NOW }, NOW)).toBe(false);
    expect(mvpVoteOpen({ status: "finished" }, NOW)).toBe(false);
    expect(mvpVoteOpen({ status: "finished", voteClosesAt: null }, NOW)).toBe(false);
    expect(mvpVoteOpen({ status: "scheduled", voteClosesAt: NOW + 1 }, NOW)).toBe(false);
  });
});

describe("mvpCandidates", () => {
  const name = (id: string) => id.toUpperCase();
  it("only who played, most voted first, then by name", () => {
    const ledger = { raul: { played: true }, adri: { played: true }, erik: { played: true }, hugo: { played: false }, pablo: {} };
    expect(mvpCandidates(ledger, { erik: 2, raul: 2, adri: 1 }, name)).toEqual(["erik", "raul", "adri"]);
    expect(mvpCandidates(ledger, undefined, name)).toEqual(["adri", "erik", "raul"]);
  });
  it("no ledger, nobody", () => {
    expect(mvpCandidates(undefined, undefined, name)).toEqual([]);
  });
});
