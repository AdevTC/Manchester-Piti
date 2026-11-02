import { describe, expect, it } from "vitest";
import { PLACE_IDS, PLAN_PARTS, PZ_KEYS, parsePizarra, pizarraHref } from "./routes";

describe("parsePizarra", () => {
  it("reads /pizarra and /pizarra/ as the siete", () => {
    expect(parsePizarra("/pizarra")).toEqual({ place: "siete", sub: "", q: {} });
    expect(parsePizarra("/pizarra/")).toEqual({ place: "siete", sub: "", q: {} });
  });

  it("reads every place", () => {
    for (const p of PLACE_IDS) expect(parsePizarra("/pizarra/" + p).place).toBe(p);
  });

  it("keeps the parameters as strings, without the season", () => {
    expect(parsePizarra("/pizarra/siete", { tablero: "b1", season: "s2", hueco: 3, capa: "quimica", vacio: "" })).toEqual({
      place: "siete",
      sub: "",
      q: { tablero: "b1", hueco: "3", capa: "quimica" },
    });
  });

  it("reads the plan's parts and refuses others", () => {
    for (const part of PLAN_PARTS) expect(parsePizarra("/pizarra/plan/" + part)).toEqual({ place: "plan", sub: part, q: {} });
    expect(parsePizarra("/pizarra/plan/otra").place).toBe("perdido");
  });

  it("reads a jugada's id", () => {
    expect(parsePizarra("/pizarra/jugadas/lib-corner")).toEqual({ place: "jugadas", sub: "lib-corner", q: {} });
    expect(parsePizarra("/pizarra/jugadas/a b").place).toBe("perdido");
  });

  it("reads Comparar and refuses other Tableros subs", () => {
    expect(parsePizarra("/pizarra/tableros/comparar", { a: "b:x:titular" })).toEqual({ place: "tableros", sub: "comparar", q: { a: "b:x:titular" } });
    expect(parsePizarra("/pizarra/tableros/otro").place).toBe("perdido");
  });

  it("gives no sub to the places without one", () => {
    for (const p of ["siete", "partido", "pachanga", "charla"]) expect(parsePizarra("/pizarra/" + p + "/x").place).toBe("perdido");
  });

  it("sends anything else to the pizarra's 404 with the address", () => {
    expect(parsePizarra("/pizarra/nada")).toEqual({ place: "perdido", sub: "/pizarra/nada", q: {} });
    expect(parsePizarra("/pizarra/plan/rival/mas").place).toBe("perdido");
    expect(parsePizarra("/otra").place).toBe("perdido");
  });

  it("ignores a trailing slash", () => {
    expect(parsePizarra("/pizarra/plan/rival/")).toEqual({ place: "plan", sub: "rival", q: {} });
  });
});

describe("pizarraHref", () => {
  it("writes a place, its sub and its parameters", () => {
    expect(pizarraHref("siete")).toBe("/pizarra/siete");
    expect(pizarraHref("plan", "rival")).toBe("/pizarra/plan/rival");
    expect(pizarraHref("tableros", "comparar", { b: "b:x:titular", a: "b:y:titular" })).toBe("/pizarra/tableros/comparar?a=b%3Ay%3Atitular&b=b%3Ax%3Atitular");
  });

  it("drops empty values and orders keys stably (the pizarra's first)", () => {
    expect(pizarraHref("siete", "", { zeta: "1", hoja: "ficha", tablero: "b1", jugador: undefined, alfa: "", beta: "2" })).toBe("/pizarra/siete?tablero=b1&hoja=ficha&beta=2&zeta=1");
  });

  it("round-trips through parsePizarra", () => {
    const href = pizarraHref("partido", "", { desde: "mesa", partido: "m 1" });
    const url = new URL(href, "http://x");
    expect(parsePizarra(url.pathname, Object.fromEntries(url.searchParams))).toEqual({ place: "partido", sub: "", q: { partido: "m 1", desde: "mesa" } });
  });

  it("lists the reserved keys", () => {
    expect(PZ_KEYS).toContain("tablero");
    expect(PZ_KEYS).toContain("hoja");
  });
});
