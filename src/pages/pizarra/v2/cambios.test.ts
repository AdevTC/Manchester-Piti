import { describe, expect, it } from "vitest";
import type { Lineup, Sub, Zone } from "../formations";
import { slotZone } from "./geometry";
import {
  addSub,
  brokenSubs,
  checkSub,
  exactGrade,
  fitCost,
  generateWaves,
  lineupAt,
  minutesTable,
  moveWave,
  nextWaveMinute,
  plannedMinutes,
  playedFromActa,
  replan,
  seatsAt,
  SUBS_MAX,
  wavesOf,
  wavesTxt,
} from "./cambios";
import { cromo, demoSquad, lineupOf, squadOf } from "./testkit";
import { logicGrade } from "./encaje";
import type { Cromo, Squad } from "./model";
import { lineOf, type PosCode } from "../../../lib/positions";

// Los cambios por tandas: who is on at each minute, the minutes each one plays, the checks of a cambio,
// «Repartir minutos» (fair, the keeper fixed, each one to his line) and «Recalcular» from the acta.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = (): Lineup => lineupOf(SEVEN, "2-3-1", sq);
const sub = (id: string, min: number, out: string, inn: string): Sub => ({ id, min, out, in: inn });
const nm = (id: string) => sq.byId.get(id)?.name ?? id;
const nat = (id: string): Zone | undefined => sq.byId.get(id)?.pos;
const zonesOf = (L: Lineup): Zone[] => L.slots.map((_, i) => slotZone(L, i));
let n = 0;
const newId = () => "g" + ++n;

describe("who is on the pitch at each minute", () => {
  const subs = [sub("a", 25, "adrian", "kevin"), sub("b", 25, "tello", "fer"), sub("c", 40, "kevin", "erik")];

  it("groups the subs of the same minute into one tanda, in match order", () => {
    expect(wavesOf([subs[2], subs[0], subs[1]]).map((w) => [w.min, w.subs.map((s) => s.id)])).toEqual([
      [25, ["a", "b"]],
      [40, ["c"]],
    ]);
  });

  it("the seats before, at and after each tanda (the minute's own subs made)", () => {
    expect(seatsAt(L7(), subs, 24).seats).toEqual(SEVEN);
    expect(seatsAt(L7(), subs, 25).seats[6]).toBe("kevin");
    expect(seatsAt(L7(), subs, 25).seats[2]).toBe("fer");
    expect(seatsAt(L7(), subs, 49).seats[6]).toBe("erik");
  });

  it("a cambio that can't be made is flagged and changes nothing", () => {
    const bad = [sub("x", 10, "kevin", "erik"), sub("y", 12, "adrian", "evans")];
    expect([...brokenSubs(L7(), bad)]).toEqual(["x", "y"]);
    expect(seatsAt(L7(), bad, 49).seats).toEqual(SEVEN);
    expect(brokenSubs(L7(), [sub("z", 50, "adrian", "kevin")], 50).has("z")).toBe(true);
  });

  it("the seven at a minute wears its galones: the vice takes the brazalete, the next taker the penaltis", () => {
    const L = { ...L7(), roles: { captainId: "adrian", viceId: "illescas", penaltiesId: "adrian" }, takers: { penalties: ["adrian", "kevin"], freekicks: [], corners: [] } };
    const at30 = lineupAt(L, subs, 30);
    expect(at30.slots[6].playerId).toBe("kevin");
    expect(at30.roles.captainId).toBe("illescas");
    expect(at30.roles.penaltiesId).toBe("kevin");
    // before the cambio, the board's own
    expect(lineupAt(L, subs, 10).roles.captainId).toBe("adrian");
  });
});

describe("the minutes", () => {
  it("adds up each one's time on the pitch: the seven, 350 between them", () => {
    const m = plannedMinutes(L7(), [sub("a", 20, "adrian", "kevin"), sub("b", 35, "kevin", "adrian")], 50);
    expect(m.get("adrian")).toBe(35);
    expect(m.get("kevin")).toBe(15);
    expect(m.get("evans")).toBe(50);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(350);
  });

  it("the table: the fair share with the keeper fixed, who eats bench, and how far each one is", () => {
    const t = minutesTable(L7(), [sub("a", 25, "adrian", "kevin")], ["kevin", "erik", "fer"], 50, true);
    expect(t.fair).toBeCloseTo(300 / 9);
    expect(t.txt).toBe("7 × 50′ = 350′ · 9 de campo a 33′ cada uno · el portero, fijo");
    expect(t.rows[0]).toMatchObject({ id: "evans", keeper: true, min: 50, delta: "" });
    expect(t.eaten.sort()).toEqual(["erik", "fer"]);
    const kevin = t.rows.find((r) => r.id === "kevin");
    expect(kevin).toMatchObject({ min: 25, delta: "−8′", starter: false });
    expect(t.rows.find((r) => r.id === "tello")).toMatchObject({ off: "hi", delta: "+17′" });
    // the keeper rotating: seven places shared by all of them
    expect(minutesTable(L7(), [], ["kevin"], 50, false).fair).toBeCloseTo(350 / 8);
  });
});

describe("editing a tanda", () => {
  it("checks the minute and who leaves / comes in, against the cambios before it", () => {
    const subs = [sub("a", 20, "adrian", "kevin")];
    expect(checkSub(L7(), subs, sub("n", 50, "tello", "erik"), 50, nm)).toEqual({ ok: false, why: "El cambio va entre el 1′ y el 49′" });
    expect(checkSub(L7(), subs, sub("n", 30, "adrian", "erik"), 50, nm).why).toBe("ADRIAN no está en el campo en el 30′");
    expect(checkSub(L7(), subs, sub("n", 30, "tello", "kevin"), 50, nm).why).toBe("KEVIN ya está en el campo en el 30′");
    expect(checkSub(L7(), subs, sub("n", 30, "kevin", "adrian"), 50, nm).ok).toBe(true);
    expect(checkSub(L7(), subs, sub("n", 10, "kevin", "erik"), 50, nm).ok).toBe(false);
  });

  it("moves a whole tanda (kept inside the match), adds up to 20 and finds the next minute", () => {
    const subs = [sub("a", 20, "adrian", "kevin"), sub("b", 20, "tello", "fer")];
    expect(moveWave(subs, 20, 27, 50).map((s) => s.min)).toEqual([27, 27]);
    expect(moveWave(subs, 20, 80, 50).map((s) => s.min)).toEqual([49, 49]);
    const full = Array.from({ length: SUBS_MAX }, (_, k) => sub("s" + k, 1 + k, "a", "b"));
    expect(addSub(full, sub("z", 30, "a", "b"))).toHaveLength(SUBS_MAX);
    expect(nextWaveMinute([], 50)).toBe(25);
    expect(nextWaveMinute(subs, 50)).toBe(35);
    expect(nextWaveMinute([], 50, 30)).toBe(31);
  });

  it("says the tandas in words", () => {
    expect(wavesTxt([sub("a", 20, "adrian", "kevin"), sub("b", 20, "tello", "fer")], nm)).toEqual(["20′ · KEVIN por ADRIAN, FER por TELLO"]);
  });
});

describe("«Repartir minutos»", () => {
  const gen = (o: Partial<Parameters<typeof generateWaves>[0]> = {}) => {
    const L = L7();
    return {
      L,
      subs: generateWaves({ seats: L.slots.map((s) => s.playerId), zones: zonesOf(L), pool: ["kevin", "erik", "fer"], from: 0, duration: 50, rotateKeeper: false, nat, newId, ...o }),
    };
  };

  it("shares the minutes out fairly among the ten, the keeper fixed for the whole match", () => {
    const { L, subs } = gen();
    const m = plannedMinutes(L, subs, 50);
    expect(brokenSubs(L, subs, 50).size).toBe(0);
    expect(m.get("evans")).toBe(50);
    expect(subs.some((s) => s.out === "evans" || s.in === "evans")).toBe(false);
    const field = [...m.entries()].filter(([id]) => id !== "evans").map(([, v]) => v);
    expect(field).toHaveLength(9);
    // every one of the nine plays, and nobody is far from the 33′ each
    expect(Math.min(...field)).toBeGreaterThanOrEqual(25);
    expect(Math.max(...field) - Math.min(...field)).toBeLessThanOrEqual(12);
    expect(subs.length).toBeLessThanOrEqual(SUBS_MAX);
    subs.forEach((s) => expect(s.min).toBeGreaterThanOrEqual(1));
    subs.forEach((s) => expect(s.min).toBeLessThanOrEqual(49));
  });

  it("each one comes on in his own line when it can (a forward for a forward)", () => {
    const { L, subs } = gen({ pool: ["kevin"] });
    expect(subs.length).toBeGreaterThan(0);
    const first = subs[0];
    expect(first.in).toBe("kevin");
    const i = L.slots.findIndex((s) => s.playerId === first.out);
    expect(slotZone(L, i)).toBe("DEL");
  });

  it("«rotar portero»: the goal is shared between the two keepers", () => {
    const { L, subs } = gen({ pool: ["fer"], rotateKeeper: true });
    const m = plannedMinutes(L, subs, 50);
    expect(subs.some((s) => s.out === "evans" && s.in === "fer")).toBe(true);
    expect(Math.abs((m.get("evans") ?? 0) - (m.get("fer") ?? 0))).toBeLessThanOrEqual(12);
  });

  it("nobody on the bench: no cambios", () => {
    expect(gen({ pool: [] }).subs).toEqual([]);
  });
});

describe("the live match", () => {
  it("minutes played from the acta: the starters, the cambios and a red card", () => {
    const ev = [
      { type: "substitution", minute: 20, playerId: "adrian", inPlayerId: "kevin" },
      { type: "red_card", minute: 30, playerId: "tello" },
      { type: "goal", minute: 31, playerId: "kevin" },
    ];
    const m = playedFromActa(SEVEN, ev, 40);
    expect(m.get("adrian")).toBe(20);
    expect(m.get("kevin")).toBe(20);
    expect(m.get("tello")).toBe(30);
    expect(m.get("evans")).toBe(40);
  });

  it("«Recalcular» keeps what was planned before now, puts the plan in line with the pitch and re-plans the rest", () => {
    const L = L7();
    const planned = [sub("a", 10, "adrian", "kevin"), sub("b", 30, "tello", "erik")];
    // in the match, ERIK came on for ADRIÁN at 10 instead; ILLESCAS is hurt
    const field = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "erik"];
    const next = replan({
      L,
      subs: planned,
      from: 22,
      duration: 50,
      field,
      pool: ["kevin", "fer", "adrian"],
      played: new Map(),
      unavailable: new Set(["illescas"]),
      rotateKeeper: false,
      nat,
      zones: zonesOf(L),
      newId,
    });
    expect(next[0]).toEqual(planned[0]);
    // the fix: the plan's KEVIN is ERIK on the pitch
    expect(next).toContainEqual(expect.objectContaining({ min: 23, out: "kevin", in: "erik" }));
    // the hurt one leaves in the first new tanda, and nothing new happens before now
    const out = next.find((s) => s.out === "illescas");
    expect(out?.min).toBe(24);
    expect(next.filter((s) => s.id !== "a").every((s) => s.min > 22)).toBe(true);
    expect(brokenSubs(L, next, 50).size).toBe(0);
    expect(seatsAt(L, next, 49).seats).not.toContain("illescas");
  });
});

describe("cambios by encaje (exact positions)", () => {
  // 2-3-1: POR · DFC DFC · MI MC MD · DC
  const x = (id: string, num: number, main: PosCode, also: PosCode[] = [], extra: Partial<Cromo> = {}) => cromo(id, num, lineOf(main), { ps: { main, also, line: lineOf(main) }, ...extra });
  const XS = ["gk", "d1", "d2", "mi", "mc", "md", "dc"];
  const base = [x("gk", 1, "POR"), x("d1", 2, "DFC"), x("d2", 3, "DFC"), x("mi", 4, "MI"), x("mc", 5, "MC"), x("md", 6, "MD"), x("dc", 9, "DC")];
  const setup = (bench: Cromo[]) => {
    const s = squadOf([...base, ...bench]);
    const L = lineupOf(XS, "2-3-1", s);
    return { s, L };
  };
  const natS = (s: Squad) => (id: string): Zone | undefined => s.byId.get(id)?.pos;
  const genX = (s: Squad, L: Lineup, o: Partial<Parameters<typeof generateWaves>[0]>, exact = true) =>
    generateWaves({
      seats: L.slots.map((q) => q.playerId),
      zones: zonesOf(L),
      pool: [],
      from: 0,
      duration: 50,
      rotateKeeper: false,
      nat: natS(s),
      grade: exact ? (id, i) => logicGrade(L, s, id, i) : undefined,
      newId,
      ...o,
    });

  it("the one coming on takes the slot of his exact position, not just one of his line", () => {
    const { s, L } = setup([x("x", 12, "MD")]);
    expect(genX(s, L, { pool: ["x"] })[0]).toMatchObject({ in: "x", out: "md" });
    // (by line alone, the first medio)
    expect(genX(s, L, { pool: ["x"] }, false)[0]).toMatchObject({ in: "x", out: "mi" });
  });

  it("adaptado before fuera: a lateral derecho goes in for the interior derecho, not for the one with most minutes", () => {
    const { s, L } = setup([x("x", 12, "LD")]);
    const played = new Map([
      ["mi", 30],
      ["mc", 30],
      ["md", 29],
      ["dc", 30],
    ]);
    expect(genX(s, L, { pool: ["x"], played })[0]).toMatchObject({ in: "x", out: "md" });
    expect(genX(s, L, { pool: ["x"], played }, false)[0]).toMatchObject({ in: "x", out: "mi" });
  });

  it("who can't go on is replaced by whoever is in place there first, then by the fewest minutes", () => {
    const { s, L } = setup([x("y", 12, "MI"), x("z", 13, "MD")]);
    const played = new Map([["z", 5]]);
    expect(genX(s, L, { pool: ["y", "z"], played, out: new Set(["md"]) })[0]).toMatchObject({ min: 1, in: "z", out: "md" });
    expect(genX(s, L, { pool: ["y", "z"], played, out: new Set(["md"]) }, false)[0]).toMatchObject({ min: 1, in: "y", out: "md" });
  });

  it("an injured keeper: a declared keeper (también POR) goes in goal before the one with fewer minutes", () => {
    const { s, L } = setup([x("k2", 12, "DFC", ["POR"]), x("o", 13, "DC")]);
    const played = new Map([["k2", 10]]);
    expect(genX(s, L, { pool: ["k2", "o"], played, out: new Set(["gk"]) })[0]).toMatchObject({ min: 1, in: "k2", out: "gk" });
  });

  it("«Recalcular»: the plan put in line with the pitch matches each one to the slot he is in place in", () => {
    const { s, L } = setup([x("z", 13, "MD"), x("y", 12, "MI")]);
    const field = ["gk", "d1", "d2", "z", "mc", "y", "dc"];
    const re = (exact: boolean) =>
      replan({
        L,
        subs: [],
        from: 20,
        duration: 50,
        field,
        pool: [],
        played: new Map(),
        unavailable: new Set(),
        rotateKeeper: false,
        nat: natS(s),
        grade: exact ? (id, i) => logicGrade(L, s, id, i) : undefined,
        zones: zonesOf(L),
        newId,
      });
    const fix = (subs: Sub[]) => subs.filter((q) => q.min === 21).map((q) => [q.out, q.in]);
    expect(fix(re(true))).toEqual([
      ["mi", "y"],
      ["md", "z"],
    ]);
    expect(fix(re(false))).toEqual([
      ["mi", "z"],
      ["md", "y"],
    ]);
  });

  it("the cost of a cambio out of place: fuera 1, adaptado ½, in place or unknown 0; by line, 1 off his line", () => {
    const { s, L } = setup([x("x", 12, "LD"), cromo("u", 13, undefined)]);
    const g = { nat: natS(s), zones: zonesOf(L), grade: (id: string, i: number) => logicGrade(L, s, id, i) };
    expect(fitCost(g, "x", 3)).toBe(1);
    expect(fitCost(g, "x", 5)).toBe(0.5);
    expect(fitCost(g, "md", 5)).toBe(0);
    expect(fitCost(g, "u", 5)).toBe(0);
    const line = { nat: natS(s), zones: zonesOf(L) };
    expect(fitCost(line, "x", 3)).toBe(1);
    expect(fitCost(line, "x", 1)).toBe(0);
    expect(fitCost(line, "u", 3)).toBe(0);
  });

  it("exact grades only when someone has an exact position (a squad known by lines keeps today's logic)", () => {
    const { s, L } = setup([]);
    expect(exactGrade(L, s, XS)?.("md", 5)).toBe(3);
    expect(exactGrade(L7(), sq, SEVEN)).toBeUndefined();
  });
});
