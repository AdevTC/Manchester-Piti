import { describe, expect, it } from "vitest";
import { longSeasonFixture } from "../../../lib/derived/vidrio/fixtures";
import { seasonStrip } from "../../../lib/derived/vidrio/strip";
import { focusOf, keyEvents, ourLine, seasonOf, simulate, stretches, tableOf, type PMatch } from "./season";
import { presetPicks, winSizeFor } from "./views";
import { rivalLogos } from "../../../lib/derived/rivalLogo";

const F = longSeasonFixture();
const at = (now: number) => seasonOf({ segments: seasonStrip(F.matches, F.seasonId, now).segments, now, liveMinute: 23, mvpOf: () => null });
const DAY = 86_400_000;

describe("the season the PA- screens read", () => {
  it("states, the live jornada and the open ones (two postponed)", () => {
    const se = at(F.now);
    expect(se.matches).toHaveLength(26);
    expect(se.live?.j).toBe(17);
    expect(se.live?.score).toEqual({ gf: 2, ga: 1 });
    expect(se.matches.filter((m) => m.state === "aplazado").map((m) => m.j)).toEqual([9, 20]);
    expect(se.open).toHaveLength(10);
    expect(se.focus?.j).toBe(17);
  });

  it("every meeting with a rival carries the escudo an acta saved, the ones still to play too", () => {
    const j17 = F.matches.find((x) => x.id === "j17")!;
    const matches = F.matches.map((m) => (m.id === "j17" ? { ...m, rivalLogoUrl: "https://piti.test/escudos/x.jpg" } : m));
    const se = seasonOf({ segments: seasonStrip(matches, F.seasonId, F.now).segments, now: F.now, liveMinute: 23, mvpOf: () => null, logos: rivalLogos(matches) });
    const theirs = se.matches.filter((m) => m.rival === j17.rival);
    expect(theirs.length).toBeGreaterThan(1);
    expect(theirs.every((m) => m.logo === "https://piti.test/escudos/x.jpg")).toBe(true);
    expect(se.matches.filter((m) => m.rival !== j17.rival).every((m) => m.logo === undefined)).toBe(true);
  });

  it("the focus: the acta of the last jornada stays in front until the day before the next one", () => {
    const m = (j: number, state: PMatch["state"], at: number) => ({ j, state, at }) as PMatch;
    const now = Date.UTC(2026, 9, 22, 11);
    const played = m(1, "jugado", now - 4 * DAY);
    const next = m(2, "proximo", now + 3 * DAY);
    expect(focusOf([played, next], null, next, now)?.j).toBe(1);
    expect(focusOf([played, next], null, next, now + 2 * DAY)?.j).toBe(2);
  });

  it("key events in minute order, goals with their assist", () => {
    const j17 = F.matches.find((x) => x.id === "j17")!;
    const ev = keyEvents(j17);
    expect(ev.map((e) => e.min)).toEqual([...ev.map((e) => e.min)].sort((a, b) => a - b));
    expect(ev.filter((e) => e.k === "g")).toHaveLength(2);
  });

  it("the table: «si acaba así» moves our row and the rival's, «¿y si…?» only ours", () => {
    const se = at(F.now);
    const pub = tableOf(F.standings, 16, se, false)!;
    const now = tableOf(F.standings, 16, se, true)!;
    const us = (rows: typeof pub) => rows.find((r) => r.us)!;
    expect(us(now).pts).toBe(us(pub).pts + 3);
    expect(us(now).prov).toBe(true);
    expect(now.find((r) => r.team === "Orduña fc")?.prov).toBe(true);
    const sim = simulate(now, presetPicks(se, "g"));
    expect(us(sim).pts).toBe(us(now).pts + 3 * se.open.length);
    expect(sim.filter((r) => r.sim)).toHaveLength(1);
    expect(ourLine(se.matches, false).pj).toBe(us(pub).pj);
  });

  it("goals by five-minute stretch and the ribbon's window per width", () => {
    const s = stretches(at(F.now).played);
    expect(s.us).toHaveLength(10);
    expect([winSizeFor(390), winSizeFor(820), winSizeFor(1440), winSizeFor(1920)]).toEqual([99, 6, 7, 10]);
  });
});
