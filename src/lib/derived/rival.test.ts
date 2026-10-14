import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../clubData";
import { rivalDossier, rivalKey } from "./rival";

type Ev = NonNullable<ClubMatch["events"]>[number];
const goal = (id: string, playerId: string, type: Ev["type"] = "goal"): Ev => ({ id, type, minute: 10, playerId });
const game = (id: string, day: number, rival: string | undefined, gf: number, ga: number, events: Ev[] = [], extra: Partial<ClubMatch> = {}): ClubMatch => ({
  id,
  seasonId: "t1",
  rival,
  date: Date.UTC(2026, 0, day),
  duration: 50,
  status: "finished",
  goalsFor: gf,
  goalsAgainst: ga,
  events,
  ...extra,
});

describe("rivalKey", () => {
  it("folds accents, case and spaces: one rival however it was typed", () => {
    expect(rivalKey("  Atlético   Pínfano ")).toBe("atletico pinfano");
    expect(rivalKey("ATLETICO PINFANO")).toBe(rivalKey("Atlético Pínfano"));
  });
});

describe("rivalDossier", () => {
  const games = [
    game("a", 1, "Atlético Pínfano", 2, 2, [goal("1", "ana"), goal("2", "bea")]),
    game("b", 5, "MAMBO", 1, 0, [goal("3", "ana")]),
    game("c", 9, "atletico pinfano ", 5, 1, [goal("4", "ana"), goal("5", "ana"), goal("6", "cris", "goal_penalty"), goal("7", "bea"), { id: "8", type: "opponent_own_goal", minute: 30 }]),
    game("d", 12, "ATLÉTICO PÍNFANO", 0, 1),
    game("e", 20, "Atlético Pínfano", 4, 0, [goal("9", "cris", "goal_freekick"), goal("10", "bea"), goal("11", "dani"), goal("12", "dani")], { seasonId: "t2" }),
    // still to be played, being played (scheduled with goals in), cancelled: not meetings
    game("f", 25, "Atlético Pínfano", 0, 0, [], { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined }),
    game("g", 26, "Atlético Pínfano", 1, 0, [goal("13", "ana")], { status: "scheduled" }),
    game("h", 27, "Atlético Pínfano", 3, 0, [], { status: "cancelled" }),
  ];

  it("the record over every spelling of the name, only finished meetings (PJ · G-E-P · GF:GC)", () => {
    const d = rivalDossier(games, "Atletico Pinfano");
    expect(d.key).toBe("atletico pinfano");
    expect(d.name).toBe("Atlético Pínfano");
    expect(d.games.map((m) => m.id)).toEqual(["e", "d", "c", "a"]);
    expect(d.record).toMatchObject({ played: 4, wins: 2, draws: 1, losses: 1, gf: 11, ga: 4 });
  });

  it("the last three meetings, newest first, whatever the order they come in", () => {
    const d = rivalDossier([...games].reverse(), "atlético pínfano");
    expect(d.last.map((m) => m.id)).toEqual(["e", "d", "c"]);
    expect(rivalDossier(games, "MAMBO", { last: 5 }).last.map((m) => m.id)).toEqual(["b"]);
  });

  it("our scorers against them, most goals first; a tie goes to the most recent; an own goal of theirs has no scorer", () => {
    const d = rivalDossier(games, "Atlético Pínfano");
    // ana 3 (a, c, c) · bea 3 (a, c, e) · cris 2 (c, e) · dani 2 (e, e) — bea scored against them more
    // recently than ana; cris and dani both last in e: by id
    expect(d.scorers).toEqual([
      { id: "bea", goals: 3, seasonId: "t2" },
      { id: "ana", goals: 3, seasonId: "t1" },
      { id: "cris", goals: 2, seasonId: "t2" },
    ]);
    expect(rivalDossier(games, "Atlético Pínfano", { scorers: 10 }).scorers.map((s) => s.id)).toEqual(["bea", "ana", "cris", "dani"]);
  });

  it("the biggest win: the widest margin, then the most goals; on a full tie the first one to get there", () => {
    expect(rivalDossier(games, "Atlético Pínfano").biggestWin?.id).toBe("c"); // 5–1 and 4–0: margin 4, five goals
    const tie = [game("x", 1, "R", 3, 0), game("y", 2, "R", 3, 0), game("z", 3, "R", 2, 0)];
    expect(rivalDossier(tie, "R").biggestWin?.id).toBe("x");
    expect(rivalDossier([game("l", 1, "R", 0, 2), game("m", 2, "R", 1, 1)], "R").biggestWin).toBeNull();
  });

  it("the first meeting", () => {
    expect(rivalDossier(games, "atletico pinfano").first?.id).toBe("a");
  });

  it("no history: an empty record, nothing to list, the name as asked", () => {
    const d = rivalDossier(games, "Nuevos FC");
    expect(d).toMatchObject({ key: "nuevos fc", name: "Nuevos FC", games: [], last: [], scorers: [], biggestWin: null, first: null });
    expect(d.record).toMatchObject({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 });
    // a match with no rival is «Rival», as the stats always grouped it
    expect(rivalDossier([game("n", 1, undefined, 1, 0)], null).games.map((m) => m.id)).toEqual(["n"]);
  });

  it("`exclude` leaves one match out of everything", () => {
    const d = rivalDossier(games, "Atlético Pínfano", { exclude: "c" });
    expect(d.record).toMatchObject({ played: 3, gf: 6, ga: 3 });
    expect(d.biggestWin?.id).toBe("e");
  });

  it("legacy actas without events: the record stands, no scorers", () => {
    const d = rivalDossier([game("o", 1, "Viejo", 3, 1, undefined, { events: undefined })], "viejo");
    expect(d.record).toMatchObject({ played: 1, wins: 1, gf: 3, ga: 1 });
    expect(d.scorers).toEqual([]);
  });
});
