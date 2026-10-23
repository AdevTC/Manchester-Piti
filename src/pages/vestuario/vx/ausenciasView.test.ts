import { describe, expect, it } from "vitest";
import type { Absence } from "../../../lib/derived/absences";
import { ausenciasMatchesLine, ausenciasTeamLine } from "./ausenciasView";

const abs = (extra: Partial<Absence>): Absence => ({ id: "a1", uid: "u1", playerId: "erik", name: "erik", from: "2026-10-31", to: "2026-11-09", note: "", createdAt: 1, ...extra });
const NOW = Date.UTC(2026, 9, 23, 10);
const TODAY = "2026-10-23";

describe("ausenciasMatchesLine", () => {
  const slots = [
    { id: "m3", status: "scheduled", date: Date.UTC(2026, 10, 1, 13) },
    { id: "m4", status: "scheduled", date: Date.UTC(2026, 10, 8, 13) },
    { id: "out", status: "scheduled", date: Date.UTC(2026, 10, 20, 13) },
  ];
  const matches = [
    { id: "m3", rival: "Red Demons" },
    { id: "m4", rival: "Pitutis" },
    { id: "out", rival: "Otros" },
  ];
  const jornada = new Map([
    ["m3", 3],
    ["m4", 4],
  ]);
  it("names the matches in the dates, as the board does", () => {
    expect(ausenciasMatchesLine(slots, { from: "2026-10-31", to: "2026-11-02" }, NOW, matches, jornada)).toBe("1 partido en esas fechas: J3 contra Red Demons");
    expect(ausenciasMatchesLine(slots, { from: "2026-10-31", to: "2026-11-09" }, NOW, matches, jornada)).toBe("2 partidos en esas fechas: J3 contra Red Demons y J4 contra Pitutis");
  });
  it("says when there are none yet", () => {
    expect(ausenciasMatchesLine(slots, { from: "2026-12-01", to: "2026-12-09" }, NOW, matches, jornada)).toBe("Sin partidos en esas fechas por ahora");
  });
});

describe("ausenciasTeamLine", () => {
  const name = (a: Absence) => a.name;
  it("everyone else's, under way or to come, with the note", () => {
    const list = [abs({ id: "x", uid: "u2", name: "Andia", from: "2026-10-20", to: "2026-10-27", note: "viaje" }), abs({ id: "y", uid: "u3", name: "Kevin", from: "2026-11-02", to: "2026-11-09" }), abs({ uid: "u1" })];
    expect(ausenciasTeamLine(list, "u1", TODAY, name)).toBe("En el equipo: Andia, hasta el 27 (viaje); Kevin, del 2 al 9 nov.");
  });
  it("another month, today, and nobody", () => {
    expect(ausenciasTeamLine([abs({ uid: "u2", name: "Andia", from: "2026-10-20", to: "2026-11-03" })], "u1", TODAY, name)).toBe("En el equipo: Andia, hasta el 3 nov.");
    expect(ausenciasTeamLine([abs({ uid: "u2", name: "Andia", from: "2026-10-20", to: TODAY })], "u1", TODAY, name)).toBe("En el equipo: Andia, hasta hoy.");
    expect(ausenciasTeamLine([abs({ uid: "u1" })], "u1", TODAY, name)).toBe("");
  });
});
