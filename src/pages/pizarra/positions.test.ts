import { describe, expect, it } from "vitest";
import { normZone } from "./positions";

describe("normZone", () => {
  it("keeps the board's codes, in any case", () => {
    expect(normZone("POR")).toBe("POR");
    expect(normZone("def")).toBe("DEF");
    expect(normZone(" Med ")).toBe("MED");
    expect(normZone("DEL")).toBe("DEL");
  });
  it("reads the words the squad uses, with or without accents", () => {
    expect(normZone("Portero")).toBe("POR");
    expect(normZone("Defensa")).toBe("DEF");
    expect(normZone("Defensor")).toBe("DEF");
    expect(normZone("Lateral derecho")).toBe("DEF");
    expect(normZone("Central")).toBe("DEF");
    expect(normZone("Líbero")).toBe("DEF");
    expect(normZone("Medio")).toBe("MED");
    expect(normZone("Centrocampista")).toBe("MED");
    expect(normZone("MEDIOCENTRO")).toBe("MED");
    expect(normZone("Mediapunta")).toBe("MED");
    expect(normZone("Delantero centro")).toBe("DEL");
    expect(normZone("Extremo izquierdo")).toBe("DEL");
    expect(normZone("punta")).toBe("DEL");
  });
  it("anything else is no position", () => {
    expect(normZone("")).toBeUndefined();
    expect(normZone("Entrenador")).toBeUndefined();
    expect(normZone(null)).toBeUndefined();
    expect(normZone(3)).toBeUndefined();
    expect(normZone(undefined)).toBeUndefined();
  });
});
