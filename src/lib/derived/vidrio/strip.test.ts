import { describe, expect, it } from "vitest";
import { readyClock, transitionClock } from "../../../../functions/src/matchClock";
import type { ClubMatch } from "../../clubData";
import { longSeasonFixture, madridMs } from "./fixtures";
import { filterStrip, lightAt, pageWindow, searchRival, seasonStrip, stripStateOf, windowAround, windowAt } from "./strip";

const MIN = 60_000;
const HOUR = 60 * MIN;
const ts = (ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0 });

// the real season of today: 7 teams, 6 jornadas, the debut tonight (Sunday 18 Oct 2026, 19:00)
const KO = madridMs(2026, 10, 18, 19);
const realBase: ClubMatch = { id: "r1", seasonId: "t1", version: 2, status: "scheduled", rival: "Orduña fc", date: ts(KO), duration: 50, home: true, clock: readyClock(), events: [] };
const REAL: ClubMatch[] = [
  realBase,
  { ...realBase, id: "r2", rival: "Pitutis", date: ts(madridMs(2026, 10, 25, 14)), home: false },
  { ...realBase, id: "r3", rival: "Red Demons", date: ts(madridMs(2026, 11, 8, 18)) },
  { ...realBase, id: "r4", rival: "Sporting de Brugal", date: ts(madridMs(2026, 11, 15, 16)), home: false },
  { ...realBase, id: "r5", rival: "SQUIRTLES FC", date: ts(madridMs(2026, 11, 22, 17)) },
  { ...realBase, id: "r6", rival: "Entrepibas F.C.", date: ts(madridMs(2026, 11, 29, 17)), home: false },
];

describe("seasonStrip · the long season (14 teams, 26 jornadas, J17 live)", () => {
  const f = longSeasonFixture();
  const strip = seasonStrip(f.matches, f.seasonId, f.now);
  const seg = (n: number) => strip.segments[n - 1];

  it("one segment per jornada, numbered 1…26 in calendar order (the postponed ones keep theirs)", () => {
    expect(strip.segments).toHaveLength(26);
    expect(strip.segments.map((s) => s.jornada)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(seg(9)).toMatchObject({ state: "aplazado", letter: "A", score: null, jornada: 9 });
    expect(seg(20)).toMatchObject({ state: "aplazado", letter: "A" });
  });

  it("J17 is live, «hoy» and the focus; its score is provisional (read from the plays)", () => {
    expect(seg(17)).toMatchObject({ state: "directo", score: { gf: 2, ga: 1 }, provisional: true, letter: null, rival: "Orduña fc", home: true });
    expect(strip.todayIndex).toBe(16);
    expect(strip.focusIndex).toBe(16);
  });

  it("played jornadas carry the acta's score and letter, legacy ones without a clock too", () => {
    expect(seg(1)).toMatchObject({ state: "jugado", score: { gf: 3, ga: 1 }, letter: "G", provisional: false });
    expect(seg(3)).toMatchObject({ state: "jugado", letter: "P" });
    expect(seg(5)).toMatchObject({ letter: "E", score: { gf: 2, ga: 2 } });
    expect(seg(1).match.clock).toBeUndefined();
    expect(seg(18).state).toBe("proximo");
    expect(strip.counts).toEqual({ total: 26, played: 15, live: 1, today: 0, upcoming: 8, postponed: 2, cancelled: 0, pending: 0 });
  });

  it("months start where the Madrid month changes; the Christmas break is a two-week gap", () => {
    expect(strip.months.map((m) => m.label)).toEqual(["sept", "oct", "nov", "dic", "ene", "feb", "mar"]);
    expect(strip.months[4]).toEqual({ index: 15, month: 0, year: 2027, label: "ene" });
    expect(seg(16).monthStart).toBe(true);
    expect(strip.gaps).toEqual([{ before: 15, days: 21, weeks: 2, firstFreeDay: "2026-12-27" }]);
    expect(seg(16).gapBefore).toEqual({ days: 21, weeks: 2, firstFreeDay: "2026-12-27" });
    expect(seg(2).gapBefore).toBeNull();
  });

  it("the minimap's span goes from 0 at J1 to 1 at J26", () => {
    expect(seg(1).span).toBe(0);
    expect(seg(26).span).toBe(1);
    expect(seg(17).span!).toBeGreaterThan(seg(16).span!);
  });

  it("the light at kick-off: a January 19:00 is night with the floodlights on, a September noon is day", () => {
    expect(seg(17).light).toMatchObject({ light: "noche", lightEnd: "noche", floodlights: true });
    expect(seg(2).light).toMatchObject({ light: "dia", floodlights: false });
    expect(seg(17).light!.sunset).toBeLessThan(f.kickoff);
  });
});

describe("seasonStrip · the real season (7 teams, debut tonight)", () => {
  it("before the kick-off J1 is «hoy»; a 14-day jump is one week without a match", () => {
    const strip = seasonStrip(REAL, "t1", KO - 2 * HOUR);
    expect(strip.segments.map((s) => s.state)).toEqual(["hoy", "proximo", "proximo", "proximo", "proximo", "proximo"]);
    expect(strip.todayIndex).toBe(0);
    expect(strip.focusIndex).toBe(0);
    expect(strip.gaps).toEqual([{ before: 2, days: 14, weeks: 1, firstFreeDay: "2026-11-01" }]);
    expect(strip.months.map((m) => m.label)).toEqual(["oct", "nov"]);
  });

  it("the day before, nothing is «hoy» and the focus is the next one", () => {
    const strip = seasonStrip(REAL, "t1", KO - 24 * HOUR);
    expect(strip.todayIndex).toBeNull();
    expect(strip.focusIndex).toBe(0);
    expect(strip.segments[0].state).toBe("proximo");
  });

  it("weather rides along by match id (a Map or a record)", () => {
    const map = seasonStrip(REAL, "t1", KO, new Map([["r2", { t: 17 }]]));
    expect(map.segments[1].weather).toEqual({ t: 17 });
    expect(map.segments[0].weather).toBeNull();
    const rec = seasonStrip(REAL, "t1", KO, { r3: "lluvia" });
    expect(rec.segments[2].weather).toBe("lluvia");
  });

  it("an empty season has no focus", () => {
    const strip = seasonStrip(REAL, "otra", KO);
    expect(strip).toMatchObject({ segments: [], months: [], gaps: [], todayIndex: null, focusIndex: null });
  });
});

describe("stripStateOf · the edge cases", () => {
  const started = transitionClock(readyClock(), "start", KO);
  const ended = transitionClock(transitionClock(transitionClock(started, "halftime", KO + 25 * MIN), "second", KO + 30 * MIN), "finish", KO + 55 * MIN);

  it("a clock nobody started, once its window is over: «pendiente», no score and no letter", () => {
    const now = KO + 50 * MIN + 2 * HOUR + 1;
    const strip = seasonStrip([{ ...realBase, events: [{ id: "x", type: "goal", playerId: "a", elapsedSeconds: 60, period: 1 }] }], "t1", now);
    expect(strip.segments[0]).toMatchObject({ state: "pendiente", score: null, letter: null, provisional: false });
    expect(strip.counts.pending).toBe(1);
  });

  it("the date has come and nobody whistled yet: still «hoy» (even past midnight)", () => {
    const late = { ...realBase, date: ts(madridMs(2026, 10, 18, 23, 30)) };
    expect(stripStateOf(late, madridMs(2026, 10, 19, 0, 15))).toBe("hoy");
  });

  it("a clock that ran to the end with its acta still to come: «jugado», provisional, letter from the plays", () => {
    const m: ClubMatch = { ...realBase, clock: ended, events: [{ id: "g", type: "goal", playerId: "a", elapsedSeconds: 120, period: 1 }] };
    const s = seasonStrip([m], "t1", KO + 3 * HOUR).segments[0];
    expect(s).toMatchObject({ state: "jugado", score: { gf: 1, ga: 0 }, letter: "G", provisional: true });
  });

  it("a legacy match without a clock past its hour and without an acta is «pendiente»", () => {
    const legacy: ClubMatch = { id: "l", seasonId: "t1", status: "scheduled", rival: "X", date: ts(KO), duration: 50 };
    expect(stripStateOf(legacy, KO + 30 * MIN)).toBe("directo");
    expect(stripStateOf(legacy, KO + 3 * HOUR)).toBe("pendiente");
  });

  it("cancelled is «suspendido» without a number; postponed «aplazado»; drafts, archived and other seasons are out", () => {
    const strip = seasonStrip(
      [
        { ...realBase, id: "c", status: "cancelled" },
        { ...realBase, id: "p", status: "postponed", date: ts(KO + 7 * 24 * HOUR) },
        { ...realBase, id: "d", published: false } as ClubMatch,
        { ...realBase, id: "a", archived: true },
        { ...realBase, id: "o", seasonId: "t0" },
      ],
      "t1",
      KO - HOUR,
    );
    expect(strip.segments.map((s) => [s.id, s.state, s.jornada, s.letter])).toEqual([
      ["c", "suspendido", null, null],
      ["p", "aplazado", 1, "A"],
    ]);
    expect(strip.counts.cancelled).toBe(1);
  });

  it("an undated match goes last, with no light, span, month or gap", () => {
    const strip = seasonStrip([{ ...realBase, id: "u", date: undefined }, realBase], "t1", KO - 48 * HOUR);
    expect(strip.segments.map((s) => s.id)).toEqual(["r1", "u"]);
    expect(strip.segments[1]).toMatchObject({ state: "proximo", at: null, day: null, light: null, span: null, month: null, monthStart: false, gapBefore: null });
  });

  it("lightAt reads the sun over Palomeras", () => {
    const l = lightAt(madridMs(2026, 6, 21, 13), 50);
    expect(l).toMatchObject({ light: "dia", lightEnd: "dia", floodlights: false });
  });
});

describe("the ribbon's window", () => {
  it("windowAround centres on the index and stops at the ends", () => {
    expect(windowAround(16, 7, 26)).toMatchObject({ start: 13, end: 20, size: 7, hasPrev: true, hasNext: true, prevStart: 7, nextStart: 19 });
    expect(windowAround(0, 7, 26)).toMatchObject({ start: 0, end: 7, hasPrev: false, hasNext: true });
    expect(windowAround(25, 7, 26)).toMatchObject({ start: 19, end: 26, hasNext: false });
    expect(windowAround(2, 10, 6)).toMatchObject({ start: 0, end: 6, size: 6, hasPrev: false, hasNext: false });
    expect(windowAround(0, 7, 0)).toMatchObject({ start: 0, end: 0, size: 0 });
  });

  it("a page moves by the window less one (one segment stays in sight)", () => {
    expect(pageWindow(13, 1, 7, 26)).toMatchObject({ start: 19, end: 26 });
    expect(pageWindow(19, 1, 7, 26).start).toBe(19);
    expect(pageWindow(13, -1, 7, 26).start).toBe(7);
    expect(pageWindow(3, -1, 7, 26).start).toBe(0);
    expect(windowAt(-5, 7, 26).start).toBe(0);
  });
});

describe("filters and the rival search", () => {
  const f = longSeasonFixture();
  const strip = seasonStrip(f.matches, f.seasonId, f.now);

  it("«Próximos» keeps what is still to play (live and postponed in), «Resultados» what has or awaits a result", () => {
    expect(filterStrip(strip.segments, "proximos").map((s) => s.jornada)).toEqual([9, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
    expect(filterStrip(strip.segments, "resultados").map((s) => s.jornada)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(filterStrip(strip.segments, "todos")).toHaveLength(26);
  });

  it("«Buscar rival» ignores accents and case", () => {
    expect(searchRival(strip.segments, "ORDUÑA").map((s) => s.jornada)).toEqual([4, 17]);
    expect(searchRival(strip.segments, "chamartin").map((s) => s.jornada)).toEqual([1, 14]);
    expect(searchRival(strip.segments, "  ")).toEqual([]);
    expect(searchRival(strip.segments, "a", 3)).toHaveLength(3);
  });
});
