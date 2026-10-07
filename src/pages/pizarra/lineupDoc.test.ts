import { describe, expect, it } from "vitest";
import { makeStroke } from "./drawings";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupMeta } from "./lineupDoc";
import { seedLineup } from "./lineupOps";
import { newPlay } from "./plays";

const meta: LineupMeta = { ownerUid: "u", ownerNickname: "piti", seasonId: "s", name: "Mi siete", isOfficial: false, matchId: null };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;

describe("lineup document: drawings and jugadas", () => {
  it("loads boards saved before drawings/jugadas existed with none", () => {
    const old = json(lineupToData(seedLineup("2-3-1", ["a", "b"]), meta));
    delete old.drawings;
    delete old.plays;
    const d = dataToLineupDoc("x", old);
    expect(d.drawings).toEqual([]);
    expect(d.plays).toEqual([]);
    expect(extractLineup(d).plays).toEqual([]);
  });

  it("round-trips strokes and jugadas, with no undefined in the write", () => {
    const lineup = seedLineup("2-3-1", ["a", "b"]);
    lineup.drawings = [makeStroke("pase", "gold", [{ x: 10, y: 10 }, { x: 40, y: 30 }])!, makeStroke("texto", "white", [{ x: 5, y: 5 }], "¡Arriba!")!];
    lineup.plays = [newPlay("Contra", { a: { x: 50, y: 90 }, b: { x: 30, y: 60 } })];
    const data = lineupToData(lineup, meta);
    expect(JSON.stringify(data)).not.toContain("undefined");
    const back = extractLineup(dataToLineupDoc("x", json(data)));
    expect(back.drawings).toEqual(lineup.drawings);
    expect(back.plays).toEqual(lineup.plays);
  });

  it("keeps the board when one stroke or jugada is corrupt", () => {
    const data = json(lineupToData(seedLineup("2-3-1", ["a"]), meta));
    data.drawings = [{ id: "k", kind: "pase", color: "rojo", points: [] }, { id: "k2", kind: "lapiz", color: "sky", points: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }];
    data.plays = [{ id: "j", name: "Rota", kind: "propia", frames: [] }];
    const d = dataToLineupDoc("x", data);
    expect(d.drawings.map((s) => s.id)).toEqual(["k2"]);
    expect(d.plays).toEqual([]);
    expect(d.slots).toHaveLength(7);
  });

  it("copies on extract (editing the board does not touch the loaded doc)", () => {
    const lineup = seedLineup("2-3-1", ["a"]);
    lineup.drawings = [makeStroke("carrera", "sky", [{ x: 10, y: 10 }, { x: 40, y: 30 }])!];
    const d = dataToLineupDoc("x", json(lineupToData(lineup, meta)));
    const l = extractLineup(d);
    l.drawings[0].points[0].x = 99;
    expect(d.drawings[0].points[0].x).toBe(10);
  });
});
