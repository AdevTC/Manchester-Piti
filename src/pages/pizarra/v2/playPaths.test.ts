import { describe, expect, it } from "vitest";
import { playSchema, PIZARRA_LIMITS } from "../../../lib/schemas";
import { newPlay, parsePlays, playPoseAt, playToData, type Play } from "../plays";
import type { Stroke } from "../drawings";
import { CAMS, proj } from "./geometry";
import { demoSquad, lineupOf } from "./testkit";
import { boardSpots, jugadaStage } from "./jugadas";
import { FX0 } from "./view";
import { holdMs } from "./replay";
import {
  bend,
  bendTo,
  controlFromMid,
  convertible,
  curveHandles,
  curveOf,
  drawingToPlay,
  midOf,
  rateFactor,
  rateLabel,
  RATES,
  setCurve,
  trailsDurOf,
} from "./playPaths";

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L = lineupOf(SEVEN, "2-3-1", sq);
const C = CAMS.top;

/** A jugada where adrian runs from (50, 40) to (50, 10). */
function run(): Play {
  const p = newPlay("Desmarque", { adrian: { x: 50, y: 40 }, huberoski: { x: 50, y: 60 } });
  return { ...p, frames: [p.frames[0], { ...p.frames[1], players: { ...p.frames[1].players, adrian: { x: 50, y: 10 } } }] };
}

describe("the replay's speed", () => {
  it("0,5× · 1× · 1,5×", () => {
    expect(RATES).toEqual([0.5, 1, 1.5]);
    expect(RATES.map(rateLabel)).toEqual(["0,5×", "1×", "1,5×"]);
    expect(rateFactor(0.5)).toBe(1.9);
    expect(rateFactor(1)).toBe(1);
    expect(rateFactor(1.5)).toBeCloseTo(2 / 3);
    expect(RATES.map(trailsDurOf)).toEqual(["3.2s", "1.7s", "1.1s"]);
  });
  it("holds each paso for its beat at that speed (and keeps the old 0,5× switch working)", () => {
    expect(holdMs(false, 1)).toBe(2300);
    expect(holdMs(false, 0.5)).toBe(holdMs(false, true));
    expect(holdMs(true, 1.5)).toBeCloseTo(2600 / 1.5);
    expect(holdMs(false, false)).toBe(2300);
  });
});

describe("curved paths", () => {
  it("the handle sits at the middle of the path; putting it elsewhere gives the control point back", () => {
    const a = { x: 10, y: 10 };
    const b = { x: 50, y: 10 };
    expect(midOf(a, undefined, b)).toEqual({ x: 30, y: 10 });
    const c = controlFromMid(a, { x: 30, y: 30 }, b);
    expect(c).toEqual({ x: 30, y: 50 });
    expect(midOf(a, c ?? undefined, b)).toEqual({ x: 30, y: 30 });
    expect(bend(a, c ?? a, b, 0.5)).toEqual({ x: 30, y: 30 });
    // close to straight: no curve
    expect(controlFromMid(a, { x: 30, y: 11 }, b)).toBeNull();
  });
  it("bends a run into a paso, keeps it in the store, and the replay follows it", () => {
    const p = run();
    const bent = bendTo(p, 1, "adrian", { x: 70, y: 25 });
    expect(curveOf(bent, 1, "adrian")).toEqual({ x: 90, y: 25 });
    expect(playSchema.safeParse(bent).success).toBe(true);
    expect(parsePlays([playToData(bent)])[0]).toEqual(bent);
    // halfway through the move (past the hold) the runner is off the straight line, towards the bend
    const straight = playPoseAt(p, 0.6).players.adrian;
    const curved = playPoseAt(bent, 0.6).players.adrian;
    expect(straight.x).toBeCloseTo(50);
    expect(curved.x).toBeGreaterThan(55);
    // and still ends where the paso says
    expect(playPoseAt(bent, 1).players.adrian).toEqual({ x: 50, y: 10 });
    // straightened again
    const back = bendTo(bent, 1, "adrian", { x: 50, y: 25 });
    expect(curveOf(back, 1, "adrian")).toBeUndefined();
    expect(back.frames[1].curves).toBeUndefined();
  });
  it("only bends a player of that paso, never the first paso, and no more than the cap", () => {
    const p = run();
    expect(setCurve(p, 0, "adrian", { x: 1, y: 1 })).toBe(p);
    expect(setCurve(p, 1, "nadie", { x: 1, y: 1 })).toBe(p);
    expect(setCurve(p, 1, "adrian", null)).toBe(p);
    const once = setCurve(p, 1, "adrian", { x: 1, y: 1 });
    expect(setCurve(once, 1, "adrian", { x: 1, y: 1 })).toBe(once);
    const curves = Object.fromEntries(Array.from({ length: PIZARRA_LIMITS.curves + 1 }, (_, k) => ["p" + k, { x: 1, y: 1 }]));
    expect(playSchema.safeParse({ ...p, frames: [p.frames[0], { ...p.frames[1], curves }] }).success).toBe(false);
  });
  it("offers a handle for each of ours who runs far enough into the paso", () => {
    const p = run();
    expect(curveHandles(p, 0, C, () => true)).toEqual([]);
    const hs = curveHandles(p, 1, C, () => true);
    expect(hs.map((h) => h.id)).toEqual(["adrian"]);
    const q = proj(C, 50, 25);
    expect(hs[0]).toMatchObject({ x: q.x.toFixed(2), y: q.y.toFixed(2), bent: false, mid: { x: 50, y: 25 } });
    expect(curveHandles(p, 1, C, (id) => id !== "adrian")).toEqual([]);
    expect(curveHandles(bendTo(p, 1, "adrian", { x: 70, y: 25 }), 1, C, () => true)[0].bent).toBe(true);
  });
  it("the estela and the glide follow the bend", () => {
    const p = bendTo(run(), 1, "adrian", { x: 70, y: 25 });
    const args = { play: p, frame: 1, L: lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq), sq, cam: "top" as const, meId: null, edit: true, selRival: null, onion: true, trails: true, rivals: true, ball: true, follow: false };
    const st = jugadaStage({ ...args, fx: { ...FX0, from: { adrian: [50, 50] } } });
    const tr = st.trails.find((t) => t.key === "adrian");
    const c = proj(C, 90, 25);
    expect(tr?.d).toContain("Q" + (Math.round(c.x * 10 * 10) / 10).toString());
    const card = st.cards.find((x) => x.id === "adrian");
    const m = proj(C, 70, 25);
    expect(card?.mx).toBe(m.x.toFixed(2));
    expect(card?.my).toBe(m.y.toFixed(2));
    // «Calco»: the ghost of the paso before is there (and goes with the toggle)
    expect(st.ghosts.map((g) => g.key)).toContain("adrian");
    expect(jugadaStage({ ...args, onion: false, fx: FX0 }).ghosts).toEqual([]);
  });
});

describe("«Convertir el dibujo en jugada»", () => {
  const spots = boardSpots(L);
  const from = (id: string, dx: number, dy: number, kind: Stroke["kind"], mid?: { x: number; y: number }): Stroke => {
    const a = spots[id];
    const b = { x: a.x + dx, y: a.y + dy };
    return { id: "s" + id + kind, kind, color: "gold", points: mid ? [a, mid, b] : [a, b] };
  };
  it("a carrera moves its runner (bent as drawn); a pase sends the ball from whoever has it", () => {
    const a = spots.adrian;
    const carrera = from("adrian", 20, -10, "carrera", { x: a.x + 14, y: a.y - 2 });
    const pase = from("huberoski", 0, -30, "pase");
    const pl = drawingToPlay([carrera, pase], L, "Del dibujo");
    expect(pl).not.toBeNull();
    const p = pl as Play;
    expect(playSchema.safeParse(p).success).toBe(true);
    expect(p.frames).toHaveLength(2);
    expect(p.name).toBe("Del dibujo");
    expect(p.frames[0].title).toBe("Salida");
    expect(p.frames[1].title).toBe("Lo dibujado");
    expect(p.frames[1].players.adrian).toEqual({ x: a.x + 20, y: a.y - 10 });
    expect(p.frames[1].players.tello).toEqual(p.frames[0].players.tello);
    expect(p.frames[1].curves?.adrian).toBeDefined();
    expect(p.frames[0].ball).toEqual(spots.huberoski);
    expect(p.frames[1].ball).toEqual({ x: spots.huberoski.x, y: spots.huberoski.y - 30 });
    // its arrows come from the moves (a pase and a carrera)
    expect(p.frames[0].arrows.map((x) => x.kind).sort()).toEqual(["carrera", "pase"]);
  });
  it("a conducción carries the ball with him", () => {
    const p = drawingToPlay([from("eguzquiza", 0, -20, "conduccion")], L, "x") as Play;
    expect(p.frames[0].ball).toEqual(spots.eguzquiza);
    expect(p.frames[1].ball).toEqual(p.frames[1].players.eguzquiza);
    expect(p.frames[0].arrows.some((x) => x.kind === "conduccion")).toBe(true);
  });
  it("nothing that starts on one of ours (or nobody on the pitch): no jugada", () => {
    const loose: Stroke = { id: "l", kind: "carrera", color: "gold", points: [{ x: 2, y: 2 }, { x: 9, y: 9 }] };
    const zona: Stroke = { id: "z", kind: "zona", color: "gold", points: [spots.adrian, { x: 9, y: 9 }] };
    expect(convertible([loose, zona])).toEqual([loose]);
    expect(drawingToPlay([loose, zona], L, "x")).toBeNull();
    expect(drawingToPlay([from("adrian", 10, 0, "carrera")], lineupOf([], "2-3-1", sq), "x")).toBeNull();
  });
});
