import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraRig, FLIGHT_GRACE, followOrbit, orbitPosition, preset } from "./camera";
import { HL_BOWL, HW_BOWL } from "./constants";

// CameraRig timing on a fake clock (no WebGL): flights land on the engine clock, the wall-clock
// guard lands a flight whose clock stalls, interrupted flights resolve, tracking does not stop a
// flight, and shiftWall() respects host pauses. Ported from the engine's Node rig test.

let wall = 0;
beforeEach(() => {
  wall = 0;
  vi.spyOn(performance, "now").mockImplementation(() => wall);
});
afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise<void>((ok) => queueMicrotask(ok));
const hero = () => ({ target: new Vector3(0, 3, 20), az: 0.3, el: -0.03, dist: 18, fov: 34 });
const PORTRAIT = 390 / 844;

describe("CameraRig", () => {
  it("lands a 1500 ms flight on time at 60 fps, on its destination", async () => {
    const rig = new CameraRig(new PerspectiveCamera(), "tv", PORTRAIT);
    let clock = 0, landed = -1;
    void rig.fly(hero(), 1500, clock, 0.08).then(() => (landed = clock));
    for (let i = 0; i < 200 && landed < 0; i++) {
      clock += 1000 / 60;
      wall += 1000 / 60;
      rig.update(clock, 1 / 60);
      await flush();
    }
    expect(Math.abs(landed - 1500)).toBeLessThan(40);
    expect(rig.orbit.dist).toBeCloseTo(18, 6);
    expect(rig.flying).toBe(false);
  });

  it("lands a flight whose engine clock stalls within duration + grace (wall guard)", async () => {
    const rig = new CameraRig(new PerspectiveCamera(), "tv", PORTRAIT);
    let landed = -1;
    void rig.fly(hero(), 1000, 0, 0).then(() => (landed = wall));
    for (let i = 0; i < 300 && landed < 0; i++) {
      wall += 10;
      rig.update(0, 0.01); // the engine clock never advances
      await flush();
    }
    expect(landed).toBeGreaterThan(0);
    expect(landed).toBeLessThanOrEqual(1000 + FLIGHT_GRACE + 10);
  });

  it("resolves an interrupted flight, and lands a follow flight while tracking", async () => {
    const rig = new CameraRig(new PerspectiveCamera(), "tv", PORTRAIT);
    let first = false, second = false, clock = 0;
    void rig.fly(hero(), 1500, clock).then(() => (first = true));
    clock += 300;
    rig.update(clock, 0.3);
    void rig.fly(followOrbit(PORTRAIT, new Vector3(15, 0, -25)), 1000, clock, 0, "out").then(() => (second = true));
    await flush();
    expect(first).toBe(true);
    for (let i = 0; i < 90 && !second; i++) {
      clock += 1000 / 60;
      wall += 1000 / 60;
      rig.setTrack(new Vector3(15 - i * 0.05, 0, -25));
      rig.update(clock, 1 / 60);
      await flush();
    }
    expect(second).toBe(true);
    expect(rig.flying).toBe(false);
  });

  it("does not cut a resumed flight short after a host pause; finish() lands it", async () => {
    const rig = new CameraRig(new PerspectiveCamera(), "tv", 1.6);
    let done = false;
    void rig.fly(preset("top", 1.6), 2000, 0).then(() => (done = true));
    rig.shiftWall(10_000); // the host was paused for 10 s
    wall += 3000;
    rig.update(100, 0.016);
    await flush();
    expect(done).toBe(false);
    rig.finish();
    await flush();
    expect(done).toBe(true);
    expect(rig.flying).toBe(false);
  });

  it("a zero-length flight snaps at once", async () => {
    const rig = new CameraRig(new PerspectiveCamera(), "tv", PORTRAIT);
    await rig.fly(hero(), 0, 0);
    expect(rig.flying).toBe(false);
    expect(rig.orbit.az).toBeCloseTo(0.3);
  });
});

describe("camera presets", () => {
  it.each([
    [390, 844],
    [1440, 900],
  ])("keep the cameras above the grass and the low one inside the bowl at %ix%i", (w, h) => {
    for (const name of ["tv", "top", "stands", "low"] as const) expect(orbitPosition(preset(name, w / h)).y).toBeGreaterThan(0);
    const low = orbitPosition(preset("low", w / h));
    expect(Math.abs(low.x)).toBeLessThan(HW_BOWL);
    expect(Math.abs(low.z)).toBeLessThan(HL_BOWL);
  });

  it("frames the pitch from behind our goal in portrait and from the main stand in landscape", () => {
    expect(preset("tv", PORTRAIT).az).toBeCloseTo(0);
    expect(preset("tv", 1.6).az).toBeCloseTo(Math.PI / 2);
  });
});
