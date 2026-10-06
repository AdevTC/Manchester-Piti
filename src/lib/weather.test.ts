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
    const json = { hourly: { time: ["2026-11-08T12:00"], temperature_2m: [14.4], precipitation_probability: [10], weather_code: [2] } };
    expect(readForecast(json, "Madrid", true)).toEqual({ temp: 14, rain: 10, label: "Nubes y claros", sky: "cloud", place: "Madrid", approx: true });
    expect(readForecast({}, "X", false)).toBeNull();
  });
});
