// Characterisation: what Partidos, the match page and the club page showed with their own copies of
// mapsUrl / kitLabel / origin() before they shared this module (bloque 5, D3).
import { afterEach, describe, expect, it, vi } from "vitest";
import { KIT_LABEL, kitLabel, mapsUrl, siteOrigin } from "./venue";

describe("mapsUrl", () => {
  it("searches the venue on Google Maps, the venue URI-encoded", () => {
    expect(mapsUrl("Campo de La Elipa, Madrid")).toBe("https://www.google.com/maps/search/?api=1&query=Campo%20de%20La%20Elipa%2C%20Madrid");
    expect(mapsUrl("Polideportivo Ñ & Cía #2")).toBe("https://www.google.com/maps/search/?api=1&query=Polideportivo%20%C3%91%20%26%20C%C3%ADa%20%232");
    expect(mapsUrl("")).toBe("https://www.google.com/maps/search/?api=1&query=");
  });
});

describe("kitLabel", () => {
  it("names the kit; nothing when the match says none (Partidos)", () => {
    expect(kitLabel({ kit: "home" })).toBe("1ª equipación");
    expect(kitLabel({ kit: "away" })).toBe("2ª equipación");
    expect(kitLabel({})).toBe("");
  });
  it("with a fallback, the match page's first kit when it says none", () => {
    expect(kitLabel({}, KIT_LABEL.home)).toBe("1ª equipación");
    expect(kitLabel({ kit: "away" }, KIT_LABEL.home)).toBe("2ª equipación");
    expect(kitLabel({ kit: "home" }, KIT_LABEL.home)).toBe("1ª equipación");
  });
  it("the labels the club page's kits use", () => {
    expect(KIT_LABEL).toEqual({ home: "1ª equipación", away: "2ª equipación" });
  });
});

describe("siteOrigin", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("this site's origin in the browser", () => {
    expect(siteOrigin()).toBe(location.origin);
  });
  it("empty while server-rendering (no location)", () => {
    vi.stubGlobal("location", undefined);
    expect(siteOrigin()).toBe("");
  });
});
