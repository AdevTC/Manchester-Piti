import { describe, expect, it } from "vitest";
import { pizarraSearchSchema } from "./router";

// La pizarra's parameters (router.tsx): typed where the pizarra names them, permissive for a place's own sheet
// arguments, garbage dropped.
describe("pizarraSearchSchema", () => {
  it("keeps the known keys, as text (a number too)", () => {
    expect(pizarraSearchSchema({ tablero: "b1", hoja: "ficha", jugador: "erik", hueco: 3, capa: "quimica", modo: "dibujar" })).toEqual({ tablero: "b1", hoja: "ficha", jugador: "erik", hueco: "3", capa: "quimica", modo: "dibujar" });
  });

  it("drops a known key with a wrong value", () => {
    expect(pizarraSearchSchema({ capa: "otra", modo: "x", tablero: "", hoja: { a: 1 } })).toEqual({});
  });

  it("keeps any other short lowercase key with a short text, drops the rest", () => {
    const out = pizarraSearchSchema({ rival: "red", "pg-equipo": "2", Mayus: "x", "1a": "x", lista: ["a"], largo: "x".repeat(201), vacio: "" }) as Record<string, unknown>;
    expect(out).toEqual({ rival: "red", "pg-equipo": "2" });
  });

  it("leaves the season to the root", () => {
    expect(pizarraSearchSchema({ season: "t1", tablero: "b1" })).toEqual({ tablero: "b1" });
  });
});
