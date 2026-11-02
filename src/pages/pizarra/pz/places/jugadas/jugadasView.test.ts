import { describe, expect, it } from "vitest";
import type { PzSlot } from "../../store/types";
import type { Play } from "../../../plays";
import { boardBytes, setDurAt, setKeyAt, setStrokesAt, sizeState, SIZE_FULL, SIZE_WARN, addStepEnd, bendTo, castOf, delStepAt, dupStepAt, fromSteps, keyStep, moveStepTo, nudgeIn, ownPlay, parseAt, atText, playSig, stepPaths, teamPlays, videoError, zoomOf, addRivalAll, removeRivalAll, type PjStep } from "./jugadasView";

const SLOTS: PzSlot[] = [
  { code: "POR", x: 50, y: 92, playerId: "evans" },
  { code: "DFC", x: 30, y: 72, playerId: "fer" },
  { code: "DFC", x: 70, y: 72, playerId: "erik" },
  { code: "LI", x: 18, y: 50, playerId: "jordi" },
  { code: "MC", x: 50, y: 55, playerId: "adrian" },
  { code: "LD", x: 82, y: 50, playerId: "eguzquiza" },
  { code: "DC", x: 50, y: 25, playerId: null },
];
const step = (o: Partial<PjStep> = {}): PjStep => ({ title: "Paso", note: "", p: SLOTS.map((s) => [s.x, s.y]), r: [[50, 6]], b: [50, 88], dur: 2.3, c: {}, bk: null, ...o });

describe("jugadasView · the team's plays cast onto the seven", () => {
  it("keeps the keeper in goal and builds every library play by slot (empty slots included)", () => {
    const plays = teamPlays(SLOTS, () => null);
    expect(plays.length).toBe(8);
    const c = plays[0];
    expect(c.id).toBe("lib-corner");
    expect(c.steps[0].p.length).toBe(7);
    expect(c.steps[0].p[0]).toEqual([50, 90]);
    // the app's play keeps only the seven who are on the board (the empty DC is not a key)
    expect(Object.keys(c.play.frames[0].players).sort()).toEqual(["adrian", "eguzquiza", "erik", "evans", "fer", "jordi"]);
  });
  it("sends the galón holder to the dead ball", () => {
    const base = teamPlays(SLOTS, () => null)[0];
    const withTaker = teamPlays(SLOTS, (r) => (r === "cornersId" ? "fer" : null))[0];
    const fer = 1;
    // the corner taker's spot in the first step is the far corner flag (95, 4)
    expect(base.steps[0].p[fer]).not.toEqual([95, 4]);
    expect(withTaker.steps[0].p[fer]).toEqual([95, 4]);
  });
  it("castOf is a permutation with the keeper first", () => {
    const cast = castOf(teamPlays(SLOTS, () => null)[0].steps[0].p, SLOTS);
    expect(cast[0]).toBe(0);
    expect([...cast].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("jugadasView · own plays read by slot and written back", () => {
  const play: Play = {
    id: "j1",
    name: "Salida",
    kind: "propia",
    frames: [
      { players: { evans: { x: 50, y: 92 }, fer: { x: 30, y: 72 }, kevin: { x: 50, y: 25 } }, ball: { x: 50, y: 88 }, rivals: [{ id: "r1", x: 50, y: 6 }], arrows: [], title: "Salida" },
      { players: { evans: { x: 50, y: 92 }, fer: { x: 20, y: 50 }, kevin: { x: 60, y: 20 } }, ball: { x: 20, y: 50 }, rivals: [{ id: "r1", x: 45, y: 10 }], arrows: [], curves: { fer: { x: 10, y: 60 } } },
    ],
  };
  it("the seven plays it: one who left the seven runs in a free slot, others stand still", () => {
    const pj = ownPlay(play, SLOTS);
    expect(pj.ids[0]).toBe("evans");
    expect(pj.ids[1]).toBe("fer");
    expect(pj.ids[6]).toBe("kevin"); // kevin is not in the seven: he runs from the DC's empty slot
    expect(pj.steps[1].p[1]).toEqual([20, 50]);
    expect(pj.steps[1].c.m1).toEqual([10, 60]);
    expect(pj.steps[1].p[4]).toEqual([50, 55]); // adrian is not in the play: he stands at his slot
    expect(pj.steps[0].title).toBe("Salida");
    expect(pj.steps[1].title).toBe("Paso 2");
  });
  it("round-trips: positions, curves, rivals, texts and derived arrows", () => {
    const pj = ownPlay(play, SLOTS);
    const back = fromSteps(pj, pj.steps);
    expect(back.frames[1].players.fer).toEqual({ x: 20, y: 50 });
    expect(back.frames[1].curves).toEqual({ fer: { x: 10, y: 60 } });
    expect(back.frames[1].rivals).toEqual([{ id: "r1", x: 45, y: 10 }]);
    expect(back.frames[0].arrows.some((a) => a.kind === "pase" || a.kind === "conduccion")).toBe(true);
    expect(back.frames[1].title).toBe("Paso 2");
  });
  it("keeps the ball's way as chosen (pase / conducción)", () => {
    const pj = ownPlay(play, SLOTS);
    const steps = pj.steps.map((s, k) => (k === 1 ? { ...s, bk: "conduccion" as const } : s));
    const back = fromSteps(pj, steps);
    expect(back.frames[0].arrows[0].kind).toBe("conduccion");
    expect(ownPlay(back, SLOTS).steps[1].bk).toBe("conduccion");
  });
  it("keeps the video and the acta's moment", () => {
    const pj = ownPlay({ ...play, video: { url: "https://youtu.be/x", at: 90 }, moment: { matchId: "j2", min: 23 } }, SLOTS);
    const back = fromSteps(pj, pj.steps);
    expect(back.video).toEqual({ url: "https://youtu.be/x", at: 90 });
    expect(back.moment).toEqual({ matchId: "j2", min: 23 });
  });
});

describe("jugadasView · step operations (B-PZ-08, B-PZ-16)", () => {
  const s0 = step({ title: "A" });
  const s1 = step({ title: "B", p: SLOTS.map((s) => [s.x, s.y - 10]), c: { m1: [10, 10] } });
  const s2 = step({ title: "C", p: SLOTS.map((s) => [s.x + 5, s.y - 20]), c: { m2: [40, 40] } });
  it("B-PZ-16: «Paso al final» copies the LAST step, without its curves", () => {
    const out = addStepEnd([s0, s1, s2])!;
    expect(out.length).toBe(4);
    expect(out[3].p).toEqual(s2.p);
    expect(out[3].c).toEqual({});
  });
  it("B-PZ-08: duplicating a step never copies its curves, and lands right behind it", () => {
    const out = dupStepAt([s0, s1, s2], 1)!;
    expect(out[2].p).toEqual(s1.p);
    expect(out[2].c).toEqual({});
    expect(out[2].title).toBe("B (otra vez)");
    expect(out[3].title).toBe("C");
  });
  it("reordering straightens only the steps whose previous step changed", () => {
    const out = moveStepTo([s0, s1, s2], 2, 1)!;
    expect(out.map((s) => s.title)).toEqual(["A", "C", "B"]);
    expect(out[1].c).toEqual({});
    expect(out[2].c).toEqual({});
    const same = moveStepTo([s0, s1, s2, step({ title: "D", c: { m3: [1, 1] } })], 0, 1)!;
    expect(same[3].c).toEqual({ m3: [1, 1] });
  });
  it("keeps 2 to 8 steps", () => {
    expect(delStepAt([s0, s1], 0)).toBeNull();
    expect(addStepEnd(Array.from({ length: 8 }, () => s0))).toBeNull();
    expect(delStepAt([s0, s1, s2], 0)!.map((s) => s.title)).toEqual(["B", "C"]);
  });
  it("nudges pieces inside the lines and bends a run through its handle", () => {
    const out = nudgeIn([s0, s1], 1, ["m0", "b", "r0"], 60, 0);
    expect(out[1].p[0][0]).toBe(99);
    expect(out[1].b![0]).toBe(99);
    expect(out[1].r[0][0]).toBe(99);
    const bent = bendTo([s0, s1], 1, 3, [30, 45]);
    expect(bent[1].c.m3).toBeDefined();
    const straight = bendTo(bent, 1, 3, [18, 45]);
    expect(straight[1].c.m3).toBeUndefined();
  });
  it("adds a rival to every step (≤ 7) and removes one from all", () => {
    const out = addRivalAll([s0, s1])!;
    expect(out.every((s) => s.r.length === 2)).toBe(true);
    expect(removeRivalAll(out, 0).every((s) => s.r.length === 1)).toBe(true);
  });
});

describe("jugadasView · what the pitch draws", () => {
  it("rings where each one was and curved runs; the ball's way", () => {
    const a = step();
    const b = step({ p: a.p.map((q, k) => (k === 1 ? [q[0], q[1] - 30] : q)), b: [30, 40], c: { m1: [10, 55] } });
    const paths = stepPaths([a, b], 1, { ghost: true, trails: true, ball: true });
    expect(paths.filter((p) => p.kind === "zona").length).toBe(1);
    const run = paths.find((p) => p.kind === "carrera")!;
    expect(run.pts!.length).toBe(13);
    expect(paths.some((p) => p.kind === "pase" || p.kind === "conduccion")).toBe(true);
  });
  it("the key step is the one with most movement", () => {
    const a = step();
    const b = step({ p: a.p.map((q) => [q[0], q[1] - 2]) });
    const c = step({ p: a.p.map((q) => [q[0], q[1] - 30]) });
    expect(keyStep([a, b, c])).toBe(2);
  });
  it("zooms flat on a set piece and not on a whole-pitch play", () => {
    const corner = teamPlays(SLOTS, () => null)[0];
    expect(zoomOf(corner.steps, { phone: false, editing: false })).not.toBeNull();
    const salida = teamPlays(SLOTS, () => null).find((p) => p.kind === "salida")!;
    expect(zoomOf(salida.steps, { phone: false, editing: false })).toBeNull();
  });
  it("B-PZ-10: the signature changes with what a video shows (and the speed)", () => {
    const pj = teamPlays(SLOTS, () => null)[0];
    const s1 = playSig(pj, 1);
    expect(playSig(pj, 1)).toBe(s1);
    expect(playSig(pj, 2)).not.toBe(s1);
    expect(playSig({ ...pj, steps: nudgeIn(pj.steps, 1, ["m2"], 3, 0) }, 1)).not.toBe(s1);
  });
});

describe("jugadasView · the video link", () => {
  it("reads «12:34» and says what is wrong", () => {
    expect(parseAt("12:34")).toBe(754);
    expect(parseAt("1:02:03")).toBe(3723);
    expect(parseAt("")).toBe(0);
    expect(parseAt("12.34")).toBeNull();
    expect(atText(754)).toBe("12:34");
    expect(videoError("", "")).toMatch(/Pega/);
    expect(videoError("http://x.com/a", "")).toMatch(/https/);
    expect(videoError("https://youtu.be/abcdef", "1x")).toMatch(/12:34/);
    expect(videoError("https://youtu.be/abcdef", "0:45")).toBe("");
  });
});

describe("jugadasView · the step's length, «Paso clave», strokes (frames[].dur / key / d)", () => {
  const play: Play = {
    id: "j2",
    name: "Con todo",
    kind: "propia",
    frames: [
      { players: { evans: { x: 50, y: 92 } }, ball: { x: 50, y: 88 }, rivals: [], arrows: [], dur: 1500 },
      { players: { evans: { x: 50, y: 80 } }, ball: { x: 50, y: 70 }, rivals: [], arrows: [], key: true, d: [{ id: "k1", kind: "zona", color: "gold", points: [{ x: 10, y: 10 }, { x: 30, y: 30 }] }] },
    ],
  };
  it("reads and writes them back", () => {
    const pj = ownPlay(play, SLOTS);
    expect(pj.steps[0].dur).toBe(1.5);
    expect(pj.steps[1].dur).toBe(2.6);
    expect(pj.steps[1].key).toBe(true);
    expect(pj.steps[1].d?.length).toBe(1);
    const back = fromSteps(pj, pj.steps);
    expect(back.frames[0].dur).toBe(1500);
    expect(back.frames[1].dur).toBe(2600);
    expect(back.frames[0].key).toBeUndefined();
    expect(back.frames[1].key).toBe(true);
    expect(back.frames[1].d).toEqual(play.frames[1].d);
  });
  it("a marked step is the key one; one at a time; unmarked = most movement", () => {
    const pj = ownPlay(play, SLOTS);
    expect(keyStep(pj.steps)).toBe(1);
    const k0 = setKeyAt(pj.steps, 0, true);
    expect(k0.map((s) => !!s.key)).toEqual([true, false]);
    expect(keyStep(setKeyAt(pj.steps, 1, false))).toBe(1);
  });
  it("length in half seconds 0,5–5; strokes ≤ 8; a new step copies neither the key nor the strokes", () => {
    const pj = ownPlay(play, SLOTS);
    expect(setDurAt(pj.steps, 0, 9)[0].dur).toBe(5);
    expect(setDurAt(pj.steps, 0, 0.1)[0].dur).toBe(0.5);
    const many = Array.from({ length: 10 }, (_, k) => ({ id: "k" + k, kind: "pase" as const, color: "white" as const, points: [{ x: 1, y: 1 }, { x: 9, y: 9 }] }));
    expect(setStrokesAt(pj.steps, 0, many)[0].d?.length).toBe(8);
    expect(setStrokesAt(pj.steps, 1, [])[1].d).toBeUndefined();
    const added = addStepEnd(pj.steps)!;
    expect(added[2].key).toBeUndefined();
    expect(added[2].d).toBeUndefined();
  });
});

describe("jugadasView · the board's size (1 MiB per document)", () => {
  it("counts UTF-8 bytes and says ok · warn · full", () => {
    expect(boardBytes({ a: "ñ" })).toBe(10);
    expect(sizeState(SIZE_WARN - 1)).toBe("ok");
    expect(sizeState(SIZE_WARN)).toBe("warn");
    expect(sizeState(SIZE_FULL)).toBe("full");
    expect(SIZE_FULL).toBeLessThan(1_048_576);
  });
});
