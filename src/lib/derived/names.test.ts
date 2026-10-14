import { describe, expect, it } from "vitest";
import { nameFor, seasonShirtName } from "./names";
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
