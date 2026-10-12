import { describe, expect, it, vi } from "vitest";
import { FORMATIONS } from "../formations";
import { boardToData, dataToLineupDoc, extractLineup, lineupToData } from "../lineupDoc";
import { demoSquad, lineupOf } from "./testkit";
import {
  filterByRival,
  newRival,
  parseRival,
  rivalAria,
  rivalName,
  rivalNotes,
  rivalOptions,
  rivalPos,
  rivalSpots,
  rivalToData,
  setRivalNote,
  setRivalNum,
  setRivalSystem,
} from "./rival";

const report = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/docTelemetry", () => ({ reportDroppedDoc: report }));

const META = { ownerUid: "u", ownerNickname: "yo", seasonId: "t1", name: "J8", isOfficial: false, matchId: null };

describe("the rival seven", () => {
  it("starts with seven blank players in a system, mirrored onto their half", () => {
    const r = newRival("3-2-1");
    expect(r.players).toHaveLength(7);
    const spots = rivalSpots(r);
    expect(spots[0]).toEqual({ x: 100 - FORMATIONS["3-2-1"][0].x, y: 100 - FORMATIONS["3-2-1"][0].y });
    // their keeper by their goal line (y 0), their striker deep in our half
    expect(spots[0].y).toBeLessThan(15);
    expect(spots[6].y).toBeGreaterThan(70);
  });
  it("keeps a dorsal and a note per spot, and changes system without losing them", () => {
    let r = newRival();
    r = setRivalNum(r, 6, "9");
    r = setRivalNote(r, 6, "  presionar al 9   por su izquierda ");
    expect(r.players[6]).toEqual({ num: 9, note: "presionar al 9 por su izquierda" });
    expect(rivalName(r, 6)).toBe("El 9 (DC)");
    expect(rivalName(r, 0)).toBe("Su POR");
    expect(rivalAria(r, 6)).toBe("Rival: el 9 (dc). presionar al 9 por su izquierda");
    expect(rivalNotes(r)).toBe(1);
    const s = setRivalSystem(r, "2-1-3");
    expect(s.formation).toBe("2-1-3");
    expect(s.players[6]).toEqual(r.players[6]);
    expect(rivalPos(s, 6)).toBe("EI");
    expect(setRivalSystem(s, "2-1-3")).toBe(s);
  });
  it("clears a dorsal or a note when emptied, ignores what is not a dorsal, and the same value changes nothing", () => {
    let r = setRivalNote(setRivalNum(newRival(), 1, "4"), 1, "lento al girar");
    expect(setRivalNum(r, 1, "4")).toBe(r);
    expect(setRivalNote(r, 1, "lento al girar")).toBe(r);
    expect(setRivalNum(r, 9, "4")).toBe(r);
    r = setRivalNum(r, 1, "abc");
    expect(r.players[1].num).toBeUndefined();
    r = setRivalNote(r, 1, "   ");
    expect(r.players[1]).toEqual({});
    expect(setRivalNote(newRival(), 0, "x".repeat(200)).players[0].note).toHaveLength(80);
  });
});

describe("the rival in the store (lenient)", () => {
  it("is absent for an old board, null once taken off, and repaired when malformed", () => {
    expect(parseRival(undefined)).toBeUndefined();
    expect(parseRival(null)).toBeNull();
    report.mockClear();
    expect(parseRival("MAD SKY", "b1")).toBeNull();
    expect(report).toHaveBeenCalledWith("lineups.rival", "b1", expect.anything());
    const r = parseRival({ formation: "2-3-1", players: [{ num: 9, note: "ojo" }, { num: 300 }, "x"] }, "b2");
    expect(r?.players).toHaveLength(7);
    expect(r?.players[0]).toEqual({ num: 9, note: "ojo" });
    expect(r?.players[1]).toEqual({});
    expect(r?.players[2]).toEqual({});
    expect(parseRival({ formation: "4-4-2", players: [] })).toBeNull();
  });
  it("round-trips through lineupDoc; a board that never had one never writes the field", () => {
    const sq = demoSquad();
    const L = lineupOf(["evans", "illescas"], "2-3-1", sq);
    expect("rival" in boardToData(L)).toBe(false);
    const r = setRivalNote(setRivalNum(newRival("3-1-2"), 5, "10"), 5, "el bueno");
    const data = lineupToData({ ...L, rival: r }, META);
    expect(data.rival).toEqual(rivalToData(r));
    const doc = dataToLineupDoc("b1", data);
    expect(doc.rival).toEqual(r);
    expect(extractLineup(doc).rival).toEqual(r);
    // taken off: written as null (so the update clears it), read back as null
    expect(boardToData({ ...L, rival: null }).rival).toBeNull();
    expect(dataToLineupDoc("b1", { ...data, rival: null }).rival).toBeNull();
    expect(extractLineup(dataToLineupDoc("b1", { ...data, rival: null })).rival).toBeNull();
    expect("rival" in extractLineup(dataToLineupDoc("b1", lineupToData(L, META)))).toBe(false);
  });
  it("writes nothing undefined", () => {
    expect(rivalToData(newRival())).toEqual({ formation: "2-3-1", players: [{}, {}, {}, {}, {}, {}, {}] });
    expect(rivalToData(null)).toBeNull();
  });
});

describe("Tableros by rival", () => {
  const rows = [{ id: "a", rival: "MAD SKY" }, { id: "b" }, { id: "c", rival: "mad sky " }, { id: "d", rival: "Los Rayos" }];
  it("lists each rival once, in order", () => {
    expect(rivalOptions(rows)).toEqual(["MAD SKY", "Los Rayos"]);
  });
  it("keeps the boards against that rival (any case), or all", () => {
    expect(filterByRival(rows, "MAD SKY").map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterByRival(rows, null)).toBe(rows);
  });
});
