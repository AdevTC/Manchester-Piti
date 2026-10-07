import { describe, expect, it } from "vitest";
import { PIZARRA_LIMITS } from "../../lib/schemas";
import { seedLineup } from "./lineupOps";
import { libraryPlays, PLAY_LIBRARY } from "./playLibrary";
import {
  addArrow,
  addFrame,
  addRival,
  DEFAULT_RIVALS,
  deriveArrows,
  duplicateFrame,
  duplicatePlay,
  engineRivals,
  isValidPlay,
  moveBall,
  moveFrame,
  movePlayer,
  moveRival,
  newPlay,
  parsePlays,
  playPoseAt,
  playToData,
  removeArrow,
  removeFrame,
  removePlay,
  removeRival,
  renamePlay,
  savePlay,
  setFrameText,
  toEngineFrames,
  validatePlay,
  type Play,
} from "./plays";

const SEVEN = ["por", "d1", "d2", "mi", "mc", "md", "dc"];
const at = { por: { x: 50, y: 90 }, d1: { x: 33, y: 75 }, d2: { x: 67, y: 75 }, mi: { x: 22, y: 52 }, mc: { x: 50, y: 54 }, md: { x: 78, y: 52 }, dc: { x: 50, y: 22 } };
const fresh = () => newPlay("Contra", at);

describe("newPlay and the pasos", () => {
  it("starts with two equal pasos, the ball at the keeper and five rivals", () => {
    const p = fresh();
    expect(p.kind).toBe("propia");
    expect(p.frames).toHaveLength(2);
    expect(p.frames[1].players).toEqual(p.frames[0].players);
    expect(p.frames[0].ball).toEqual({ x: 50, y: 88 });
    expect(p.frames[0].rivals).toEqual(DEFAULT_RIVALS);
    expect(isValidPlay(p)).toBe(true);
  });

  it("adds a paso where the last ends (without its arrows), up to eight", () => {
    let p = addArrow(fresh(), 1, { from: { x: 50, y: 54 }, to: { x: 50, y: 30 }, kind: "carrera" });
    p = addFrame(p);
    expect(p.frames).toHaveLength(3);
    expect(p.frames[2].players).toEqual(p.frames[1].players);
    expect(p.frames[2].arrows).toEqual([]);
    for (let i = 0; i < 10; i++) p = addFrame(p);
    expect(p.frames).toHaveLength(PIZARRA_LIMITS.framesMax);
    expect(addFrame(p)).toBe(p);
  });

  it("duplicates a paso right after itself, deep-copied", () => {
    const p = duplicateFrame(movePlayer(fresh(), 0, "dc", { x: 40, y: 10 }), 0);
    expect(p.frames).toHaveLength(3);
    expect(p.frames[1].players.dc).toEqual({ x: 40, y: 10 });
    const q = movePlayer(p, 1, "dc", { x: 60, y: 10 });
    expect(q.frames[0].players.dc).toEqual({ x: 40, y: 10 });
    expect(p.frames[1].players.dc).toEqual({ x: 40, y: 10 }); // the original play is untouched
  });

  it("removes a paso but keeps at least two; ignores bad indices", () => {
    const p = addFrame(fresh());
    expect(removeFrame(p, 1).frames).toHaveLength(2);
    expect(removeFrame(fresh(), 0).frames).toHaveLength(2);
    expect(removeFrame(p, 7)).toBe(p);
    expect(duplicateFrame(p, -1)).toBe(p);
  });

  it("reorders pasos", () => {
    const p = setFrameText(addFrame(fresh()), 2, { title: "Remate" });
    const q = moveFrame(p, 2, 0);
    expect(q.frames[0].title).toBe("Remate");
    expect(moveFrame(p, 0, 0)).toBe(p);
  });

  it("sets and clears a paso's title and note within their limits", () => {
    const long = "x".repeat(300);
    const p = setFrameText(fresh(), 0, { title: long, note: long });
    expect(p.frames[0].title).toHaveLength(PIZARRA_LIMITS.frameTitle);
    expect(p.frames[0].note).toHaveLength(PIZARRA_LIMITS.frameNote);
    const q = setFrameText(p, 0, { title: "  ", note: "" });
    expect(q.frames[0].title).toBeUndefined();
    expect(q.frames[0].note).toBeUndefined();
  });
});

describe("moving things in a paso", () => {
  it("moves players, ball and rivals, clamped to the pitch", () => {
    let p = movePlayer(fresh(), 1, "dc", { x: 120, y: -5 });
    p = moveBall(p, 1, { x: 50.04, y: 101 });
    p = moveRival(p, 1, "r2", { x: -3, y: 33 });
    expect(p.frames[1].players.dc).toEqual({ x: 100, y: 0 });
    expect(p.frames[1].ball).toEqual({ x: 50, y: 100 });
    expect(p.frames[1].rivals.find((r) => r.id === "r2")).toEqual({ id: "r2", x: 0, y: 33 });
    expect(p.frames[0].players.dc).toEqual(at.dc);
    expect(moveRival(p, 1, "nadie", { x: 1, y: 1 })).toBe(p);
  });

  it("never puts more than seven of ours in a paso", () => {
    const p = fresh();
    expect(movePlayer(p, 0, "octavo", { x: 1, y: 1 })).toBe(p);
  });

  it("adds a rival to every paso (≤ 7) and removes it from all", () => {
    let p = addRival(fresh(), { x: 50, y: 60 });
    expect(p.frames.every((f) => f.rivals.some((r) => r.id === "r6"))).toBe(true);
    p = addRival(addRival(p, { x: 1, y: 1 }), { x: 2, y: 2 });
    expect(p.frames[0].rivals).toHaveLength(PIZARRA_LIMITS.rivals);
    expect(addRival(p, { x: 3, y: 3 })).toBe(p);
    p = removeRival(p, "r1");
    expect(p.frames.every((f) => !f.rivals.some((r) => r.id === "r1"))).toBe(true);
    expect(addRival(p, { x: 4, y: 4 }).frames[0].rivals.at(-1)?.id).toBe("r1");
  });

  it("adds arrows (≤ 10, not zero-length) and removes them", () => {
    let p = fresh();
    const arrow = { from: { x: 10, y: 10 }, to: { x: 30, y: 30 }, kind: "pase" as const };
    expect(addArrow(p, 0, { ...arrow, to: arrow.from })).toBe(p);
    for (let i = 0; i < 12; i++) p = addArrow(p, 0, arrow);
    expect(p.frames[0].arrows).toHaveLength(PIZARRA_LIMITS.arrows);
    expect(removeArrow(p, 0, 0).frames[0].arrows).toHaveLength(PIZARRA_LIMITS.arrows - 1);
    expect(removeArrow(p, 0, 99)).toBe(p);
  });
});

describe("playPoseAt", () => {
  // the MC carries it 30% up the pitch, then passes to the DC
  const play = (): Play => {
    let p = newPlay("Contra", at, { ball: { x: 50, y: 56 } });
    p = movePlayer(p, 1, "mc", { x: 50, y: 34 });
    p = moveBall(p, 1, { x: 50, y: 36 });
    p = addFrame(p);
    p = moveBall(p, 2, { x: 50, y: 20 });
    p = movePlayer(p, 2, "dc", { x: 50, y: 18 });
    p = addArrow(p, 0, { from: { x: 50, y: 56 }, to: { x: 50, y: 36 }, kind: "conduccion" });
    p = addArrow(p, 1, { from: { x: 50, y: 36 }, to: { x: 50, y: 20 }, kind: "pase" });
    return p;
  };

  it("starts on the first paso and ends on the last", () => {
    const p = play();
    const a = playPoseAt(p, 0), z = playPoseAt(p, 1);
    expect(a.frame).toBe(0);
    expect(a.players.mc).toEqual(at.mc);
    expect(a.ball).toEqual({ x: 50, y: 56, h: 0 });
    expect(z.frame).toBe(2);
    expect(z.players.dc).toEqual({ x: 50, y: 18 });
    expect(z.ball).toEqual({ x: 50, y: 20, h: 0 });
  });

  it("holds each paso first, then eases the run", () => {
    const p = play();
    expect(playPoseAt(p, 0.05).players.mc).toEqual(at.mc); // still in the hold of move 1
    const early = playPoseAt(p, 0.15).players.mc.y, mid = playPoseAt(p, 0.3).players.mc.y;
    expect(early).toBeLessThan(54);
    expect(54 - early).toBeLessThan(early - mid); // slow start (ease-in-out)
    expect(playPoseAt(p, 0.5).frame).toBe(1);
  });

  it("keeps the ball on the grass on a conducción and lifts it on a pase", () => {
    const p = play();
    for (const t of [0.1, 0.2, 0.3, 0.4]) expect(playPoseAt(p, t).ball.h).toBe(0);
    const flight = [0.6, 0.7, 0.8, 0.9].map((t) => playPoseAt(p, t).ball.h);
    expect(Math.max(...flight)).toBeGreaterThan(2);
    expect(Math.max(...flight)).toBeLessThanOrEqual(12);
  });

  it("carries missing entities forward and stays inside the pitch", () => {
    let p = newPlay("Al límite", { a: { x: 98, y: 2 } });
    p = movePlayer(p, 1, "a", { x: 100, y: 0 });
    p = addFrame(p);
    p = movePlayer(p, 2, "a", { x: 2, y: 2 });
    p = movePlayer(p, 2, "late", { x: 40, y: 40 }); // appears in the last paso only
    for (let k = 0; k <= 40; k++) {
      const pose = playPoseAt(p, k / 40);
      for (const q of [...Object.values(pose.players), ...pose.rivals, pose.ball]) {
        expect(q.x).toBeGreaterThanOrEqual(0);
        expect(q.x).toBeLessThanOrEqual(100);
        expect(q.y).toBeGreaterThanOrEqual(0);
        expect(q.y).toBeLessThanOrEqual(100);
      }
      expect(pose.players.late).toEqual({ x: 40, y: 40 });
    }
  });

  it("clamps t and survives NaN", () => {
    const p = play();
    expect(playPoseAt(p, -3)).toEqual(playPoseAt(p, 0));
    expect(playPoseAt(p, 9)).toEqual(playPoseAt(p, 1));
    expect(playPoseAt(p, Number.NaN)).toEqual(playPoseAt(p, 0));
  });
});

describe("a board's jugadas", () => {
  it("saves (adds or replaces), duplicates, removes, up to twelve", () => {
    const a = fresh();
    let list = savePlay([], a);
    list = savePlay(list, renamePlay(a, "Contra rápida"));
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Contra rápida");
    list = duplicatePlay(list, a.id);
    expect(list[1].name).toBe("Contra rápida (copia)");
    expect(list[1].id).not.toBe(a.id);
    expect(removePlay(list, a.id)).toHaveLength(1);
    const full = Array.from({ length: PIZARRA_LIMITS.plays }, fresh);
    expect(savePlay(full, fresh())).toBe(full);
    expect(duplicatePlay(full, full[0].id)).toBe(full);
  });

  it("refuses invalid jugadas and says why", () => {
    const one = { ...fresh(), frames: [fresh().frames[0]] };
    expect(savePlay([], one)).toEqual([]);
    expect(validatePlay(one)).toEqual([expect.stringContaining("entre 2 y 8 pasos")]);
    expect(validatePlay({ ...fresh(), name: "" })[0]).toContain("nombre");
    expect(validatePlay(fresh())).toEqual([]);
    expect(renamePlay(fresh(), "   ").name).toBe("Contra");
  });

  it("round-trips through storage and drops what does not validate", () => {
    const p = setFrameText(fresh(), 0, { title: "Salida" });
    const data = JSON.parse(JSON.stringify(playToData(p))) as unknown;
    expect(parsePlays([data])).toEqual([p]);
    expect(parsePlays(undefined)).toEqual([]);
    expect(parsePlays([{ ...p, kind: "chilena" }, { ...p, frames: [] }])).toEqual([]);
    expect(parsePlays(Array.from({ length: 20 }, () => data))).toHaveLength(PIZARRA_LIMITS.plays);
  });
});

describe("deriveArrows", () => {
  it("draws the ball's path and the long runs, at most four", () => {
    const a = newPlay("x", at).frames[0];
    const b = { ...a, ball: { x: 80, y: 40 }, players: { ...a.players, dc: { x: 70, y: 10 }, mi: { x: 23, y: 53 } } };
    const arrows = deriveArrows(a, b);
    expect(arrows[0]).toMatchObject({ kind: "pase", to: { x: 80, y: 40 } });
    expect(arrows.filter((x) => x.kind === "carrera")).toHaveLength(1);
  });
  it("calls it a conducción when one of ours runs with the ball", () => {
    const a = newPlay("x", at, { ball: { x: 50, y: 55 } }).frames[0];
    const b = { ...a, ball: { x: 50, y: 31 }, players: { ...a.players, mc: { x: 50, y: 30 } } };
    expect(deriveArrows(a, b)[0].kind).toBe("conduccion");
  });
});

describe("built-in library", () => {
  const lineup = () => {
    const l = seedLineup("2-3-1", SEVEN);
    l.roles = { cornersId: "md", freekicksId: "por" };
    return l;
  };

  it("builds córner, falta, banda and salida for the seven on the board", () => {
    const plays = libraryPlays(lineup());
    expect(plays.map((p) => p.kind)).toEqual(["corner", "falta", "banda", "salida"]);
    for (const p of plays) {
      expect(isValidPlay(p)).toBe(true);
      expect(Object.keys(p.frames[0].players).sort()).toEqual([...SEVEN].sort());
      expect(p.frames.every((f) => f.title && f.note)).toBe(true);
      expect(p.frames.at(-1)!.arrows).toEqual([]);
    }
    expect(plays.every((p) => p.frames.slice(0, -1).some((f) => f.arrows.length > 0))).toBe(true);
  });

  it("sends the córner specialist to the flag, never the keeper to a free kick", () => {
    const [corner, falta] = libraryPlays(lineup());
    expect(corner.frames[0].players.md).toEqual({ x: 95, y: 4 });
    expect(corner.frames[0].players.mi).toEqual({ x: 72, y: 14 }); // swapped into the specialist's slot
    expect(falta.frames[0].players.por).toEqual({ x: 50, y: 90 });
  });

  it("leaves empty slots out", () => {
    const l = seedLineup("2-3-1", SEVEN.slice(0, 5));
    for (const p of libraryPlays(l)) expect(Object.keys(p.frames[0].players)).toHaveLength(5);
  });

  it("matches the design's data (pasos per jugada)", () => {
    expect(PLAY_LIBRARY.map((p) => p.steps.length)).toEqual([4, 3, 3, 4]);
  });
});

describe("to the 3D engine", () => {
  it("flips y to the engine's frame and lists rivals among the movers", () => {
    const p = addRival(addArrow(fresh(), 0, { from: { x: 50, y: 54 }, to: { x: 50, y: 30 }, kind: "carrera" }), { x: 50, y: 60 });
    const frames = toEngineFrames(p);
    expect(frames).toHaveLength(2);
    expect(frames[0].players.find((q) => q.id === "por")).toEqual({ id: "por", x: 50, y: 10 });
    expect(frames[0].players.find((q) => q.id === "r1")).toEqual({ id: "r1", x: 50, y: 95 });
    expect(frames[0].ball).toEqual({ x: 50, y: 12 });
    expect(frames[0].arrows).toEqual([{ from: { x: 50, y: 46 }, to: { x: 50, y: 70 }, kind: "carrera" }]);
    expect(engineRivals(p).map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
  });
});
