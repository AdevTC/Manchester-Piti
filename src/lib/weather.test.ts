import { describe, expect, it } from "vitest";
import { kickoffHour, readForecast, readHourly, wmo } from "./weather";
import { parseKickoffWeather, readKickoffWeather } from "../../functions/src/weatherLogic";

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

describe("weather by hour", () => {
  it("reads kick-off −1 h … +2 h, skips holes and marks the kick-off hour", () => {
    const kickoff = Date.UTC(2026, 10, 8, 11, 30); // 12:30 in Madrid: the 12:00 hour
    const json = { hourly: { temperature_2m: [13.4, 14.6, 15.1, null], weather_code: [1, 2, 61, 3], precipitation_probability: [0, 10, 70, 20] } };
    const r = readHourly(json, kickoff - 3_600_000, kickoff, "Getafe", false);
    expect(r?.hours.map((h) => [h.temp, h.sky, h.kickoff])).toEqual([
      [13, "sun", false],
      [15, "cloud", true],
      [15, "rain", false],
    ]);
    expect(r?.hours[1].rain).toBe(10);
    expect(r?.place).toBe("Getafe");
  });
  it("is null without any usable hour", () => {
    expect(readHourly({}, 0, 3_600_000, "Madrid", true)).toBeNull();
  });
});

describe("weather at kick-off (the backend's stamp)", () => {
  it("reads one past hour, rain in mm", () => {
    expect(readKickoffWeather({ hourly: { temperature_2m: [15.4], weather_code: [3], cloud_cover: [88.2], precipitation: [0.24] } })).toEqual({ temp: 15, label: "Nublado", sky: "cloud", cloud: 88, rain: 0.2 });
    expect(readKickoffWeather({ hourly: { temperature_2m: [15] } })).toBeNull();
  });
  it("parses a stored stamp or nothing", () => {
    expect(parseKickoffWeather({ temp: 15, label: "Nublado", sky: "cloud", cloud: null, rain: 0 })).toEqual({ temp: 15, label: "Nublado", sky: "cloud", cloud: null, rain: 0 });
    expect(parseKickoffWeather({ temp: 15, label: "Nublado", sky: "lava" })).toBeNull();
    expect(parseKickoffWeather(null)).toBeNull();
  });
});
