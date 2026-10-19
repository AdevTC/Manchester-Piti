import { describe, expect, it } from "vitest";
import { readyClock } from "../../../../functions/src/matchClock";
import type { StandingRow } from "../../standings";
import { longSeasonFixture } from "./fixtures";
import { presetResults, projectTable, remainingFixtures, simulateTable, tableFocus, type FocusItem, type SimFixture } from "./table";

const row = (team: string, pj: number, g: number, e: number, p: number, gf: number, gc: number, isUs = false): StandingRow => ({ team, pj, g, e, p, gf, gc, pts: 3 * g + e, isUs });
const SEVEN: StandingRow[] = ["Manchester Piti", "Entrepibas F.C.", "Pitutis", "Red Demons", "Sporting de Brugal", "SQUIRTLES FC", "Orduña fc"].map((t, i) => row(t, 0, 0, 0, 0, 0, 0, i === 0));
const shape = (items: FocusItem<StandingRow>[]) => items.map((x) => (x.kind === "gap" ? x.text : `${x.pos}${x.us ? "*" : ""}`));
const moveUs = (rows: readonly StandingRow[], to: number) => rows.map((r, i) => ({ ...r, isUs: i === to }));

describe("tableFocus", () => {
  const { standings } = longSeasonFixture();

  it("14 teams, us 6th: the leader and the rows around us; a one-team gap shows the team", () => {
    expect(shape(tableFocus(standings))).toEqual(["1", "2", "3", "4", "5", "6*", "7", "8", "9", "5 equipos más abajo"]);
  });

  it("us in the bottom half: the leader, a gap, and us ±3 down to the last", () => {
    expect(shape(tableFocus(moveUs(standings, 9)))).toEqual(["1", "5 equipos más arriba", "7", "8", "9", "10*", "11", "12", "13", "14"]);
    expect(shape(tableFocus(moveUs(standings, 13)))).toEqual(["1", "6 equipos más arriba", "8", "9", "10", "11", "12", "13", "14*"]);
  });

  it("us first: a full window from the top and the rest as a gap", () => {
    expect(shape(tableFocus(moveUs(standings, 0)))).toEqual(["1*", "2", "3", "4", "5", "6", "7", "7 equipos más abajo"]);
  });

  it("the gap says how many and where", () => {
    const gap = tableFocus(moveUs(standings, 9)).find((x) => x.kind === "gap");
    expect(gap).toEqual({ kind: "gap", side: "arriba", count: 5, text: "5 equipos más arriba" });
  });

  it("the 7-team league (and anything up to 2·around + 3) comes whole", () => {
    expect(shape(tableFocus(SEVEN))).toEqual(["1*", "2", "3", "4", "5", "6", "7"]);
    expect(tableFocus(standings.slice(0, 9))).toHaveLength(9);
    expect(shape(tableFocus(standings, null, 1))).toEqual(["1", "3 equipos más arriba", "5", "6*", "7", "7 equipos más abajo"]);
  });

  it("marks the rows level on points (Sporting has our 26)", () => {
    const items = tableFocus(standings).filter((x) => x.kind === "row");
    const tied = items.filter((x) => x.kind === "row" && x.tied).map((x) => (x.kind === "row" ? x.row.team : ""));
    expect(tied).toEqual(["Manchester Piti", "Sporting de Brugal"]);
    expect(SEVEN.every((_, i) => (tableFocus(SEVEN)[i] as { tied: boolean }).tied)).toBe(true);
  });

  it("finds us by name when asked, and without us shows the top", () => {
    const noUs = standings.map((r) => ({ ...r, isUs: false }));
    expect(shape(tableFocus(noUs, "MANCHESTER PITI"))).toEqual(["1", "2", "3", "4", "5", "6*", "7", "8", "9", "5 equipos más abajo"]);
    expect(shape(tableFocus(noUs))).toEqual(["1", "2", "3", "4", "5", "6", "7", "7 equipos más abajo"]);
  });
});

describe("remainingFixtures", () => {
  it("upcoming by date, then the postponed; never the live one", () => {
    const f = longSeasonFixture();
    const list = remainingFixtures(f.matches, f.seasonId, f.now);
    expect(list.map((x) => x.jornada)).toEqual([18, 19, 21, 22, 23, 24, 25, 26, 9, 20]);
    expect(list.map((x) => x.state).slice(-2)).toEqual(["aplazado", "aplazado"]);
    expect(list[0]).toMatchObject({ id: "j18", rival: "Red Demons", state: "proximo" });
  });

  it("before tonight's kick-off, tonight is the first one («hoy»)", () => {
    const f = longSeasonFixture();
    const matches = f.matches.map((m) => (m.id === f.liveId ? { ...m, clock: readyClock(), events: [] } : m));
    const list = remainingFixtures(matches, f.seasonId, f.kickoff - 60 * 60_000);
    expect(list[0]).toMatchObject({ jornada: 17, state: "hoy" });
  });
});

describe("«Si acaba así» and «¿Y si…?»", () => {
  const f = longSeasonFixture();
  const fixtures = remainingFixtures(f.matches, f.seasonId, f.now);
  const live = { rival: "Orduña fc", gf: 2, ga: 1 };

  it("the live score as if final: we and Orduña move, nobody else", () => {
    const s = projectTable(f.standings, live);
    expect(s.us).toMatchObject({ team: "Manchester Piti", pj: 16, g: 9, pts: 29, gf: 31, gc: 23, pos: 4, was: 6, move: 2, touched: true });
    expect(s.rows.find((r) => r.team === "Orduña fc")).toMatchObject({ pj: 16, p: 10, pts: 12, touched: true });
    expect(s.rows.filter((r) => r.touched)).toHaveLength(2);
    expect(s.rows.find((r) => r.team === "Los Gatos de Lavapiés")).toMatchObject({ pos: 6, move: -1, touched: false });
    expect(s.rows.find((r) => r.team === "Red Demons")).toMatchObject({ pts: 29, pos: 5, move: -1 });
    expect(s).toMatchObject({ points: 29, position: 4, comoMucho: 29, comoPoco: 29, unmatched: [] });
  });

  it("without a live score the table stays as it is", () => {
    const s = projectTable(f.standings, null);
    expect(s.rows.map((r) => r.team)).toEqual(f.standings.map((r) => r.team));
    expect(s.rows.every((r) => r.move === 0 && !r.touched)).toBe(true);
  });

  it("the viewer's picks: our points, the rival's, and the bounds", () => {
    const s = simulateTable(f.standings, fixtures, { j18: "G", j19: "P" }, "nada", { live });
    expect(s.us).toMatchObject({ pts: 32, pos: 3, gf: 32, gc: 24 });
    expect(s.rows.find((r) => r.team === "Red Demons")).toMatchObject({ pts: 29, p: 6, touched: true });
    expect(s.rows.find((r) => r.team === "Los Gatos de Lavapiés")).toMatchObject({ pts: 30, g: 9 });
    expect(s).toMatchObject({ points: 32, position: 3, comoPoco: 32, comoMucho: 56, picked: 2, filled: 0, open: 8, champions: false });
  });

  it("«Todo victorias»: every open jornada won, first, champions if it ends so; Pitutis loses twice", () => {
    const s = simulateTable(f.standings, fixtures, {}, "victorias", { live });
    expect(s).toMatchObject({ points: 59, position: 1, filled: 10, picked: 0, open: 0, champions: true, comoPoco: 29, comoMucho: 59 });
    expect(s.rows.find((r) => r.team === "Pitutis")).toMatchObject({ pj: 18, p: 9 });
  });

  it("a pick wins over the preset; «Todo empates»", () => {
    const s = simulateTable(f.standings, fixtures, { j26: "P" }, "empates", { live });
    expect(s.results.j26).toBe("P");
    expect(Object.values(s.results).filter((r) => r === "E")).toHaveLength(9);
    expect(s).toMatchObject({ points: 38, picked: 1, filled: 9, comoPoco: 29, comoMucho: 56 });
  });

  it("«Como hasta ahora» repeats our record (8 won of 15, 2 drawn) over the fixtures in order", () => {
    const r = presetResults(fixtures, "ritmo", f.standings[5]);
    expect(fixtures.map((x) => r[x.id]).join("")).toBe("PGPGPGPGEG");
    expect(presetResults(fixtures, "nada", f.standings[5])).toEqual({});
    // no match played yet: half won, a fifth drawn
    expect(presetResults(fixtures.slice(0, 4), "ritmo", { pj: 0, g: 0, e: 0 })).toEqual({ j18: "P", j19: "G", j21: "P", j22: "G" });
  });

  it("a rival not in the table moves only us; picks for unknown fixtures are ignored", () => {
    const friendly: SimFixture = { id: "amistoso", jornada: null, rival: "Amigos del Barrio", at: null, state: "proximo" };
    const s = simulateTable(f.standings, [friendly], { amistoso: "G", nope: "G" });
    expect(s.unmatched).toEqual(["amistoso"]);
    expect(s.us).toMatchObject({ pts: 29, pj: 16 });
    expect(s.picked).toBe(1);
  });

  it("without our row there is nothing of ours to tell", () => {
    const s = simulateTable(f.standings.map((r) => ({ ...r, isUs: false })), fixtures, {}, "victorias");
    expect(s).toMatchObject({ us: null, points: null, position: null, comoMucho: null, comoPoco: null, champions: false });
  });

  it("the 7-team debut: a 1–0 tonight puts us first and Orduña last; level teams keep the league's order", () => {
    const s = projectTable(SEVEN, { rival: "orduña FC", gf: 1, ga: 0 });
    expect(s.rows.map((r) => r.team)).toEqual(["Manchester Piti", "Entrepibas F.C.", "Pitutis", "Red Demons", "Sporting de Brugal", "SQUIRTLES FC", "Orduña fc"]);
    expect(s.rows[6]).toMatchObject({ pts: 0, gc: 1, touched: true });
    const lost = projectTable(SEVEN, { rival: "Orduña fc", gf: 0, ga: 2 });
    expect(lost.rows.map((r) => r.team)[0]).toBe("Orduña fc");
    expect(lost.us).toMatchObject({ pos: 7, was: 1, move: -6 });
  });

  it("ties go by points, goal difference, goals for, then the league's order", () => {
    const rows = [row("A", 2, 1, 0, 1, 3, 3), row("B", 2, 1, 0, 1, 4, 4), row("C", 2, 1, 0, 1, 3, 3, true)];
    expect(projectTable(rows, null).rows.map((r) => r.team)).toEqual(["B", "A", "C"]);
  });
});
