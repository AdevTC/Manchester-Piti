import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "./plural";

describe("counts in Spanish", () => {
  it("singular only for exactly one", () => {
    expect(plural(1, "partido")).toBe("1 partido");
    expect(plural(0, "partido")).toBe("0 partidos");
    expect(plural(7, "partido")).toBe("7 partidos");
    expect(plural(1, "minuto")).toBe("1 minuto");
    expect(plural(90, "minuto")).toBe("90 minutos");
    expect(plural(1, "paso")).toBe("1 paso");
    expect(plural(1, "trazo")).toBe("1 trazo");
    expect(plural(2, "aviso")).toBe("2 avisos");
  });
  it("irregular plurals", () => {
    expect(plural(1, "gol", "goles")).toBe("1 gol");
    expect(plural(0, "gol", "goles")).toBe("0 goles");
    expect(plural(3, "jugador", "jugadores")).toBe("3 jugadores");
    expect(plural(1, "jugada propia", "jugadas propias")).toBe("1 jugada propia");
    expect(plural(12, "jugada propia", "jugadas propias")).toBe("12 jugadas propias");
    expect(pluralWord(1, "trazo")).toBe("trazo");
    expect(pluralWord(4, "trazo")).toBe("trazos");
  });
});
