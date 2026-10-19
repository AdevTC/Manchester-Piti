import { describe, expect, it } from "vitest";
import { isCalled, placeLabel, venueName } from "./model";

describe("words of the calendar", () => {
  it("venues as people write them", () => {
    expect(venueName("CDM PALOMERAS")).toBe("CDM Palomeras");
    expect(venueName("Campo de Pitutis")).toBe("Campo de Pitutis");
    expect(placeLabel({ home: false, venue: "Campo de Pitutis" })).toBe("Fuera, en Pitutis");
    expect(placeLabel({ home: true, venue: "CDM PALOMERAS" })).toBe("En casa, Palomeras");
  });
  it("a member is called when he is in the siete or on the bench", () => {
    expect(isCalled({ starters: ["jordi"], bench: [] }, "jordi")).toBe(true);
    expect(isCalled({ starters: [], bench: ["jordi"] }, "jordi")).toBe(true);
    expect(isCalled({ starters: ["erik"], bench: [] }, "jordi")).toBe(false);
    expect(isCalled({ starters: ["jordi"], bench: [] }, null)).toBe(false);
  });
});
