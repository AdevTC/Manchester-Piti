import { describe, expect, it } from "vitest";
import { nearestSpot, spotState, summaryText, fullText } from "./mapaNav";
import { POS_CODES, type PosCode } from "../../lib/positions";

describe("nearestSpot", () => {
  it("climbs the central spine one spot at a time", () => {
    expect(nearestSpot("POR", "up")).toBe("LIB");
    expect(nearestSpot("LIB", "up")).toBe("DFC");
    expect(nearestSpot("DFC", "up")).toBe("MCD");
    expect(nearestSpot("MCD", "up")).toBe("MC");
    expect(nearestSpot("MC", "up")).toBe("MCO");
    expect(nearestSpot("MCO", "up")).toBe("DC");
  });

  it("comes back down the spine", () => {
    expect(nearestSpot("DC", "down")).toBe("MCO");
    expect(nearestSpot("LIB", "down")).toBe("POR");
  });

  it("prefers the spot on the same row over a closer-but-diagonal one", () => {
    expect(nearestSpot("MC", "right")).toBe("MD");
    expect(nearestSpot("MC", "left")).toBe("MI");
    expect(nearestSpot("EI", "right")).toBe("DC");
    expect(nearestSpot("DC", "left")).toBe("EI");
  });

  it("walks up the wings", () => {
    expect(nearestSpot("LI", "up")).toBe("MI");
    expect(nearestSpot("MI", "up")).toBe("EI");
    expect(nearestSpot("ED", "down")).toBe("MD");
    expect(nearestSpot("MD", "down")).toBe("LD");
  });

  it("returns null at the edge of the pitch", () => {
    expect(nearestSpot("DC", "up")).toBeNull();
    expect(nearestSpot("POR", "down")).toBeNull();
    expect(nearestSpot("LI", "left")).toBeNull();
    expect(nearestSpot("ED", "right")).toBeNull();
  });

  it("reaches every spot from the goalkeeper with the arrows alone", () => {
    const seen = new Set<PosCode>(["POR"]);
    const queue: PosCode[] = ["POR"];
    while (queue.length) {
      const at = queue.shift() as PosCode;
      for (const dir of ["up", "down", "left", "right"] as const) {
        const next = nearestSpot(at, dir);
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...POS_CODES].sort());
  });
});

describe("texts", () => {
  const set = { main: "MCD" as const, also: ["MC" as const, "DFC" as const] };

  it("says the state of each spot", () => {
    expect(spotState(set, "MCD")).toBe("preferida");
    expect(spotState(set, "MC")).toBe("también");
    expect(spotState(set, "DC")).toBe("nada");
  });

  it("summarises in one line", () => {
    expect(summaryText(set)).toBe("Pivote (MCD) · también MC, DFC");
    expect(summaryText({ main: "DC", also: [] })).toBe("Punta (DC)");
    expect(summaryText({ main: null, also: ["LI", "LD"] })).toBe("También LI, LD");
    expect(summaryText({ main: null, also: [] })).toBe("Sin posición");
    expect(summaryText({ main: null, also: [] }, "Aún no has dicho dónde juegas")).toBe("Aún no has dicho dónde juegas");
  });

  it("spells every position out for screen readers, including the review differences", () => {
    expect(fullText(set)).toBe("Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC).");
    expect(fullText({ main: null, also: [] })).toBe("Sin posición.");
    expect(fullText(set, { main: "MCD", also: ["LIB"] })).toBe(
      "Preferida: Pivote (MCD). También: Mediocentro (MC), Central (DFC). Añadidas: Mediocentro (MC), Central (DFC). Quitadas: Líbero (LIB).",
    );
    expect(fullText({ main: "MCD", also: ["MC"] }, { main: "MC", also: ["MCD"] })).toBe(
      "Preferida: Pivote (MCD). También: Mediocentro (MC). Preferida antes: Mediocentro (MC).",
    );
  });
});
