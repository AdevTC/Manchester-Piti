import { describe, expect, it } from "vitest";
import { cloudAmount, madridMinutes, mix, skyAt, skyCss, weatherKind } from "./light";
import { horizonFraction, projector, rigDef, rigKey, RIGS, sunScreen } from "./rigs";
import { floodLevels, ignitePower, pitchToWorld, placeFigures, plateLook, worldToPitch, HUDDLE, PITCH } from "./scene";
import { sunPosition } from "../../lib/derived/sun";

// Sunday 18 October 2026 in Madrid (CEST, UTC+2): the club's first match day.
const madrid = (h: number, m: number) => Date.UTC(2026, 9, 18, h - 2, m);

describe("sun over Palomeras", () => {
  it("climbs to about 40° at solar noon and sets around 19:30", () => {
    const noon = sunPosition(madrid(14, 0)).elevation;
    expect(noon).toBeGreaterThan(38);
    expect(noon).toBeLessThan(42);
    expect(sunPosition(madrid(19, 15)).elevation).toBeGreaterThan(0);
    expect(sunPosition(madrid(19, 40)).elevation).toBeLessThan(0);
    expect(sunPosition(madrid(21, 0)).elevation).toBeLessThan(-12);
  });
  it("is in the south-west in the afternoon", () => {
    const az = sunPosition(madrid(17, 0)).azimuth;
    expect(az).toBeGreaterThan(200);
    expect(az).toBeLessThan(260);
  });
  it("reads the Madrid clock", () => {
    expect(madridMinutes(madrid(19, 22))).toBeCloseTo(19 * 60 + 22, 5);
  });
});

describe("sky stops by elevation", () => {
  it("is celeste by day, gold low, navy at night", () => {
    const day = skyAt(40);
    expect(day.mid).toBe(mix("#6cabdd", "#62a6dc", 0.75));
    expect(day.day).toBe(1);
    expect(day.night).toBe(0);
    const golden = skyAt(3);
    expect(golden.golden).toBeGreaterThan(0.9);
    const night = skyAt(-20);
    expect(night.top).toBe("#02061a");
    expect(night.night).toBe(1);
    expect(night.sunI).toBe(0);
  });
  it("hits the stops exactly", () => {
    expect(skyAt(25).hor).toBe("#d4e8f6");
    expect(skyAt(-9).mid).toBe("#0a1737");
  });
  it("veils the sky and dims the sun under rain", () => {
    const clear = skyAt(20, "despejado");
    const rain = skyAt(20, "lluvia");
    expect(rain.cloud).toBeCloseTo(0.62);
    expect(rain.sunI).toBeLessThan(clear.sunI * 0.2);
    expect(rain.top).not.toBe(clear.top);
  });
  it("maps the app's weather to the three skies", () => {
    expect(weatherKind(null)).toBe("despejado");
    expect(weatherKind({ sky: "sun", cloud: 80 })).toBe("nublado");
    expect(weatherKind({ sky: "fog" })).toBe("nublado");
    expect(weatherKind({ sky: "storm" })).toBe("lluvia");
    expect(weatherKind({ sky: "cloud", rain: 85 })).toBe("lluvia");
    expect(cloudAmount({ sky: "cloud", cloud: 40 })).toBeCloseTo(0.4);
    expect(cloudAmount({ sky: "rain" })).toBe(1);
  });
  it("gives the server a gradient that follows the rig's horizon", () => {
    const css = skyCss(madrid(21, 0));
    expect(css).toMatch(/^linear-gradient\(180deg, #/);
    expect(css).toContain("var(--pm-hy, 50%)");
    expect(skyCss(madrid(14, 0))).not.toBe(css);
  });
});

describe("rigs", () => {
  it("maps every public rig to a camera", () => {
    expect(rigKey("hero1440")).toBe("wide");
    expect(rigKey("hero820")).toBe("tab");
    expect(rigKey("hero390")).toBe("phone");
    expect(rigKey("window")).toBe("mini");
    expect(rigKey("slice", 3)).toBe("s3");
    expect(rigKey("sliceWide", 1)).toBe("gf");
    expect(rigKey("sliceWide", 4)).toBe("b4");
    expect(rigKey("slice", 9)).toBe("s6");
  });
  it("puts the horizon above the middle when the camera looks down", () => {
    const hy = horizonFraction(RIGS.wide);
    expect(hy).toBeGreaterThan(0.35);
    expect(hy).toBeLessThan(0.5);
    // the analytic horizon agrees with the projection of a far point at camera height
    const r = RIGS.wide;
    const p = projector(r, 1440, 720)(r.pos[0], r.pos[1], -5000);
    expect(p).not.toBeNull();
    expect((p?.y ?? 0) / 720).toBeCloseTo(hy, 2);
  });
  it("crosses the sun from left (14:00) to right (21:00) and drops it with the elevation", () => {
    const r = rigDef("hero1440");
    const a = sunScreen(840, 40, r);
    const b = sunScreen(1160, 3, r);
    expect(a.x).toBeCloseTo(0.07);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
    expect(sunScreen(2000, -10, r).x).toBeCloseTo(0.93);
  });
  it("projects the centre spot into the lower half and hides what is behind", () => {
    const P = projector(RIGS.wide, 1440, 720);
    const c = P(0, 0, 0);
    expect(c?.x).toBeGreaterThan(600);
    expect(c?.x).toBeLessThan(840);
    expect(c?.y).toBeGreaterThan(360);
    expect(P(0, 0, 100)).toBeNull();
  });
});

describe("floodlights", () => {
  it("has three steady states", () => {
    expect(floodLevels("off")).toEqual({ power: [0, 0, 0, 0], pre: 0 });
    expect(floodLevels("glow")).toEqual({ power: [0, 0, 0, 0], pre: 1 });
    expect(floodLevels("on")).toEqual({ power: [1, 1, 1, 1], pre: 0 });
  });
  it("ignites the four masts at 0, 0.35, 0.7 and 1.05 s", () => {
    expect(ignitePower(0.2)).toEqual([1, 0, 0, 0]);
    expect(ignitePower(0.5)).toEqual([1, 1, 0, 0]);
    expect(ignitePower(0.76)[2]).toBeCloseTo(0.5);
    expect(ignitePower(1.0)).toEqual([1, 1, 1, 0]);
    expect(ignitePower(1.3)).toEqual([1, 1, 1, 1]);
  });
});

describe("figures", () => {
  it("maps pitch % to metres and back", () => {
    expect(pitchToWorld(50, 0)).toEqual({ x: -PITCH.HL, z: 0 });
    expect(pitchToWorld(100, 50)).toEqual({ x: 0, z: PITCH.HW });
    const w = pitchToWorld(23, 71);
    const p = worldToPitch(w.x, w.z);
    expect(p.x).toBeCloseTo(23);
    expect(p.y).toBeCloseTo(71);
  });
  it("forms the half-time huddle by the bench, without plates", () => {
    const figs = placeFigures([
      { id: "a", num: "1", name: "A", x: 50, y: 5, huddle: true },
      { id: "b", num: "2", name: "B", x: 20, y: 30, huddle: true },
      { id: "c", num: "3", name: "C", x: 80, y: 60 },
    ]);
    expect(figs[0].x).toBeCloseTo(HUDDLE.x + HUDDLE.rx);
    expect(figs[0].z).toBeCloseTo(HUDDLE.z);
    expect(figs[1].x).toBeCloseTo(HUDDLE.x - HUDDLE.rx);
    expect(figs[0].plate).toBe("none");
    expect(figs[2].plate).toBe("full");
    expect(figs[2].x).toBeCloseTo(-PITCH.HL + 0.6 * PITCH.L);
  });
  it("keeps the leaving flag for the engine and the tags for the plates", () => {
    const [f] = placeFigures([{ id: "a", num: "7", name: "ALCIDES", x: 50, y: 50, leaving: true, tag: "mvp" }]);
    expect(f.leaving).toBe(true);
    const look = plateLook(f, false);
    expect(look.cls).toContain("mvp");
    expect(look.name).toBe("MVP ALCIDES");
  });
  it("labels the plates: tú, cards by letter, goal in gold", () => {
    const [tu, roja, mini] = placeFigures([
      { id: "a", num: "28", name: "JORDI", x: 80, y: 20, tag: "tu" },
      { id: "b", num: "4", name: "ILLESCAS", x: 50, y: 20, tag: "roja" },
      { id: "c", num: "9", name: "ERIK", x: 50, y: 20, plate: "mini" },
    ]);
    expect(plateLook(tu, false)).toMatchObject({ tu: true, card: null });
    expect(plateLook(roja, false).card).toBe("R");
    expect(plateLook(roja, true).cls).toContain("gol");
    expect(plateLook(mini, false)).toMatchObject({ name: null, tu: false });
    expect(plateLook(tu, false, true)).toMatchObject({ name: null, tu: false });
  });
});
