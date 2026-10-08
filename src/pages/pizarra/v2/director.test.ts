import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stadium3DHandle } from "../../../components/pitch3d/Stadium3D";
import type { PlayController, PlayOptions, RevealOptions } from "../../../components/pitch3d/types";
import { libraryPlays } from "../playLibrary";
import { engineRivals, toEngineFrames } from "../plays";
import { charlaLast } from "./charla";
import { Director, engineCast, engineDriven, enginePasos, engineSeven, REST_PAUSE_MS, type Shot } from "./director";
import { demoSquad, lineupOf } from "./testkit";

// The director of the board's one 3D stadium, against a fake handle (no WebGL): what each shot asks of
// the engine, that a shot already on asks nothing, and that the engine's reports (the intro's end, a
// jugada's paso, the charla's hero shots and pasos) come back only while they are current.

const sq = demoSquad();
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = () => lineupOf(SEVEN, "2-3-1", sq);
const corner = () => libraryPlays(L7())[0];

function fake() {
  const intro = { done: () => {} };
  const reveal = { done: () => {}, fail: (_e: unknown) => {} };
  const ctl: PlayController = { pause: vi.fn(), resume: vi.fn(), seek: vi.fn(), stop: vi.fn(), done: Promise.resolve() };
  const h = {
    isReady: () => true,
    setPlayers: vi.fn(),
    setRivals: vi.fn(),
    setBall: vi.fn(),
    setCamera: vi.fn(async () => {}),
    setBoard: vi.fn(),
    setTheme: vi.fn(),
    intro: vi.fn(() => new Promise<void>((ok) => (intro.done = ok))),
    reveal: vi.fn((_o: string[], _r?: RevealOptions) => new Promise<void>((ok, ko) => ((reveal.done = ok), (reveal.fail = ko)))),
    play: vi.fn((_f: unknown, _o?: PlayOptions): PlayController | null => ctl),
    pick: vi.fn(() => null),
    project: vi.fn(() => null),
    pause: vi.fn(),
    resume: vi.fn(),
    info: vi.fn(() => null),
  };
  // (the fake is a whole handle: the director only ever sees that)
  const handle: Stadium3DHandle = h;
  return { h, handle, ctl, intro, reveal };
}
const events = () => ({ onIntroDone: vi.fn(), onFrame: vi.fn(), onStep: vi.fn(), onFail: vi.fn() });
const seven = engineSeven(L7(), sq, null);
const flush = () => new Promise((ok) => setTimeout(ok, 0));

const charla = (step: number, playing: boolean, slots: (string | null)[] = SEVEN): Shot => {
  const p = corner();
  return {
    kind: "charla",
    step,
    playing,
    players: seven,
    slots,
    jugada: { key: p.id, frames: toEngineFrames(p), pasos: enginePasos(p) },
    board: ["La charla", "J8 · MAD SKY", "Sistema 2-3-1", "Vamos Piti"],
    boardEnd: ["¡A por ellos!", "Manchester Piti", "J8 · MAD SKY"],
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the stadium's director", () => {
  it("at rest: the seven back at their spots, the TV camera, the LED boards; the engine rests after the fade", () => {
    const { h, handle } = fake();
    const d = new Director(handle, events());
    d.direct({ kind: "rest", players: seven, board: ["Manchester Piti"] });
    expect(h.setPlayers).toHaveBeenCalledWith(seven, { animate: false });
    expect(h.setBoard).toHaveBeenCalledWith(["Manchester Piti"]);
    expect(h.setCamera).toHaveBeenCalledWith("tv", { duration: 600 });
    expect(h.pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REST_PAUSE_MS);
    expect(h.pause).toHaveBeenCalledTimes(1);
    // the same shot again asks nothing more
    d.direct({ kind: "rest", players: seven, board: ["Manchester Piti"] });
    expect(h.setPlayers).toHaveBeenCalledTimes(1);
  });

  it("the intro: held until it may start, then once; a skip goes back to rest at once (and no late «done»)", async () => {
    const { h, handle, intro } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    d.direct({ kind: "hold" });
    expect(h.intro).not.toHaveBeenCalled();
    expect(h.resume).not.toHaveBeenCalled();
    d.direct({ kind: "intro", players: seven });
    expect(h.resume).toHaveBeenCalled();
    expect(h.setPlayers).toHaveBeenCalledWith(seven, { animate: false });
    expect(h.intro).toHaveBeenCalledTimes(1);
    d.direct({ kind: "intro", players: seven });
    expect(h.intro).toHaveBeenCalledTimes(1);
    intro.done();
    await vi.waitFor(() => expect(ev.onIntroDone).toHaveBeenCalledTimes(1));

    const f2 = fake();
    const ev2 = events();
    const d2 = new Director(f2.handle, ev2);
    d2.direct({ kind: "intro", players: seven });
    d2.direct({ kind: "rest", players: seven, board: [] });
    // the camera cut cancels the engine's intro
    expect(f2.h.setCamera).toHaveBeenCalledWith("tv", { duration: 0 });
    f2.intro.done();
    vi.useRealTimers();
    await flush();
    expect(ev2.onIntroDone).not.toHaveBeenCalled();
  });

  it("a jugada «En 3D»: plays on a loop from the paso on screen; 0,5× plays it again; its pasos are reported while it is current", () => {
    const { h, handle, ctl } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    const p = corner();
    const shot = (slow: boolean): Shot => ({ kind: "jugada", key: p.id, board: ["J"], players: engineCast(p, sq, L7(), null), rivals: engineRivals(p), frames: toEngineFrames(p), from: 2, slow });
    d.direct(shot(false));
    expect(h.resume).toHaveBeenCalled();
    expect(h.setRivals).toHaveBeenCalledWith(engineRivals(p), { animate: true });
    expect(h.play).toHaveBeenCalledWith(toEngineFrames(p), expect.objectContaining({ loop: true, speed: 1 }));
    expect(ctl.seek).toHaveBeenCalledWith(2 / 3);
    const first = h.play.mock.calls[0][1];
    first?.onFrame?.(3);
    expect(ev.onFrame).toHaveBeenLastCalledWith(3);
    d.direct(shot(true));
    expect(ctl.stop).toHaveBeenCalledTimes(1);
    expect(h.play).toHaveBeenLastCalledWith(toEngineFrames(p), expect.objectContaining({ speed: 0.5 }));
    // the first run's reports are stale now
    first?.onFrame?.(1);
    expect(ev.onFrame).toHaveBeenCalledTimes(1);
    d.direct({ kind: "rest", players: seven, board: [] });
    expect(ctl.stop).toHaveBeenCalledTimes(2);
  });

  it("the charla's system: from the stands down to the TV camera, with the charla on the LED boards", async () => {
    const { h, handle } = fake();
    const d = new Director(handle, events());
    d.direct(charla(0, true));
    expect(h.setPlayers).toHaveBeenCalledWith(seven, { animate: false });
    expect(h.setBoard).toHaveBeenCalledWith(["La charla", "J8 · MAD SKY", "Sistema 2-3-1", "Vamos Piti"]);
    expect(h.setCamera).toHaveBeenCalledWith("stands", { duration: 0 });
    await vi.waitFor(() => expect(h.setCamera).toHaveBeenLastCalledWith("tv", { duration: 2200 }));
  });

  it("the seven: the hero shots from the step on (empty slots skipped), each reported as its step, then the plan", async () => {
    const { h, handle, reveal } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    const slots = ["evans", "illescas", null, "huberoski", "eguzquiza", "almachi", "adrian"];
    d.direct(charla(2, true, slots));
    expect(h.reveal).toHaveBeenCalledWith(["illescas", "huberoski", "eguzquiza", "almachi", "adrian"], expect.objectContaining({ stepMs: 2300 }));
    const o = h.reveal.mock.calls[0][1];
    o?.onStep?.(1, seven[3]);
    expect(ev.onStep).toHaveBeenLastCalledWith(4);
    // the board follows to step 4: the hero shots go on (no second reveal)
    d.direct(charla(4, true, slots));
    expect(h.reveal).toHaveBeenCalledTimes(1);
    reveal.done();
    await vi.waitFor(() => expect(ev.onStep).toHaveBeenLastCalledWith(8));
  });

  it("paused on one of the seven: the low camera on his lit shirt; the old hero shots stop counting", () => {
    const { h, handle } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    d.direct(charla(1, true));
    const o = h.reveal.mock.calls[0][1];
    d.direct(charla(3, false));
    expect(h.setCamera).toHaveBeenLastCalledWith("low", { duration: 900 });
    o?.onStep?.(4, seven[4]);
    expect(ev.onStep).not.toHaveBeenCalled();
    // playing again starts the hero shots from there
    d.direct(charla(3, true));
    expect(h.reveal).toHaveBeenLastCalledWith(SEVEN.slice(2), expect.anything());
  });

  it("the plan from above; «¡A por ellos!» back in the stands with its LED boards", () => {
    const { h, handle } = fake();
    const d = new Director(handle, events());
    d.direct(charla(8, true));
    expect(h.setCamera).toHaveBeenLastCalledWith("top", { duration: 1400 });
    const last = charlaLast(corner().frames.length);
    d.direct(charla(last, false));
    expect(h.setBoard).toHaveBeenLastCalledWith(["¡A por ellos!", "Manchester Piti", "J8 · MAD SKY"]);
    expect(h.setCamera).toHaveBeenLastCalledWith("stands", { duration: 2600 });
  });

  it("the jugada in the charla: played once from the paso on screen, each paso reported, the end is «¡A por ellos!»", () => {
    const { h, handle, ctl } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    const p = corner();
    const last = charlaLast(p.frames.length);
    d.direct(charla(10, true));
    expect(h.play).toHaveBeenCalledWith(toEngineFrames(p).slice(1), expect.objectContaining({ loop: false, speed: 1 }));
    const o = h.play.mock.calls[0][1];
    o?.onFrame?.(1);
    expect(ev.onStep).toHaveBeenLastCalledWith(11);
    d.direct(charla(11, true));
    expect(h.play).toHaveBeenCalledTimes(1);
    o?.onEnd?.();
    expect(ev.onStep).toHaveBeenLastCalledWith(last);
    // paused on a paso: everyone where it has them, the TV camera
    d.direct(charla(10, false));
    expect(ctl.stop).toHaveBeenCalled();
    const pose = enginePasos(p)[1];
    expect(h.setRivals).toHaveBeenLastCalledWith(pose.rivals, { animate: true });
    expect(h.setBall).toHaveBeenLastCalledWith(pose.ball);
    const placed = h.setPlayers.mock.calls.at(-1)?.[0] ?? [];
    const at = pose.players.find((q) => q.id === placed[0].id);
    expect(placed[0]).toMatchObject({ x: at?.x, y: at?.y });
    expect(h.setCamera).toHaveBeenLastCalledWith("tv", { duration: 900 });
  });

  it("an engine that refuses a sequence sends the board back to 2D", async () => {
    const { h, handle, reveal } = fake();
    const ev = events();
    const d = new Director(handle, ev);
    h.play.mockImplementation(() => {
      throw new Error("sin frames");
    });
    d.direct(charla(9, true));
    expect(ev.onFail).toHaveBeenCalledTimes(1);
    d.direct(charla(1, true));
    reveal.fail(new Error("contexto perdido"));
    await vi.waitFor(() => expect(ev.onFail).toHaveBeenCalledTimes(2));
  });

  it("which charla steps the engine paces (the clock waits for it)", () => {
    const last = 13;
    expect(engineDriven(0, last, true, SEVEN)).toBe(false);
    expect(engineDriven(3, last, true, SEVEN)).toBe(true);
    expect(engineDriven(3, last, false, SEVEN)).toBe(false);
    expect(engineDriven(7, last, true, [...SEVEN.slice(0, 6), null])).toBe(false);
    expect(engineDriven(8, last, true, SEVEN)).toBe(false);
    expect(engineDriven(10, last, true, SEVEN)).toBe(true);
    expect(engineDriven(last, last, true, SEVEN)).toBe(false);
  });

  it("the seven as the engine draws them: spots, dorsals, galones and the lit shirt", () => {
    const L = { ...L7(), roles: { ...L7().roles, captainId: "illescas" } };
    const s = engineSeven(L, sq, "tello");
    expect(s).toHaveLength(7);
    expect(s.find((p) => p.id === "illescas")).toMatchObject({ name: "ILLESCAS", num: 4, role: "C", kit: "home", highlight: false });
    expect(s.find((p) => p.id === "tello")?.highlight).toBe(true);
    // our goal is the engine's y = 0
    expect(s[0].y).toBeLessThan(20);
  });
});
