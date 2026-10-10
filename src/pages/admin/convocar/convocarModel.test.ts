import { describe, expect, it } from "vitest";
import { mergeMatches, type AdminMatch } from "../data/adminLogic";
import { rsvpOf } from "../data/lineup";
import { benchOf, convocables, copyFrom, matchLead, matchTitle, poolGroups, slotOf } from "./convocarModel";

const at = (d: number, h: number) => Date.UTC(2026, 10, d, h - 1, 0); // Madrid = UTC+1
const NOW = at(2, 10);
const matches: AdminMatch[] = mergeMatches(
  [
    { id: "m6", seasonId: "t1", rival: "Emirates", date: at(1, 10), status: "finished", goalsFor: 4, goalsAgainst: 1, starters: ["a", "b"], bench: ["c"] },
    { id: "m8", seasonId: "t1", rival: "MAD SKY", date: at(8, 12), status: "scheduled", home: false },
    { id: "m9", seasonId: "t1", rival: "EL CUARTEL CF", date: at(15, 11), status: "scheduled", home: true },
    { id: "m10", seasonId: "t1", rival: "Los 7 de JL", date: at(22, 11), status: "scheduled" },
    { id: "m11", seasonId: "t1", rival: "Otro", date: at(29, 11), status: "scheduled" },
    { id: "mx", seasonId: "t1", rival: "Cancelado", date: at(30, 11), status: "cancelled" },
  ],
  [],
);
const roster = [
  { id: "a", name: "EVANS", number: 1, position: "POR" },
  { id: "b", name: "ILLESCAS", number: 4, position: "DEF" },
  { id: "c", name: "KEVIN", number: 11, position: "DEL" },
  { id: "d", name: "FER", number: 12, position: "POR" },
];

describe("Convocar's model", () => {
  it("offers the next three to play (cancelled and played left out), plus the one asked for", () => {
    expect(convocables(matches, NOW).map((m) => m.id)).toEqual(["m8", "m9", "m10"]);
    expect(convocables(matches, NOW, "m11").map((m) => m.id)).toEqual(["m8", "m9", "m10", "m11"]);
    expect(convocables(matches, NOW, "m6").map((m) => m.id)).toEqual(["m8", "m9", "m10"]);
  });
  it("names the match in full and says when and where", () => {
    const m8 = matches.find((m) => m.id === "m8")!;
    expect(matchTitle(m8)).toBe("J2 · MAD SKY");
    expect(matchTitle(matches.find((m) => m.id === "m10")!)).toBe("J4 · Los 7 de JL");
    expect(matchLead(m8)).toBe("dom 8 nov · 12:00 · fuera");
    expect(matchLead(matches.find((m) => m.id === "m9")!)).toBe("dom 15 nov · 11:00 · en casa");
  });
  it("groups the squad by answer (empty groups out) with where each one hangs", () => {
    const l = { starters: ["a"], bench: ["c"] };
    const rsvp = rsvpOf([{ playerId: "a", response: "yes" }, { playerId: "c", response: "maybe" }, { playerId: "d", response: "no" }], ["a", "b", "c", "d"]);
    const g = poolGroups(roster, l, rsvp);
    expect(g.map((x) => [x.title, x.rows.map((r) => r.name)])).toEqual([
      ["Vienen", ["EVANS"]],
      ["En duda", ["KEVIN"]],
      ["No vienen", ["FER"]],
      ["Sin responder", ["ILLESCAS"]],
    ]);
    expect(g[0].rows[0]).toEqual({ id: "a", num: "1", name: "EVANS", line: "POR · en el siete", slot: "T" });
    expect(g[1].rows[0].line).toBe("DEL · en el banquillo");
    expect(g[3].rows[0].line).toBe("DEF · sin colocar");
    expect(slotOf(l, "b")).toBe("");
    expect(poolGroups(roster, l, rsvpOf([], ["a", "b", "c", "d"])).map((x) => x.title)).toEqual(["Sin responder"]);
  });
  it("the banquillo in call order, squad players only", () => {
    expect(benchOf(roster, { starters: [], bench: ["d", "ghost", "c"] }).map((p) => p.name)).toEqual(["FER", "KEVIN"]);
  });
  it("«Copiar la convocatoria de la Jn»: the latest earlier one, this squad only; none when it changes nothing", () => {
    const m8 = matches.find((m) => m.id === "m8")!;
    expect(copyFrom(matches, m8, { starters: [], bench: [] }, ["a", "c"])).toEqual({ label: "J1", lineup: { starters: ["a"], bench: ["c"] } });
    expect(copyFrom(matches, m8, { starters: ["a"], bench: ["c"] }, ["a", "c"])).toBeNull();
    expect(copyFrom(matches, matches.find((m) => m.id === "m6")!, { starters: [], bench: [] }, ["a"])).toBeNull();
  });
});
