import { describe, expect, it } from "vitest";
import type { AdminMatch } from "../../data/adminLogic";
import { afterLine, finalLine, hoyLead, pegWall, plaque, shortName, tickerText } from "./hoyModel";

const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h - 1, m); // Madrid = UTC+1
const j8: AdminMatch = { id: "m8", seasonId: "t1", rival: "MAD SKY", date: at(8, 12), status: "scheduled", home: false, kit: "away", draft: false, published: true, jornada: 8 };

describe("Hoy · the lines", () => {
  it("the lead under «Hoy» by moment", () => {
    expect(hoyLead(at(7, 22, 28), { match: j8, moment: "antes" })).toBe("Sábado 7 nov · mañana juega el Piti en el campo de MAD SKY");
    expect(hoyLead(at(8, 9), { match: j8, moment: "antes" })).toBe("Domingo 8 nov · hoy juega el Piti en el campo de MAD SKY");
    expect(hoyLead(at(5, 9), { match: { ...j8, home: true }, moment: "antes" })).toBe("Jueves 5 nov · el dom 8 nov juega el Piti en casa");
    expect(hoyLead(at(8, 12, 31), { match: j8, moment: "juego" })).toBe("Domingo 8 nov · el Piti está jugando · apunta lo que pase");
    expect(hoyLead(at(8, 14), { match: j8, moment: "final" })).toBe("Domingo 8 nov · pitado el final · falta el acta");
    expect(hoyLead(at(8, 14), null)).toBe("Domingo 8 nov · no hay partidos a la vista");
  });
  it("the plaque, the ticker, «Después» and the final line", () => {
    expect(plaque(j8, "Quedada 11:15 en el campo")).toEqual({ title: "J8 · MAD SKY", line: "dom 8 nov · 12:00 · fuera · 2ª equipación", short: "dom 8 nov · 12:00 · fuera · 2ª", note: "Quedada 11:15 en el campo" });
    expect(tickerText(j8, "Quedada 11:15")).toBe("J8 · LIGA · MAD SKY · DOMINGO 8 NOV 12:00 · CAMPO DE MAD SKY · 2ª EQUIPACIÓN · QUEDADA 11:15 · ");
    expect(afterLine({ ...j8, id: "m9", jornada: 9, rival: "EL CUARTEL CF", date: at(15, 11), home: true })).toBe("J9 · EL CUARTEL CF · dom 15 nov · 11:00 · en casa");
    expect(finalLine(j8, 2, 1)).toBe("2–1 en el campo de MAD SKY");
    expect(shortName("EGUZQUIZA")).toBe("EGUZQ.");
    expect(shortName("ERIK")).toBe("ERIK");
  });
});

describe("Hoy · the peg wall", () => {
  const roster = [
    { id: "evans", name: "EVANS", number: 1, position: "POR" },
    { id: "huberoski", name: "HUBEROSKI", number: 14, position: "MED" },
    { id: "almachi", name: "ALMACHI", number: 21, position: "MED" },
    { id: "brawan", name: "BRAWAN", number: 33, position: "DEF" },
    { id: "fer", name: "FER", number: 12, position: "POR" },
  ];
  const rsvp = new Map([
    ["evans", "si"],
    ["huberoski", "si"],
    ["almachi", "duda"],
    ["brawan", "no"],
    ["fer", "sin"],
  ] as const);
  it("seven front pegs (Libre for the gaps); the back rail: banquillo and whoever can come, not who said no", () => {
    const w = pegWall({ starters: ["evans"], bench: ["almachi"] }, roster, rsvp);
    expect(w.front).toHaveLength(7);
    expect(w.front[0]).toEqual({ id: "evans", num: "1", name: "EVANS", sub: "POR", duda: false });
    expect(w.front[1]).toEqual({ id: null, num: "", name: "", sub: "toca una de atrás", duda: false });
    expect(w.back.map((p) => [p.name, p.sub, p.duda, p.bench])).toEqual([
      ["HUBEROSKI", "Viene", false, false],
      ["ALMACHI", "Banq. · duda", true, true],
      ["FER", "Sin responder", true, false],
    ]);
  });
});
