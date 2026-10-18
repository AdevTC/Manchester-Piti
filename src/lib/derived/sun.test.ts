import { describe, expect, it } from "vitest";
import { floodlightsOn, lightOf, PALOMERAS, sunPosition, sunTimes } from "./sun";
import { madridTime } from "./madrid";

// 18 Oct 2026, Madrid on summer time (CEST = UTC+2)
const cest = (h: number, m = 0) => Date.UTC(2026, 9, 18, h - 2, m);
const minutesOfDay = (ms: number) => {
  const [h, m] = madridTime(ms).split(":").map(Number);
  return h * 60 + m;
};

describe("sunTimes", () => {
  it("Palomeras on 18 Oct 2026: sunrise ≈ 08:28, sunset ≈ 19:30 CEST (NOAA; the plan guessed 19:20–19:25)", () => {
    const { sunrise, sunset } = sunTimes(cest(12));
    expect(Math.abs(minutesOfDay(sunrise) - (8 * 60 + 28))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutesOfDay(sunset) - (19 * 60 + 30))).toBeLessThanOrEqual(3);
  });
  it("is the same Madrid day whatever the hour asked (00:30 and 23:30 CEST)", () => {
    const a = sunTimes(cest(0, 30));
    const b = sunTimes(cest(23, 30));
    expect(a).toEqual(b);
  });
  it("winter: Madrid on 21 Dec 2026 sets around 17:50 CET and rises around 08:35", () => {
    const { sunrise, sunset } = sunTimes(Date.UTC(2026, 11, 21, 11), 40.4168, -3.7038);
    expect(Math.abs(minutesOfDay(sunset) - (17 * 60 + 50))).toBeLessThanOrEqual(5);
    expect(Math.abs(minutesOfDay(sunrise) - (8 * 60 + 35))).toBeLessThanOrEqual(5);
  });
  it("at its sunset the upper limb touches the horizon (centre ≈ −0.4° apparent)", () => {
    const { sunset } = sunTimes(cest(12));
    const h = sunPosition(sunset).elevation;
    expect(h).toBeLessThan(-0.2);
    expect(h).toBeGreaterThan(-0.7);
  });
});

describe("sunPosition", () => {
  it("noon on 18 Oct 2026 stands about 40° high, due south", () => {
    // solar noon in Palomeras is about 14:00 CEST in October
    const noon = sunPosition(cest(14));
    expect(noon.elevation).toBeGreaterThan(39);
    expect(noon.elevation).toBeLessThan(41);
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(3);
  });
  it("east in the morning, west in the evening, below the horizon at night", () => {
    expect(sunPosition(cest(9)).azimuth).toBeGreaterThan(90);
    expect(sunPosition(cest(9)).azimuth).toBeLessThan(150);
    expect(sunPosition(cest(19)).azimuth).toBeGreaterThan(240);
    expect(sunPosition(cest(19)).azimuth).toBeLessThan(270);
    expect(sunPosition(cest(23)).elevation).toBeLessThan(-20);
  });
  it("defaults to Palomeras", () => {
    expect(sunPosition(cest(16))).toEqual(sunPosition(cest(16), PALOMERAS.lat, PALOMERAS.lon));
  });
});

describe("lightOf", () => {
  it("bands by elevation, edges included as specified", () => {
    expect(lightOf(40)).toBe("dia");
    expect(lightOf(25.1)).toBe("dia");
    expect(lightOf(25)).toBe("tarde");
    expect(lightOf(10.1)).toBe("tarde");
    expect(lightOf(10)).toBe("dorada");
    expect(lightOf(2.1)).toBe("dorada");
    expect(lightOf(2)).toBe("ocaso");
    expect(lightOf(-4)).toBe("ocaso");
    expect(lightOf(-4.1)).toBe("noche");
  });
  it("a 19:00 kick-off on 18 Oct is in the golden hour, at 19:45 dusk", () => {
    expect(lightOf(sunPosition(cest(19)).elevation)).toBe("dorada");
    expect(lightOf(sunPosition(cest(19, 45)).elevation)).toBe("ocaso");
  });
});

describe("floodlightsOn", () => {
  it("live: on under 3°", () => {
    expect(floodlightsOn(3, true)).toBe(false);
    expect(floodlightsOn(2.9, true)).toBe(true);
  });
  it("without a match: only at night (under −4°)", () => {
    expect(floodlightsOn(0, false)).toBe(false);
    expect(floodlightsOn(-4, false)).toBe(false);
    expect(floodlightsOn(-4.1, false)).toBe(true);
    expect(floodlightsOn(-10, true)).toBe(true);
  });
});
