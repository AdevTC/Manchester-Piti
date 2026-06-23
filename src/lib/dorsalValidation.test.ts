import { describe, it, expect } from "vitest";
import {
  isDorsalTaken,
  findDorsalConflict,
  resolveDorsalForSeason,
  type RosterPlayerLike,
} from "./dorsalValidation";

const roster: RosterPlayerLike[] = [
  // p1: number 10 in s1 via the scalar default (no seasonDetails override).
  { id: "p1", number: 10, seasons: ["s1"] },
  // p2: scalar 7, but a per-season override of 9 in s2.
  { id: "p2", number: 7, seasons: ["s2"], seasonDetails: { s2: { number: 9 } } },
  // p3: in both s1 and s2; override 4 only in s1, falls back to scalar 4 in s2.
  { id: "p3", number: 4, seasons: ["s1", "s2"], seasonDetails: { s1: { number: 4 } } },
];

describe("isDorsalTaken", () => {
  it("detecta dorsal ocupado por el número escalar en la temporada", () => {
    expect(isDorsalTaken(roster, "s1", 10, null)).toBe(true);
  });

  it("usa el override por temporada en vez del escalar (p2: 9 en s2, no 7)", () => {
    expect(isDorsalTaken(roster, "s2", 9, null)).toBe(true);
    expect(isDorsalTaken(roster, "s2", 7, null)).toBe(false); // 7 es su escalar, no su dorsal en s2
  });

  it("cae al escalar cuando no hay override para esa temporada (p3: 4 en s2)", () => {
    expect(isDorsalTaken(roster, "s2", 4, null)).toBe(true);
  });

  it("ignora jugadores que no están en la temporada", () => {
    expect(isDorsalTaken(roster, "s1", 9, null)).toBe(false); // 9 es de p2 en s2
  });

  it("excluye al jugador en edición (editingPlayerId)", () => {
    // p1 tiene el 10 en s1; si editamos a p1, el 10 NO debe contar como duplicado.
    expect(isDorsalTaken(roster, "s1", 10, "p1")).toBe(false);
    // pero sí cuenta para cualquier otro jugador en edición.
    expect(isDorsalTaken(roster, "s1", 10, "p2")).toBe(true);
  });

  it("devuelve false en una temporada sin colisión", () => {
    expect(isDorsalTaken(roster, "s1", 99, null)).toBe(false);
  });
});

describe("findDorsalConflict", () => {
  it("devuelve la primera colisión por temporada con su número", () => {
    const conflict = findDorsalConflict(roster, ["s2", "s1"], (s) => (s === "s1" ? 10 : 99), null);
    expect(conflict).toEqual({ seasonId: "s1", number: 10 });
  });

  it("devuelve null cuando todas las temporadas seleccionadas están libres", () => {
    expect(findDorsalConflict(roster, ["s1", "s2"], () => 99, null)).toBeNull();
  });

  it("respeta editingPlayerId al recorrer las temporadas", () => {
    // Editamos a p1 reusando su 10 en s1 → sin conflicto.
    expect(findDorsalConflict(roster, ["s1"], () => 10, "p1")).toBeNull();
  });

  it("resuelve el dorsal por temporada vía el callback (override vs escalar)", () => {
    // En s2 el 9 está tomado por p2 (override); el callback devuelve 9 para s2.
    const conflict = findDorsalConflict(roster, ["s2"], () => 9, null);
    expect(conflict).toEqual({ seasonId: "s2", number: 9 });
  });
});

describe("resolveDorsalForSeason", () => {
  it("usa el override por temporada cuando está presente", () => {
    expect(resolveDorsalForSeason("s1", 10, { s1: { number: 5 } })).toBe(5);
  });

  it("cae al escalar cuando no hay override para la temporada", () => {
    expect(resolveDorsalForSeason("s2", 10, { s1: { number: 5 } })).toBe(10);
  });

  it("cae al escalar cuando el override está en blanco ('')", () => {
    expect(resolveDorsalForSeason("s1", 7, { s1: { number: "" } })).toBe(7);
  });

  it("devuelve NaN cuando no hay ni override ni escalar", () => {
    expect(resolveDorsalForSeason("s1", undefined, {})).toBeNaN();
  });
});
