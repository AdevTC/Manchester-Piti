import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import { seasonView } from "../partidos";
import { seasonPulse } from "../home";
import { mergeMatches } from "../../pages/admin/data/adminLogic";
import { boardCalendar, boardSeason } from "../../pages/pizarra/v2/useBoardData";
import { matchShort } from "../../pages/pizarra/v2/boards";
import { seasonSquad } from "./card";
import { upcomingRows } from "../../pages/perfil/avisos";
import { hasJornada, jornadaLabel, jornadaNumbers, jornadaOf, jornadas } from "./jornada";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 4, 10); // a Sunday, 12:00 Madrid
const d = (n: number) => T0 + n * 7 * DAY;
const NOW = d(4) - DAY;

// One season (t1) as it lives in Firestore: a cancelled match, a postponed one, two played, one to play,
// one still without a date and — only in matchDrafts — a brand-new match not published yet. Plus an
// older season (t0) whose numbers must stay its own when «all seasons» is selected.
const published: ClubMatch[] = [
  { id: "a", seasonId: "t1", rival: "A", date: d(0), status: "finished", goalsFor: 3, goalsAgainst: 1 },
  { id: "x", seasonId: "t1", rival: "X", date: d(1), status: "cancelled" },
  { id: "p", seasonId: "t1", rival: "P", date: d(1) + DAY, status: "postponed" },
  { id: "b", seasonId: "t1", rival: "B", date: d(2), status: "finished", goalsFor: 1, goalsAgainst: 1 },
  { id: "u", seasonId: "t1", rival: "U", status: "scheduled" },
  { id: "c", seasonId: "t1", rival: "C", date: d(5), status: "scheduled" },
  { id: "old1", seasonId: "t0", rival: "O1", date: d(-40), status: "finished", goalsFor: 0, goalsAgainst: 2 },
  { id: "old2", seasonId: "t0", rival: "O2", date: d(-39), status: "finished", goalsFor: 2, goalsAgainst: 0 },
];
const drafts: ClubMatch[] = [{ id: "new", seasonId: "t1", rival: "NEW", date: d(4), status: "scheduled" }];
const EXPECTED = new Map([
  ["a", 1],
  ["p", 2],
  ["b", 3],
  ["c", 4],
  ["u", 5],
  ["old1", 1],
  ["old2", 2],
]);

describe("the jornada rule", () => {
  it("published, not cancelled, by date, numbered inside each season", () => {
    expect(jornadaNumbers(published)).toEqual(EXPECTED);
    expect(jornadas(published, "t1")).toEqual(new Map([...EXPECTED].filter(([id]) => !id.startsWith("old"))));
    expect(jornadaOf(published, "b")).toBe(3);
    expect(jornadaOf(published, "x")).toBeNull();
    expect(jornadaOf(published, "nope")).toBeNull();
  });
  it("a draft (published: false), a cancelled match or one without season has none", () => {
    expect(hasJornada({ id: "n", seasonId: "t1", published: false })).toBe(false);
    expect(hasJornada({ id: "x", seasonId: "t1", status: "cancelled" })).toBe(false);
    expect(hasJornada({ id: "s", seasonId: null })).toBe(false);
    expect(hasJornada({ id: "ok", seasonId: "t1", status: "postponed" })).toBe(true);
  });
  it("undated matches go after the dated ones, ties by id (a stable order whatever the input order)", () => {
    const ms = [
      { id: "z", seasonId: "s", date: undefined },
      { id: "b2", seasonId: "s", date: 100 },
      { id: "b1", seasonId: "s", date: 100 },
      { id: "a", seasonId: "s", date: 50 },
    ];
    expect([...jornadaNumbers(ms)]).toEqual([
      ["a", 1],
      ["b1", 2],
      ["b2", 3],
      ["z", 4],
    ]);
    expect(jornadaNumbers([...ms].reverse())).toEqual(jornadaNumbers(ms));
  });
  it("labels: «J5», empty without a number", () => {
    expect(jornadaLabel(5)).toBe("J5");
    expect(jornadaLabel(null)).toBe("");
    expect(jornadaLabel(undefined)).toBe("");
  });
});

describe("parity: the same J for the same match on every surface", () => {
  it("public (/partidos and the ficha), admin, pizarra, perfil and avisos agree — the draft and the cancelled match get none", () => {
    // public: the season view (tiles + the map the match page and the calendar rows read)
    const view = seasonView(published, "t1", NOW);
    const pub = new Map(view.tiles.map((t) => [t.id, t.j]));
    expect(pub).toEqual(jornadas(published, "t1"));
    expect(view.jornada).toEqual(jornadas(published, "t1"));
    for (const id of ["a", "p", "b", "c", "u"]) expect(jornadaOf(published, id)).toBe(EXPECTED.get(id));
    expect(view.tiles.map((t) => t.id)).toEqual(["a", "p", "b", "c", "u"]);

    // admin: published + drafts merged — the draft «borrador» has no number, the cancelled one neither
    const merged = mergeMatches(published, drafts);
    const admin = new Map(merged.map((m) => [m.id, m.jornada]));
    for (const [id, j] of EXPECTED) expect(admin.get(id)).toBe(j);
    // listed in the calendar's order: the undated one last, as it is numbered
    expect(merged.filter((m) => m.seasonId === "t1").map((m) => m.id)).toEqual(["a", "x", "p", "b", "new", "c", "u"]);
    expect(admin.get("new")).toBeNull();
    expect(admin.get("x")).toBeNull();

    // pizarra: one season and «all seasons» (each match keeps its own season's number)
    for (const sel of ["t1", "all"]) {
      const cal = boardCalendar(boardSeason(published, sel));
      for (const c of cal) expect(c.j).toBe(EXPECTED.get(c.id) ?? null);
      // the match picker reads J1, J2, J3… (the undated one last)
      if (sel === "t1") expect(cal.flatMap((c) => c.j ?? [])).toEqual([1, 2, 3, 4, 5]);
    }
    const cancelled = boardCalendar(boardSeason(published, "t1")).find((c) => c.id === "x")!;
    expect(matchShort(cancelled)).toBe("X");

    // perfil (the carta's series and the pizarra squad built from it), selected season and «all»
    // every numbered match is there, with the same number
    expect(seasonSquad([], published, "t1", new Map(), NOW, []).jornada).toEqual(jornadas(published, "t1"));
    expect(seasonSquad([], published, "all", new Map(), NOW, []).jornada).toEqual(EXPECTED);

    // avisos: the next fixtures carry the same J
    expect(upcomingRows(published, NOW).map((r) => [r.id, r.j])).toEqual([["c", "J4"]]);

    // home: «jornada N» is the last played match's number
    expect(seasonPulse(published, "t1", NOW).jornada).toBe(3);
  });
});
