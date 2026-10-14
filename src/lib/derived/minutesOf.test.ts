import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../clubData";
import { minutesOf, presenceMinutes, timedGames, totalMinutes } from "./minutesOf";

const row = (minutes: number, extra: Partial<Participation> = {}) => ({ played: minutes > 0, minutes, ...extra }) as Participation;
const m = (o: Partial<ClubMatch>): ClubMatch => ({ id: "m", status: "finished", duration: 50, ...o });

describe("minutesOf: the one minutes rule", () => {
  it("a ledger row: its minutes (two decimals); a row that did not play: 0", () => {
    const acta = m({ ledger: { ana: row(33.33, { secondsPlayed: 2000 }), bea: row(0, { benched: true }) } });
    expect(minutesOf(acta, "ana")).toBe(33.33);
    expect(minutesOf(acta, "bea")).toBe(0);
  });

  it("a legacy acta (no ledger) never invents minutes: unknown (null) if he played, a known 0 if he did not", () => {
    const acta = m({ duration: 60, starters: ["ana"], events: [{ id: "e1", type: "match_played", playerId: "ana" }, { id: "e2", type: "goal", playerId: "bea", assistPlayerId: "cris" }] });
    expect(minutesOf(acta, "ana")).toBeNull();
    expect(minutesOf(acta, "bea")).toBeNull();
    expect(minutesOf(acta, "cris")).toBeNull();
    expect(minutesOf(acta, "dani")).toBe(0);
    expect(minutesOf({ ...acta, ledger: {} }, "ana")).toBeNull();
  });

  it("a match that is not finished (cancelled, scheduled, postponed) counts nothing", () => {
    for (const status of ["cancelled", "scheduled", "postponed"] as const) {
      expect(minutesOf(m({ status, events: [{ id: "e", type: "match_played", playerId: "ana" }] }), "ana")).toBe(0);
      expect(minutesOf(m({ status, ledger: { ana: row(40) } }), "ana")).toBe(0);
    }
  });

  it("totals add the known minutes only (exact seconds where kept); with no ledger row behind them they print «—»", () => {
    const a = m({ id: "a", ledger: { ana: row(33.33, { secondsPlayed: 2000 }) } });
    const b = m({ id: "b", ledger: { ana: row(33.33, { secondsPlayed: 2000 }) } });
    const legacy = m({ id: "c", events: [{ id: "e", type: "match_played", playerId: "ana" }] });
    expect(totalMinutes([a, b, legacy], "ana")).toBe(66.67);
    expect(timedGames([a, b, legacy], "ana")).toBe(2);
    expect(totalMinutes([legacy], "ana")).toBe(0);
    expect(timedGames([legacy], "ana")).toBe(0);
    expect(timedGames([m({ status: "cancelled", ledger: { ana: row(40) } })], "ana")).toBe(0);
  });

  it("presenceMinutes (internal to the form rating, never printed): the known minutes, else the whole match if he played", () => {
    const legacy = m({ duration: 60, events: [{ id: "e", type: "match_played", playerId: "ana" }] });
    expect(presenceMinutes(legacy, "ana", true)).toBe(60);
    expect(presenceMinutes(legacy, "bea", false)).toBe(0);
    expect(presenceMinutes(m({ ledger: { ana: row(20) } }), "ana", true)).toBe(20);
  });
});
