import { describe, expect, it } from "vitest";
import { hrefOf, readSearch, screenOf, travelOf } from "./nav";

describe("Inicio's addresses", () => {
  it("reads the screen from the path", () => {
    expect(screenOf("/")).toBe("portada");
    expect(screenOf("/hoy/campo")).toBe("campo");
    expect(screenOf("/hoy/jugadas/")).toBe("jugadas");
    expect(screenOf("/hoy/lo-tuyo")).toBe("lo-tuyo");
    expect(screenOf("/camiseta")).toBe("camiseta");
  });

  it("reads the minute, the sheet and the open row, and drops what is not theirs", () => {
    expect(readSearch({ min: "36", hoja: "mvp", jugador: "alcides" })).toEqual({ min: 36, hoja: "mvp", jugador: "alcides" });
    expect(readSearch({ min: 12 })).toEqual({ min: 12, hoja: null, jugador: null });
    expect(readSearch({ min: "-3", hoja: "buscar" })).toEqual({ min: null, hoja: null, jugador: null });
    expect(readSearch({})).toEqual({ min: null, hoja: null, jugador: null });
  });

  it("writes the minute on the match's screens only, and the row on /hoy/campo only", () => {
    expect(hrefOf("portada", { min: 36 })).toBe("/?min=36");
    expect(hrefOf("campo", { min: 20, jugador: "jordi" })).toBe("/hoy/campo?min=20&jugador=jordi");
    expect(hrefOf("jugadas", { min: null, jugador: "jordi" })).toBe("/hoy/jugadas");
    expect(hrefOf("lo-tuyo", { min: 20, hoja: "porra" })).toBe("/hoy/lo-tuyo?hoja=porra");
    expect(hrefOf("camiseta", { min: 20 })).toBe("/camiseta");
  });

  it("travels right going deeper and left going home", () => {
    expect(travelOf("portada", "campo")).toBe("right");
    expect(travelOf("campo", "jugadas")).toBe("right");
    expect(travelOf("jugadas", "campo")).toBe("left");
    expect(travelOf("camiseta", "portada")).toBe("left");
  });
});
