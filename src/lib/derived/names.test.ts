import { describe, expect, it } from "vitest";
import { nameFor, nameSegments, seasonShirtName } from "./names";
import { playerForSeason, playerName } from "../clubData";
import { nameIn } from "../../pages/admin/club/plantillaLogic";
import type { PlayerDoc } from "../schemas";

const pepe = { id: "p1", shirtName: "PEPE", firstName: "José", lastName: "Pérez", seasons: ["t1", "t2"], seasonDetails: { t2: { shirtName: "PEPITO", number: 7 } } };

describe("nameFor: the one name rule", () => {
  it("the season's shirt name, then shirtName, then first + last, then «Jugador»", () => {
    expect(nameFor(pepe, "t2")).toBe("PEPITO");
    expect(nameFor(pepe, "t1")).toBe("PEPE");
    expect(nameFor(pepe)).toBe("PEPE");
    expect(nameFor({ firstName: "José", lastName: "Pérez" }, "t2")).toBe("José Pérez");
    expect(nameFor({ firstName: "José" })).toBe("José");
    expect(nameFor({})).toBe("Jugador");
    expect(nameFor(undefined, "t2")).toBe("Jugador");
    expect(nameFor(null)).toBe("Jugador");
  });

  it("«all seasons», a blank season name or a malformed detail fall back to the shirt name", () => {
    expect(nameFor(pepe, "all")).toBe("PEPE");
    expect(nameFor({ ...pepe, seasonDetails: { t2: { shirtName: "  " } } }, "t2")).toBe("PEPE");
    expect(nameFor({ ...pepe, seasonDetails: { t2: "PEPITO" } }, "t2")).toBe("PEPE");
    expect(nameFor({ ...pepe, seasonDetails: { t2: { shirtName: 7 } } }, "t2")).toBe("PEPE");
    expect(seasonShirtName(pepe, null)).toBeUndefined();
  });

  it("agrees with playerForSeason (home, club, plantilla), the deprecated playerName and the admin's nameIn", () => {
    for (const sid of ["t1", "t2"]) expect(playerName(playerForSeason(pepe, sid, [{ id: "t1" }, { id: "t2" }]))).toBe(nameFor(pepe, sid));
    expect(nameIn(pepe as unknown as PlayerDoc, "t2")).toBe("PEPITO");
    expect(nameIn(pepe as unknown as PlayerDoc, undefined)).toBe("PEPE");
    expect(playerName(pepe)).toBe(nameFor(pepe));
  });
});

describe("nameSegments: a sentence cut around the players it names", () => {
  const people = [
    { id: "p1", name: "PEPE" },
    { id: "p2", name: "LUIS" },
  ];
  it("each name with his id, the rest as text", () => {
    expect(nameSegments("PEPE marca, con asistencia de LUIS. 1–0.", people)).toEqual([
      { text: "PEPE", id: "p1" },
      { text: " marca, con asistencia de " },
      { text: "LUIS", id: "p2" },
      { text: ". 1–0." },
    ]);
  });
  it("every occurrence, and nobody named: one piece of text", () => {
    expect(nameSegments("Penalti para MAD SKY y PEPE lo detiene, PEPE.", people).filter((s) => s.id)).toHaveLength(2);
    expect(nameSegments("Expulsión por roja directa.", people)).toEqual([{ text: "Expulsión por roja directa." }]);
    expect(nameSegments("", people)).toEqual([]);
  });
  it("the longer name wins where two start at the same place; empty names are ignored", () => {
    expect(nameSegments("Entra ANA MARÍA", [{ id: "a", name: "ANA" }, { id: "am", name: "ANA MARÍA" }, { id: "x", name: "" }])).toEqual([{ text: "Entra " }, { text: "ANA MARÍA", id: "am" }]);
  });
});
