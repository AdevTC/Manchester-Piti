import { describe, expect, it } from "vitest";
import type { Absence } from "../../../lib/derived/absences";
import { absenceChip, ausenciasDraft, ausenciasHead, ausenciasMatchesLine, ausenciasRibbon, ausenciasTeamLine, teamRows, upMatches, type UpMatch } from "./ausenciasView";

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

describe("the room as the prototype draws it", () => {
  // (today is Friday 23 Oct 2026: the ribbon starts on Monday 19)
  const up: UpMatch[] = [
    { id: "m3", j: "J3", name: "J3 contra Red Demons", day: "2026-11-01" },
    { id: "m4", j: "J4", name: "J4 contra Pitutis", day: "2026-11-08" },
    { id: "far", j: "J9", name: "J9 contra Lejos", day: "2027-02-01" },
  ];
  it("upMatches: the answerable ones, named, with their Madrid day", () => {
    const slots = [
      { id: "m3", status: "scheduled", date: Date.UTC(2026, 10, 1, 13) },
      { id: "gone", status: "finished", date: Date.UTC(2026, 9, 18, 13) },
      { id: "x", status: "scheduled", date: Date.UTC(2026, 10, 8, 23, 30) },
    ];
    expect(upMatches(slots, NOW, [{ id: "m3", rival: "Red Demons" }], new Map([["m3", 3]]))).toEqual([
      { id: "m3", j: "J3", name: "J3 contra Red Demons", day: "2026-11-01" },
      { id: "x", j: "Partido", name: "Partido", day: "2026-11-09" },
    ]);
  });
  it("the head: none, under way, to come with its matches", () => {
    expect(ausenciasHead([], TODAY, up).title).toBe("Ninguna ausencia apuntada");
    const under = ausenciasHead([{ from: "2026-10-20", to: "2026-11-02" }, { from: "2026-12-01", to: "2026-12-03" }], TODAY, up);
    expect(under.title).toBe("Fuera hasta el 2 nov y 1 más");
    expect(under.sub).toBe("Contestamos «No puedo» por ti en la J3 contra Red Demons. Si al final puedes, cámbialo a mano en el partido.");
    const later = ausenciasHead([{ from: "2026-12-01", to: "2026-12-03" }], TODAY, up);
    expect(later.title).toBe("Fuera del 1 al 3 dic");
    expect(later.sub).toBe("No hay partidos en esas fechas todavía: si se publica alguno, contestamos «No puedo» por ti.");
  });
  it("the draft: a hint, the problem, or what will happen", () => {
    expect(ausenciasDraft(TODAY, "", TODAY, up, false)).toMatchObject({ showErr: false, hint: true });
    expect(ausenciasDraft(TODAY, "", TODAY, up, true)).toMatchObject({ err: "Elige las dos fechas.", showErr: true, hint: false });
    expect(ausenciasDraft("2026-10-01", "2026-10-02", TODAY, up, false)).toMatchObject({ err: "Esa fecha ya pasó.", showErr: true });
    expect(ausenciasDraft("2026-10-31", "2026-11-09", TODAY, up, false)).toMatchObject({ k: "Del 31 oct al 9 nov · lo que pasará", text: "Contestaremos «No puedo» en: J3 contra Red Demons y J4 contra Pitutis" });
    expect(ausenciasDraft("2026-12-01", "2026-12-02", TODAY, up, false).k).toBe("Del 1 al 2 dic · sin partidos");
  });
  it("the date chip", () => {
    expect(absenceChip({ from: "2026-11-12", to: "2026-11-16" })).toEqual({ big: "12–16", mon: "nov" });
    expect(absenceChip({ from: "2026-11-12", to: "2026-11-12" })).toEqual({ big: "12", mon: "nov" });
    expect(absenceChip({ from: "2026-10-28", to: "2026-11-03" })).toEqual({ big: "28–3", mon: "oct–nov" });
  });
  it("the team's rows: how long, and the matches each one misses", () => {
    const rows = teamRows(
      [
        { key: "a", name: "Andia", num: "7", from: "2026-10-20", to: "2026-11-02", note: "viaje" },
        { key: "b", name: "Brawan", num: "", from: "2026-12-01", to: "2026-12-02", note: "" },
      ],
      TODAY,
      up,
    );
    expect(rows.map((r) => [r.line, r.miss])).toEqual([
      ["Hasta el 2 nov · viaje", "Falta a 1 partido"],
      ["Del 1 al 2 dic", "Sin partidos"],
    ]);
  });
  it("the ribbon: eight weeks from Monday, today, the jornadas in it, the bars and the draft", () => {
    const r = ausenciasRibbon(TODAY, up, [{ id: "a1", from: "2026-10-31", to: "2026-11-02" }], [{ key: "t", name: "Andia", num: "7", from: "2026-10-01", to: "2026-10-27", note: "viaje" }], { from: "2026-11-07", to: "2026-11-09" });
    expect(r.weeks.map((w) => w.t)).toEqual(["Esta semana", "26 oct–1 nov", "2–8 nov", "9–15 nov", "16–22 nov", "23–29 nov", "30 nov–6 dic", "7–13 dic"]);
    expect(r.meta).toBe("Hasta el 13 dic · 2 jornadas");
    // (Friday of the first week: 4 days in, of 56)
    expect(r.past).toBe("7.143%");
    expect(r.marks.map((m) => [m.j, m.day, m.no, m.fresh])).toEqual([
      ["J3", "dom 1", true, false],
      ["J4", "dom 8", false, true],
    ]);
    expect(r.myBars).toEqual([expect.objectContaining({ who: "Tú", t: "del 31 oct al 2 nov · No puedo en la J3", cut: false })]);
    expect(r.newBar).toMatchObject({ who: "Nueva", t: "del 7 al 9 nov" });
    expect(r.teamBars).toEqual([expect.objectContaining({ who: "Andia", t: "hasta el 27 oct · viaje", cut: true, bar: { left: "0.000%", width: "16.071%" } })]);
    expect(r.aria).toBe("Las próximas 8 semanas. Partidos: J3 el 1 nov, contestamos No puedo; J4 el 8 nov. Tú: fuera del 31 oct al 2 nov. Andia: hasta el 27 oct.");
  });
});
