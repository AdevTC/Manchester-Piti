import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../../clubData";
import { scoreOf } from "../../partidos";
import { cleanSheetsByKeeper, keeperOf, seasonCards } from "./keepers";
import { actaPlayers, matchLogros } from "./matchLogros";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 4, 17);

const row = (played: boolean, extra: Record<string, unknown> = {}) => ({ played, minutes: played ? 50 : 0, goals: 0, assists: 0, ...extra }) as unknown as Participation;
const match = (id: string, i: number, more: Partial<ClubMatch> & { lineup?: unknown }): ClubMatch =>
  ({ id, seasonId: "t1", version: 2, rival: `Rival ${i}`, status: "finished", date: T0 + i * 7 * DAY, home: true, duration: 50, starters: [], bench: [], events: [], goalsFor: 1, goalsAgainst: 0, ...more }) as ClubMatch;

describe("clean sheets by keeper", () => {
  it("whoever kept goal: the ledger's POR minutes, else the lineup's POR slot, else the first starter", () => {
    expect(keeperOf({ ledger: { evans: row(true, { positionsPlayed: { POR: 30 } }), fer: row(true, { positionsPlayed: { POR: 20, DFC: 30 } }) } as ClubMatch["ledger"], starters: ["fer"] })).toBe("evans");
    const slots = ["evans", "fer", "illescas", "jordi", "adrian", "eguz", "alcides"].map((playerId, i) => ({ playerId, code: i ? "MC" : "POR", x: 10 + i * 10, y: 90 - i * 10 }));
    expect(keeperOf({ starters: ["fer", "evans"], lineup: { system: "3-2-1", slots, boardId: "b", setBy: "u", setAt: 1 } })).toBe("evans");
    expect(keeperOf({ starters: ["evans", "fer"] })).toBe("evans");
    expect(keeperOf({ starters: [] })).toBeNull();
  });

  it("one row per keeper, most first; the live match at nil «de momento»", () => {
    const played = [match("a", 0, { starters: ["evans"], goalsAgainst: 0 }), match("b", 1, { starters: ["evans"], goalsAgainst: 2 }), match("c", 2, { starters: ["kevin"], goalsAgainst: 0 }), match("d", 3, { starters: ["evans"], goalsAgainst: 0 })];
    const live = match("e", 4, { status: "scheduled", starters: ["evans"], goalsAgainst: undefined, goalsFor: undefined, events: [] });
    expect(cleanSheetsByKeeper(played, scoreOf)).toEqual([
      { id: "evans", clean: 2, provisional: false },
      { id: "kevin", clean: 1, provisional: false },
    ]);
    expect(cleanSheetsByKeeper(played, scoreOf, live)[0]).toEqual({ id: "evans", clean: 3, provisional: true });
  });

  it("the yellow cards, tonight's counted and marked", () => {
    const y = (id: string, type = "yellow_card") => ({ id, type, playerId: "fer", minute: 10 });
    const played = [match("a", 0, { events: [y("1"), y("2", "double_yellow")] as ClubMatch["events"] })];
    expect(seasonCards(played)).toEqual({ cards: 3, provisional: false });
    expect(seasonCards(played, match("b", 1, { status: "scheduled", events: [y("3")] as ClubMatch["events"] }))).toEqual({ cards: 4, provisional: true });
  });
});

describe("the logros of a match", () => {
  const goal = (id: string, who: string) => ({ id, type: "goal", playerId: who, minute: 12 });
  const first = match("m1", 0, { ledger: { evans: row(true), alcides: row(true, { goals: 1 }), kevin: row(true) } as ClubMatch["ledger"], events: [goal("g1", "alcides")] as ClubMatch["events"] });
  const second = match("m2", 1, { ledger: { evans: row(true), alcides: row(true), kevin: row(true, { goals: 1 }), josito: row(true) } as ClubMatch["ledger"], events: [goal("g2", "kevin")] as ClubMatch["events"] });
  const names: Record<string, string> = { evans: "Evans", alcides: "Alcides", kevin: "Kevin", josito: "Josito" };
  const ctx = { mvpResults: new Map(), now: T0 + 60 * DAY };

  it("who was on the acta: the ledger's players who played, else the convocatoria", () => {
    expect(actaPlayers(second).sort()).toEqual(["alcides", "evans", "josito", "kevin"]);
    expect(actaPlayers({ starters: ["a", "guest:g1"], bench: ["b"] })).toEqual(["a", "b"]);
  });

  it("the medals crossed in that very match, grouped, in the catalogue's order", () => {
    const one = matchLogros(first, [first, second], (id) => names[id], ctx);
    expect(one.map((l) => l.text)).toEqual(["Debut, Evans, Alcides y Kevin", "Primer gol, Alcides"]);
    expect(one[1]).toMatchObject({ icon: "ball", players: ["alcides"] });
    const two = matchLogros(second, [first, second], (id) => names[id], ctx);
    expect(two.map((l) => l.text)).toEqual(["Debut, Josito", "Primer gol, Kevin"]);
  });

  it("many players with the same medal: «para los N que jugaron»", () => {
    const squad = ["a", "b", "c", "d", "e"];
    const m = match("m0", 0, { ledger: Object.fromEntries(squad.map((id) => [id, row(true)])) as ClubMatch["ledger"] });
    expect(matchLogros(m, [m], (id) => id.toUpperCase(), ctx)[0]?.text).toBe("Debut, para los 5 que jugaron");
  });
});
