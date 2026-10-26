// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CARTEL_GAP, cartelLayout, spreadCromos } from "./cartel";
import { chemOf } from "./quimica";
import { oficialChange, readSeen, sevenIds, writeSeen } from "./oficialSeen";
import { demoSquad, lineupOf } from "./testkit";
import { dataToLineupDoc, extractLineup, lineupToData } from "../lineupDoc";
import { addVariant } from "./variants";
import { goFree } from "./ops";
import { FORMATION_NAMES } from "../formations";

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";

beforeEach(() => localStorage.clear());

describe("«El oficial ha cambiado»", () => {
  it("who comes in and who goes out since this device last saw it", () => {
    expect(oficialChange(null, SEVEN, nm)).toBeNull();
    expect(oficialChange(SEVEN, [...SEVEN].reverse(), nm)).toBeNull();
    expect(oficialChange(SEVEN, SEVEN.map((x) => (x === "adrian" ? "kevin" : x)), nm)).toBe("El oficial ha cambiado: entra KEVIN por ADRIAN");
    expect(oficialChange(SEVEN, SEVEN.slice(0, 6), nm)).toBe("El oficial ha cambiado: sale ADRIAN");
  });

  it("remembered per official on the device (and a broken store reads as nothing seen)", () => {
    expect(readSeen("o1")).toBeNull();
    writeSeen("o1", SEVEN);
    expect(readSeen("o1")).toEqual(SEVEN);
    localStorage.setItem("mp_pizarra_seen7:o2", "{roto");
    expect(readSeen("o2")).toBeNull();
    expect(sevenIds(lineupOf(["evans", null, "tello"], "2-3-1", sq))).toEqual(["evans", "tello"]);
  });
});

describe("the cartel in free mode", () => {
  it("two cromos on the same spot are nudged apart; a system's spots never move", () => {
    // every system's own spots (as the cartel lays them out) are already apart: nothing moves
    for (const f of FORMATION_NAMES) {
      const Lf = lineupOf(SEVEN, f, sq);
      const pts = cartelLayout(Lf, sq, chemOf(Lf, sq), "J8", "T1").cromos.map((c) => [c.x, c.y] as [number, number]);
      expect(spreadCromos(pts)).toEqual(pts);
    }
    const free = goFree(lineupOf(SEVEN, "2-3-1", sq));
    // MC and DC dragged onto the same spot
    const mc = free.slots[4];
    const stacked = { ...free, slots: free.slots.map((s, i) => (i === 6 ? { ...s, x: mc.x, y: mc.y } : s)) };
    const c = cartelLayout(stacked, sq, chemOf(stacked, sq), "J8", "T1").cromos;
    const a = c.find((x) => x.id === "huberoski")!;
    const b = c.find((x) => x.id === "adrian")!;
    expect(Math.abs(a.x - b.x) >= CARTEL_GAP.x - 0.2 || Math.abs(a.y - b.y) >= CARTEL_GAP.y - 0.2).toBe(true);
    // every pair is apart, inside the pitch
    c.forEach((p, i) =>
      c.slice(i + 1).forEach((q) => expect(Math.abs(p.x - q.x) >= CARTEL_GAP.x - 0.2 || Math.abs(p.y - q.y) >= CARTEL_GAP.y - 0.2).toBe(true)),
    );
    c.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(7);
      expect(p.x).toBeLessThanOrEqual(93);
    });
  });

  it("spreadCromos keeps the order and leaves apart ones alone", () => {
    expect(spreadCromos([[10, 10], [80, 80]])).toEqual([[10, 10], [80, 80]]);
    const out = spreadCromos([[50, 50], [50, 50]]);
    expect(Math.abs(out[0][0] - out[1][0])).toBeGreaterThanOrEqual(CARTEL_GAP.x - 0.2);
  });
});

describe("the variants in the store", () => {
  it("go to the doc and come back; an invalid one is dropped, a board without them has none", () => {
    const L = addVariant(lineupOf(SEVEN, "2-3-1", sq), "vb")!;
    const meta = { ownerUid: "u", ownerNickname: "yo", seasonId: "t1", name: "B", isOfficial: false, matchId: null };
    const data = lineupToData(L, meta);
    expect(Array.isArray(data.variants)).toBe(true);
    const back = extractLineup(dataToLineupDoc("b", data));
    expect(back.variants?.[0]).toMatchObject({ id: "vb", name: "Plan B", formation: "2-3-1" });
    expect(back.variants?.[0].slots.map((s) => s.playerId)).toEqual(SEVEN);
    const bad = dataToLineupDoc("b", { ...data, variants: [{ id: "zz", name: "X" }, (data.variants as unknown[])[0], (data.variants as unknown[])[0]] });
    expect(bad.variants?.map((v) => v.id)).toEqual(["vb"]);
    expect(dataToLineupDoc("b", { ...data, variants: "Plan B" }).variants).toEqual([]);
    const { variants: _v, ...old } = data;
    expect(dataToLineupDoc("b", old).variants).toEqual([]);
  });
});
