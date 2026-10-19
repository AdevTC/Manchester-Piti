import { describe, expect, it } from "vitest";
import { parseVenues, venueInfo, venueKey, venueMapsUrl, venueName } from "./venue";
import { withDefaults } from "../publicData";

const grounds = [
  { name: "CDM Palomeras", address: "Calle de ejemplo, 1", transit: "Metro de ejemplo, 5 min a pie" },
  { name: "Polideportivo Municipal Getafe Norte", mapsQuery: "Getafe Norte polideportivo" },
];

describe("venueInfo (a match's venue → the ground's details)", () => {
  it("matches without accents, case, «CDM» / «Campo de» or the address after « · »", () => {
    expect(venueInfo("CDM Palomeras", grounds)?.address).toBe("Calle de ejemplo, 1");
    expect(venueInfo("palomeras", grounds)?.name).toBe("CDM Palomeras");
    expect(venueInfo("Campo de Palomeras · C/ Otra, 3", grounds)?.name).toBe("CDM Palomeras");
    expect(venueInfo("PALOMERÁS", grounds)?.name).toBe("CDM Palomeras");
    expect(venueInfo("Getafe Norte", grounds)?.name).toBe("Polideportivo Municipal Getafe Norte");
  });
  it("is null for a ground the captains haven't written, or no venue", () => {
    expect(venueInfo("La Elipa", grounds)).toBeNull();
    expect(venueInfo("", grounds)).toBeNull();
    expect(venueInfo(undefined, grounds)).toBeNull();
    expect(venueInfo("CDM Palomeras", undefined)).toBeNull();
    expect(venueKey("CDM  Palomeras")).toBe("palomeras");
  });
  it("the map link: its query, else name and address", () => {
    expect(venueMapsUrl(grounds[1])).toContain(encodeURIComponent("Getafe Norte polideportivo"));
    expect(venueMapsUrl(grounds[0])).toContain(encodeURIComponent("CDM Palomeras, Calle de ejemplo, 1"));
  });
});

describe("clubContent.venues as read", () => {
  it("keeps valid grounds, trimmed and capped; anything else is left out", () => {
    expect(parseVenues([{ name: " CDM Palomeras ", address: "", transit: 3 }, { address: "sin nombre" }, "x", { name: "Getafe", mapsQuery: "q".repeat(200) }])).toEqual([
      { name: "CDM Palomeras" },
      { name: "Getafe", mapsQuery: "q".repeat(160) },
    ]);
    expect(parseVenues(Array.from({ length: 25 }, (_, i) => ({ name: `C${i}` })))).toHaveLength(10);
    expect(parseVenues("no")).toEqual([]);
  });
  it("the content's mapper gives every page a list, empty without one", () => {
    expect(withDefaults(undefined).venues).toEqual([]);
    expect(withDefaults({ venues: [{ name: "Getafe" }] }).venues).toEqual([{ name: "Getafe" }]);
  });
});
describe("venueName · the one way a ground is printed", () => {
  it("a name in capitals reads as a name; acronyms and small words as people write them", () => {
    expect(venueName("CDM PALOMERAS")).toBe("CDM Palomeras");
    expect(venueName(" CAMPO DE LA ELIPA ")).toBe("Campo de la Elipa");
    expect(venueName("POLIDEPORTIVO DE MORATALAZ")).toBe("Polideportivo de Moratalaz");
    expect(venueName("Campo de Pitutis")).toBe("Campo de Pitutis");
    expect(venueName("")).toBe("");
  });
});
