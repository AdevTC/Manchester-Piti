import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { calendarRows, countdownParts, dateParts, lastEvent, liveMinute, resultOf, scoreOf, scorersLine, seasonView } from "./partidos";

const MIN = 60_000;
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 6, 20, 28);
const ev = (type: string, playerId?: string) => ({ id: Math.random().toString(), type, playerId }) as NonNullable<ClubMatch["events"]>[number];
const played = (id: string, daysAgo: number, gf: number, ga: number, events: ClubMatch["events"] = []): ClubMatch => ({ id, seasonId: "s1", rival: `Rival ${id}`, status: "finished", date: NOW - daysAgo * DAY, goalsFor: gf, goalsAgainst: ga, events });
const upcoming = (id: string, inDays: number, rival = `Rival ${id}`): ClubMatch => ({ id, seasonId: "s1", rival, status: "scheduled", date: NOW + inDays * DAY });
const names: Record<string, string> = { a: "ADRIÁN T.C.", e: "ERIK", h: "HUBEROSKI" };
const nameOf = (id: string) => names[id] ?? "?";

describe("score and result", () => {
  it("uses the stored score once finished", () => {
    expect(scoreOf(played("m", 1, 3, 1))).toEqual({ gf: 3, ga: 1 });
    expect(resultOf(played("m", 1, 2, 2))).toBe("E");
  });
  it("counts the acta while the score isn't stored yet (live)", () => {
    const live: ClubMatch = { id: "l", seasonId: "s1", events: [ev("goal", "e"), ev("opponent_goal"), ev("goal_penalty", "a"), ev("own_goal", "h"), ev("opponent_own_goal"), ev("yellow_card", "h")] };
    expect(scoreOf(live)).toEqual({ gf: 3, ga: 2 });
  });
});

describe("scorersLine", () => {
  it("groups by player, most goals first, and adds own goals by the rival", () => {
    expect(scorersLine([ev("goal", "h"), ev("goal", "a"), ev("goal_freekick", "a"), ev("opponent_own_goal"), ev("opponent_goal")], nameOf)).toBe("ADRIÁN T.C. ×2, HUBEROSKI, autogol rival");
    expect(scorersLine([], nameOf)).toBe("");
  });
});

describe("seasonView", () => {
  it("tells played, live and next, with jornadas by date and the season numbers", () => {
    const liveMatch: ClubMatch = { id: "l", seasonId: "s1", rival: "MAD SKY", status: "scheduled", date: NOW - 20 * MIN, events: [ev("goal", "e")] };
    const v = seasonView([upcoming("n", 7), played("b", 7, 1, 4), played("a", 14, 3, 2), liveMatch, upcoming("x", 1, "Otra temporada")].map((m) => (m.id === "x" ? { ...m, seasonId: "s0" } : m)), "s1", NOW);
    expect(v.tiles.map((t) => [t.j, t.id, t.state, t.result])).toEqual([[1, "a", "played", "G"], [2, "b", "played", "P"], [3, "l", "live", undefined], [4, "n", "next", undefined]]);
    expect(v.live?.id).toBe("l");
    expect(v.next?.id).toBe("n");
    expect([v.wins, v.draws, v.losses, v.gf, v.ga]).toEqual([1, 0, 1, 4, 6]);
    expect(v.jornada.get("n")).toBe(4);
  });
  it("pre-season: nothing played, nothing next", () => {
    const v = seasonView([], "s1", NOW);
    expect([v.tiles.length, v.live, v.next, v.gf]).toEqual([0, undefined, undefined, 0]);
  });
  it("leaves cancelled matches out of the strip", () => {
    expect(seasonView([{ ...upcoming("c", 3), status: "cancelled" }], "s1", NOW).tiles).toEqual([]);
  });
});

describe("calendarRows", () => {
  const ms = [played("old", 20, 1, 0), played("new", 6, 2, 1), upcoming("far", 14, "MAD SKY"), upcoming("soon", 2, "EL CUARTEL CF")];
  it("upcoming first (soonest first), then results (latest first)", () => {
    expect(calendarRows(ms, "all", "", NOW).map((m) => m.id)).toEqual(["soon", "far", "new", "old"]);
  });
  it("filters by phase and by rival, ignoring case", () => {
    expect(calendarRows(ms, "next", "", NOW).map((m) => m.id)).toEqual(["soon", "far"]);
    expect(calendarRows(ms, "results", "", NOW).map((m) => m.id)).toEqual(["new", "old"]);
    expect(calendarRows(ms, "all", "mad", NOW).map((m) => m.id)).toEqual(["far"]);
  });
});

describe("time helpers", () => {
  it("countdown in two-digit parts, zero once passed", () => {
    expect(countdownParts(NOW + 2 * DAY + 14 * 3600_000 + 32 * MIN + 17_000, NOW)).toEqual({ d: "02", h: "14", m: "32", s: "17", done: false });
    expect(countdownParts(NOW - 1, NOW)).toMatchObject({ d: "00", s: "00", done: true });
  });
  it("live minute from the kickoff, capped at the duration", () => {
    expect(liveMinute({ date: NOW - 18.5 * MIN }, NOW)).toBe(19);
    expect(liveMinute({ date: NOW - 70 * MIN, duration: 50 }, NOW)).toBe(50);
    expect(liveMinute({ date: NOW + MIN }, NOW)).toBeNull();
  });
  it("date pieces in Madrid time", () => {
    expect(dateParts(Date.UTC(2026, 10, 8, 11))).toEqual({ wd: "DOM", day: "8", mon: "NOV", time: "12:00", long: "domingo, 8 nov" });
    expect(dateParts(undefined).long).toBe("Fecha por confirmar");
  });
});

describe("lastEvent", () => {
  it("the latest event by minute, named; rival goals carry the rival's name", () => {
    const e = (type: string, minute: number, playerId?: string) => ({ id: String(minute), type, minute, playerId }) as NonNullable<ClubMatch["events"]>[number];
    expect(lastEvent([e("goal", 19, "e"), e("opponent_goal", 6)], nameOf, "MAD SKY")).toEqual({ minute: 19, who: "ERIK", label: "Gol", goal: true });
    expect(lastEvent([e("goal", 19, "e"), e("opponent_goal", 31)], nameOf, "MAD SKY")).toMatchObject({ who: "MAD SKY", goal: false });
    expect(lastEvent([], nameOf, "X")).toBeNull();
  });
});
