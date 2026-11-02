// «¬» (AltGr+6 on a Spanish keyboard) inside a tag or a plan key: firestore.rules joins those lists with «¬», so one
// stored inside would refuse every later save of the board. The client drops it when typing AND when reading, so a
// board that already has one heals on its next save.
import { describe, expect, it } from "vitest";
import { boardToData, dataToLineupDoc, extractLineup } from "../lineupDoc";
import { cleanTag, parseTags } from "../v2/tags";
import { parsePlan, planToData } from "./plan";

// what the rules check (lineups boardExtrasOk / planMapOk): joined with «¬» and split back, the same list
const rulesOk = (xs: string[], max: number) => xs.length === 0 || (new RegExp(`^[^¬]{1,${max}}(¬[^¬]{1,${max}}){0,2}$`).test(xs.join("¬")) && JSON.stringify(xs.join("¬").split("¬")) === JSON.stringify(xs));

describe("«¬» never reaches a board", () => {
  it("a tag typed with «¬» loses it", () => {
    expect(cleanTag("Li¬ga ")).toBe("Liga");
    expect(cleanTag("¬")).toBe("");
  });
  it("a stored tag with «¬» heals on read", () => {
    expect(parseTags(["Co¬pa", "¬"], "b")).toEqual(["Copa"]);
  });
  it("a plan key with «¬» heals on read and on write", () => {
    const p = parsePlan({ claves: ["Presión ¬alta", "Salir rápido"], viz: [], notes: "", parado: null }, "b");
    expect(p?.claves).toEqual(["Presión alta", "Salir rápido"]);
    const back = planToData({ claves: ["A¬B"], viz: [], notes: "", parado: null });
    expect(back?.claves).toEqual(["AB"]);
  });
  it("a board stored with «¬» in a tag and a key saves again after load (what it writes passes the rules)", () => {
    const doc = dataToLineupDoc("b1", { formation: "2-3-1", slots: [], tags: ["Li¬ga", "Copa"], plan: { claves: ["Mor¬demos"], viz: [], notes: "", parado: null } });
    const data = boardToData(extractLineup(doc)) as { tags?: string[]; plan?: { claves: string[] } };
    expect(data.tags).toEqual(["Liga", "Copa"]);
    expect(rulesOk(data.tags ?? [], 20)).toBe(true);
    expect(data.plan?.claves).toEqual(["Mordemos"]);
    expect(rulesOk(data.plan?.claves ?? [], 60)).toBe(true);
  });
});
