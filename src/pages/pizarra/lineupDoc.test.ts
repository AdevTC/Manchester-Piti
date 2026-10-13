import { describe, expect, it } from "vitest";
import { makeStroke } from "./drawings";
import { dataToLineupDoc, extractLineup, lineupToData, type LineupMeta } from "./lineupDoc";
import { getDroppedDocStats, resetDroppedDocStats } from "../../lib/docTelemetry";
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

  it("a malformed board opens repaired (a safe seven), never crashes, and the damage is reported", () => {
    resetDroppedDocStats();
    const data = json(lineupToData(seedLineup("3-2-1", ["a", "b", "c"]), meta));
    data.slots = [{ slotId: "s0", playerId: "a" }, "basura", { playerId: 7 }];
    data.formation = "9-9-9";
    data.roles = { captainId: 42 };
    data.tactics = { press: "Alta", nope: "x", width: 3 };
    data.playerPositions = { a: "PORTERO" };
    data.name = 12;
    data.isOfficial = "sí";
    data.matchId = { id: "m" };
    const d = dataToLineupDoc("x", data);
    expect(d.formation).toBe("2-3-1");
    expect(d.slots).toHaveLength(7);
    expect(d.slots.every((s) => typeof s.x === "number" && typeof s.zone === "string")).toBe(true);
    expect(d.roles).toEqual({});
    expect(d.tactics.press).toBe("Media"); // the whole map was invalid: defaults
    expect(d.playerPositions).toEqual({});
    expect(d.name).toBe("Sin nombre");
    expect(d.isOfficial).toBe(false);
    expect(d.matchId).toBeNull();
    // the board code that crashed on it works on the repaired doc
    expect(() => extractLineup(d).slots.map((s) => s.playerId)).not.toThrow();
    const stats = getDroppedDocStats();
    expect(stats["lineups.slots"]).toBe(1);
    expect(stats["lineups.formation"]).toBe(1);
    expect(stats["lineups.roles"]).toBe(1);
  });

  it("keeps who could be read from damaged slots; valid known tactics survive; coordinates are clamped", () => {
    const data = json(lineupToData(seedLineup("2-3-1", ["a", "b"]), meta));
    const slots = data.slots as Record<string, unknown>[];
    slots[3] = { ...slots[3], zone: "LATERAL" }; // one bad slot: the array is rebuilt…
    slots[1] = { ...slots[1], x: 140 };
    data.tactics = { press: "Alta", nope: "x" };
    const d = dataToLineupDoc("x", data);
    expect(d.slots.map((s) => s.playerId)).toEqual(["a", "b", null, null, null, null, null]); // …keeping a and b
    expect(d.tactics.press).toBe("Alta");
    expect(d.tactics).not.toHaveProperty("nope");
    const ok = dataToLineupDoc("y", { ...json(lineupToData(seedLineup("2-3-1", ["a"]), meta)), slots: slots.map((s, i) => (i === 3 ? (data.slots as unknown[])[0] : s)) });
    expect(ok.slots[1].x).toBe(100);
  });

  it("does not store the bench nor «pinned» (rebuilt from the squad); old docs with them still load", () => {
    const L = seedLineup("2-3-1", ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
    const data = lineupToData(L, meta);
    expect(data).not.toHaveProperty("bench");
    expect(data).not.toHaveProperty("pinned");
    expect(dataToLineupDoc("x", { ...json(data), bench: ["h", 3, "i"] }).bench).toEqual(["h", "i"]);
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

describe("lineup document: the 15 systems", () => {
  it("a board saved with a new system keeps it; an unknown id still falls back to 2-3-1", () => {
    const data = json(lineupToData(seedLineup("2-3-1", ["a"]), meta));
    expect(extractLineup(dataToLineupDoc("x", { ...data, formation: "4-1-1" })).formation).toBe("4-1-1");
    expect(extractLineup(dataToLineupDoc("y", { ...data, formation: "9-9-9" })).formation).toBe("2-3-1");
  });
});
