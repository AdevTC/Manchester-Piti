import { describe, expect, it } from "vitest";
import type { PlayerDoc } from "../../../lib/schemas";
import { accountOf, boardGroups, boardRows, collection, dorsalParam, filterChips, freeDorsals, gapsOf, gapsText, lineCounts, listOrder, matchesFilter, nextIncomplete, repeatedDorsals, stepIn } from "./plantillaBoard";
import { plantillaRows } from "./plantillaLogic";

const SEASONS = [{ id: "t1", name: "Temporada 1" }];
const p = (id: string, extra: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, shirtName: id.toUpperCase(), seasons: ["t1"], ...extra });
const full = { naturalPosition: "DEL", photoUrl: "https://x.es/a.jpg", birthDate: "1995-02-03", height: 180, weight: 75 };

describe("plantillaBoard", () => {
  it("lists what a ficha lacks, in the slots' order, and says it", () => {
    expect(gapsOf(full)).toEqual([]);
    expect(gapsOf({})).toEqual(["pos", "foto", "nac", "alt", "peso"]);
    expect(gapsOf({ ...full, naturalPosition: "banquillo", height: 0, photoUrl: " " })).toEqual(["pos", "foto", "alt"]);
    expect(gapsText([])).toBe("Ficha completa");
    expect(gapsText(["foto"])).toBe("Le falta la foto");
    expect(gapsText(["nac", "alt", "peso"])).toBe("Le falta el nacimiento, la altura y el peso");
  });

  it("knows his account: linked beats a claim; removed members don't count", () => {
    const src = { people: [{ playerId: "a", removed: false, nickname: "Ana" }, { playerId: "b", removed: true }], claims: [{ playerId: "b", nickname: "Beto" }] };
    expect(accountOf("a", src)).toEqual({ state: "vinculada", who: "Ana" });
    expect(accountOf("b", src)).toEqual({ state: "pide", who: "Beto" });
    expect(accountOf("c", src)).toEqual({ state: "sin", who: "" });
  });

  it("builds the chips (only what matches something), the collection and the groups by line", () => {
    const players = [p("evans", { ...full, naturalPosition: "POR", number: 1 }), p("erik", { number: 9, naturalPosition: "DEL", injured: true }), p("fer", { number: 9 }), p("old", { seasons: [], number: 4 })];
    const rows = boardRows(plantillaRows(players, SEASONS, "t1").filter((r) => r.inSeason), { people: [{ playerId: "evans", removed: false }], claims: [{ playerId: "fer" }] });
    expect(collection(rows)).toMatchObject({ done: 1, total: 3, text: "1 de 3 fichas completas" });
    expect(filterChips(rows).map((c) => `${c.label} ${c.n}`)).toEqual(["Sin posición 1", "Sin foto 2", "Faltan datos 2", "Lesionados 1", "Sin cuenta 1", "Piden su ficha 1", "Dorsal repetido 2"]);
    const dup = repeatedDorsals(rows);
    expect([...dup]).toEqual([9]);
    expect(rows.filter((r) => matchesFilter(r, "cuenta", dup)).map((r) => r.id)).toEqual(["erik"]);
    const groups = boardGroups(rows);
    expect(groups.map((g) => `${g.title}: ${g.rows.map((r) => r.id).join(",")}`)).toEqual(["Sin posición: fer", "Porteros: evans", "Delanteros: erik"]);
    const order = listOrder(groups);
    expect(order).toEqual(["fer", "evans", "erik"]);
    // evans is complete: «siguiente sin completar» skips him
    expect(nextIncomplete(order, rows, "fer")).toBe("erik");
    expect(nextIncomplete(order, rows, "erik")).toBe("fer");
    expect(nextIncomplete(order, rows, null)).toBe("fer");
    expect(nextIncomplete(["evans"], rows, "evans")).toBeNull();
    expect(stepIn(order, "evans", 1)).toBe("erik");
    expect(stepIn(order, "fer", -1)).toBe("erik");
    expect(stepIn(order, "nadie", 1)).toBe("fer");
    expect(stepIn([], "fer", 1)).toBeNull();
    expect(lineCounts(rows).map((l) => `${l.label}${l.n}`)).toEqual(["POR1", "DEF0", "MED0", "DEL1", "Sin1"]);
  });

  it("the season's free dorsals and a dorsal from the URL", () => {
    const rows = plantillaRows([p("a", { number: 1 }), p("b", { number: 3 }), p("c", { number: 2, seasons: [] })], SEASONS, "t1");
    expect(freeDorsals(rows, 4)).toEqual([2, 4, 5, 6]);
    expect(freeDorsals(rows)).toHaveLength(97);
    expect(dorsalParam("7")).toBe(7);
    expect(dorsalParam(12)).toBe(12);
    expect(dorsalParam("0")).toBeNull();
    expect(dorsalParam("100")).toBeNull();
    expect(dorsalParam("x")).toBeNull();
  });
});

describe("gapsOf reads positions through the resolver", () => {
  it("a word that names a line is not a gap", () => {
    expect(gapsOf({ ...full, naturalPosition: "Defensa" })).toEqual([]);
    expect(gapsOf({ ...full, naturalPosition: undefined, positions: { main: "LD", also: [] } })).toEqual([]);
  });
});
