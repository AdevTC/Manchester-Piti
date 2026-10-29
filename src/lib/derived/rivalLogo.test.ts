import { describe, expect, it } from "vitest";
import { logoOf, rivalLogos } from "./rivalLogo";

const day = (d: number) => ({ seconds: Date.UTC(2026, 9, d) / 1000, nanoseconds: 0 });

describe("rivalLogos: each rival's escudo", () => {
  it("the newest acta that saved one wins, and a later match without one keeps it", () => {
    const logos = rivalLogos([
      { id: "j1", rival: "Pitutis", rivalLogoUrl: "https://instagram.test/caducado.jpg", date: day(4) },
      { id: "j2", rival: "Pitutis", rivalLogoUrl: "https://piti.test/escudos/pitutis.jpg", date: day(11) },
      { id: "j3", rival: "Pitutis", rivalLogoUrl: "", date: day(25) },
    ]);
    expect(logoOf(logos, "Pitutis")).toBe("https://piti.test/escudos/pitutis.jpg");
  });

  it("one rival whatever the accents, case and spaces", () => {
    const logos = rivalLogos([{ id: "j1", rival: "Orduña  FC", rivalLogoUrl: "https://piti.test/escudos/orduna.jpg", date: day(4) }]);
    expect(logoOf(logos, " orduna fc")).toBe("https://piti.test/escudos/orduna.jpg");
  });

  it("only https links; no rival, no escudo", () => {
    const logos = rivalLogos([
      { id: "j1", rival: "Red Demons", rivalLogoUrl: "http://piti.test/x.jpg", date: day(4) },
      { id: "j2", rival: "Brugal", rivalLogoUrl: "  ", date: day(5) },
    ]);
    expect(logos.size).toBe(0);
    expect(logoOf(logos, "Red Demons")).toBeUndefined();
    expect(logoOf(undefined, "Red Demons")).toBeUndefined();
    expect(logoOf(logos, null)).toBeUndefined();
  });
});
