import { describe, expect, it } from "vitest";
import { floatLabel, floatLines, untilText, type FloatMatch } from "./floatText";

const KICK = Date.UTC(2026, 9, 19, 17, 0); // 19:00 in Madrid (CEST)
const base: FloatMatch = { state: "directo", us: 2, them: 1, rival: "Orduña fc", clock: "23′" };

describe("floating score words", () => {
  it("counts down before kick-off", () => {
    expect(untilText(KICK, KICK - (2 * 60 + 14) * 60_000)).toBe("en 2 h 14 min");
    expect(untilText(KICK, KICK - 14 * 60_000)).toBe("en 14 min");
    expect(untilText(KICK, KICK - 3 * 3_600_000)).toBe("en 3 h");
    expect(untilText(KICK, KICK + 1)).toBe("ya");
  });

  it("each state says its own thing (the board's drops)", () => {
    const now = KICK - (2 * 60 + 14) * 60_000;
    expect(floatLines({ ...base, state: "previa", kickoff: KICK }, now)).toEqual({ big: "19:00", main: "Orduña fc, en 2 h 14 min", small: "", clock: false });
    expect(floatLines(base, now)).toEqual({ big: "2–1", main: "Orduña fc", small: "23′", clock: true });
    expect(floatLines({ ...base, event: { title: "¡Gol de Adrián T.C.!", sub: "Pase de Jordi, minuto 21" } }, now)).toMatchObject({ big: "2–1", main: "¡Gol de Adrián T.C.!", small: "Pase de Jordi, minuto 21" });
    expect(floatLines({ ...base, state: "acta", us: 3 }, now)).toMatchObject({ big: "3–1", main: "Final", small: "Acta lista" });
    expect(floatLines({ ...base, state: "pendiente" }, now)).toEqual({ big: null, main: "Orduña fc", small: "Pendiente del acta", clock: false });
    expect(floatLines({ ...base, state: "offline", staleAt: "26′" }, now).main).toBe("Marcador del 26′, sin actualizar");
  });

  it("a name a screen reader can say (never the ticking prime)", () => {
    expect(floatLabel(base, 0)).toBe("Manchester Piti 2, Orduña fc 1, minuto 23");
    expect(floatLabel({ ...base, state: "pendiente" }, 0)).toBe("Contra Orduña fc, pendiente del acta");
    expect(floatLabel({ ...base, state: "previa", kickoff: KICK }, KICK - 14 * 60_000)).toBe("Contra Orduña fc a las 19:00, en 14 min");
  });
});
