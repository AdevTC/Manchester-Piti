// The match's new backend fields as the app reads them (seasonMatchSchema): la mesa's name, the
// postponement (a Timestamp in Firestore → ms) and the weather at kick-off. A malformed one is left out,
// never the match.
import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { seasonMatchSchema } from "./schemas";

const parse = (extra: Record<string, unknown>) => seasonMatchSchema.parse({ id: "m1", rival: "Orduña fc", ...extra });

describe("match: mesa, postponement, weather at kick-off", () => {
  it("reads them", () => {
    const m = parse({
      mesa: { name: "Jorge", since: 5 },
      status: "postponed",
      postponedReason: "Campo inundado",
      postponedTo: Timestamp.fromMillis(Date.UTC(2026, 10, 15, 10)),
      weatherAtKickoff: { temp: 15, label: "Nublado", sky: "cloud", cloud: 80, rain: 0 },
    });
    expect(m.mesa).toEqual({ name: "Jorge", since: 5 });
    expect(m.postponedReason).toBe("Campo inundado");
    expect(m.postponedTo).toBe(Date.UTC(2026, 10, 15, 10));
    expect(m.weatherAtKickoff).toEqual({ temp: 15, label: "Nublado", sky: "cloud", cloud: 80, rain: 0 });
  });
  it("leaves a malformed field out and keeps the match", () => {
    const m = parse({ mesa: { name: "" }, postponedReason: "x".repeat(141), postponedTo: "mañana", weatherAtKickoff: { temp: "15" } });
    expect(m.id).toBe("m1");
    expect(m.mesa).toBeUndefined();
    expect(m.postponedReason).toBeUndefined();
    expect(m.postponedTo).toBeUndefined();
    expect(m.weatherAtKickoff).toBeUndefined();
  });
  it("a plain ms postponedTo is kept as it is", () => {
    expect(parse({ postponedTo: 1234 }).postponedTo).toBe(1234);
  });
});
