import { describe, expect, it } from "vitest";
import { kickoffHour, readForecast, wmo } from "./weather";

describe("weather", () => {
  it("WMO codes in Spanish", () => {
    expect(wmo(0)).toEqual({ label: "Despejado", sky: "sun" });
    expect(wmo(3).sky).toBe("cloud");
    expect(wmo(61)).toEqual({ label: "Lluvia", sky: "rain" });
    expect(wmo(81)).toEqual({ label: "Chubascos", sky: "rain" });
    expect(wmo(73).sky).toBe("snow");
    expect(wmo(95).sky).toBe("storm");
  });
  it("kick-off hour in Madrid time (summer and winter)", () => {
    expect(kickoffHour(Date.UTC(2026, 10, 8, 11, 30))).toBe("2026-11-08T12:00");
    expect(kickoffHour(Date.UTC(2026, 6, 5, 18))).toBe("2026-07-05T20:00");
  });
  it("reads the kick-off hour from the forecast, or nothing", () => {
    const json = { hourly: { time: ["2026-11-08T12:00"], temperature_2m: [14.4], precipitation_probability: [10], weather_code: [2], cloud_cover: [62] } };
    expect(readForecast(json, "Madrid", true)).toEqual({ temp: 14, rain: 10, cloud: 62, label: "Nubes y claros", sky: "cloud", place: "Madrid", approx: true });
    expect(readForecast({}, "X", false)).toBeNull();
  });
  it("cloud cover: null when missing or null, clamped to 0–100 and rounded", () => {
    const at = (cloud_cover?: (number | null)[]) => readForecast({ hourly: { temperature_2m: [9], weather_code: [0], ...(cloud_cover ? { cloud_cover } : {}) } }, "Madrid", false)?.cloud;
    expect(at()).toBeNull();
    expect(at([null])).toBeNull();
    expect(at([0])).toBe(0);
    expect(at([37.6])).toBe(38);
    expect(at([104])).toBe(100);
  });
});
