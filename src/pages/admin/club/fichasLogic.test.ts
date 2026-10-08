import { describe, expect, it } from "vitest";
import { handle, relativeWhen, resolvedText, viaText } from "./fichasLogic";

/** Monday 2 Nov 2026, 10:00 in Madrid. */
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const nick = (uid: string) => ({ u2: "erik9", a1: "adrian_tc" })[uid] ?? "un capitán";

describe("relativeWhen", () => {
  it("speaks like the captains (Madrid time)", () => {
    expect(relativeWhen(NOW - 20_000, NOW)).toBe("ahora mismo");
    expect(relativeWhen(NOW - 5 * 60_000, NOW)).toBe("hace 5 min");
    expect(relativeWhen(NOW - 2 * 3_600_000, NOW)).toBe("hace 2 h");
    // Sunday 1 Nov, 21:40 Madrid
    expect(relativeWhen(Date.UTC(2026, 10, 1, 20, 40), NOW)).toBe("ayer, 21:40");
    expect(relativeWhen(Date.UTC(2026, 9, 28, 12), NOW)).toBe("28 oct");
    expect(relativeWhen(0, NOW)).toBe("hace tiempo");
  });
});

describe("viaText", () => {
  it("says how the member came into the vestuario", () => {
    expect(viaText({ via: "invite", by: "u2" }, nick)).toBe("entró con la invitación de erik9");
    expect(viaText({ via: "request", by: "a1" }, nick)).toBe("llamó a la puerta y le abrió adrian_tc");
    expect(viaText({ via: "returning", by: "" }, nick)).toBe("volvió al vestuario");
    expect(viaText({ via: "", by: "" }, nick)).toBe("entró con la clave del vestuario");
    expect(viaText(undefined, nick)).toBe("sin pase del vestuario");
  });
});

describe("resolvedText / handle", () => {
  it("names who resolved it", () => {
    expect(resolvedText(true, "u9", "u2", nick)).toBe("aprobada por erik9");
    expect(resolvedText(false, "u9", "a1", nick)).toBe("rechazada por adrian_tc");
    expect(resolvedText(true, "a1", "a1", nick)).toBe("se aprobó sola (es administrador)");
    expect(resolvedText(false, "u9", "", nick)).toBe("rechazada");
    expect(handle({ nickname: "nuevo.socio", email: "x@y.es" })).toBe("@nuevo.socio");
    expect(handle({ nickname: "", email: "x@y.es" })).toBe("x@y.es");
  });
});
