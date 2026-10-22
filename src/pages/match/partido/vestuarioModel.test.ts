import { describe, expect, it } from "vitest";
import { badgeTextOf, bestLine, blockOrder, euros, foldOf, goalsOf, hintOf, porraDistribution, subOf, tasksOf, teamRank, verdict, verdictWord, type Who } from "./vestuarioModel";

const J: Who = { member: true, isJ: true, isMesa: false };
const SOCIO: Who = { member: true, isJ: false, isMesa: false };
const MESA: Who = { member: true, isJ: false, isMesa: true };
const FAN: Who = { member: false, isJ: false, isMesa: false };
const NONE = { rsvp: false, porra: false, caja: false, mvp: false, nota: false };

describe("the porra's verdict", () => {
  it("is exact, one goal off or further", () => {
    expect(verdict({ gf: 1, ga: 8 }, { us: 1, them: 8 })).toBe("exacta");
    expect(verdict({ gf: 1, ga: 7 }, { us: 1, them: 8 })).toBe("cerca");
    expect(verdict({ gf: 2, ga: 1 }, { us: 1, them: 8 })).toBe("lejos");
    expect(verdict(null, { us: 0, them: 0 })).toBeNull();
    expect(verdictWord("exacta", false)).toBe("La clavas");
    expect(verdictWord("exacta", true)).toBe("La clavaste");
    expect(verdictWord("lejos", true)).toBe("Esta vez no");
  });
});

describe("what is left to do", () => {
  it("before the whistle: ¿Vas?, the porra and the caja, in that order", () => {
    expect(tasksOf("antes", J, { ...NONE, caja: true, rsvp: true, porra: true })).toEqual(["rsvp", "porra", "caja"]);
    expect(tasksOf("pitido", J, { ...NONE, porra: true, mvp: true })).toEqual(["porra"]);
  });
  it("with the acta: the MVP, the nota and the caja; nothing live or for a fan", () => {
    expect(tasksOf("acta", J, { ...NONE, nota: true, mvp: true })).toEqual(["mvp", "nota"]);
    expect(tasksOf("segunda", J, { ...NONE, rsvp: true, mvp: true })).toEqual([]);
    expect(tasksOf("acta", FAN, { ...NONE, mvp: true })).toEqual([]);
  });
  it("says it in the badge", () => {
    expect(badgeTextOf(["mvp", "nota", "caja"])).toBe("3 cosas pendientes: votar al MVP, la nota y la caja");
    expect(badgeTextOf(["rsvp"])).toBe("1 cosa pendiente: decir si vas");
    expect(badgeTextOf([])).toBe("");
  });
});

describe("the tab's second line", () => {
  it("follows the board", () => {
    expect(hintOf("antes", FAN, [], null, null)).toEqual(["Solo el equipo", "Del equipo"]);
    expect(hintOf("antes", J, ["rsvp"], null, null)).toEqual(["¿Vas? Aún no has respondido", "¿Vas?"]);
    expect(hintOf("antes", J, [], null, null)).toEqual(["Lo tienes todo", "Todo hecho"]);
    expect(hintOf("primera", MESA, [], null, null)).toEqual(["Hoy anotas tú", "Anotas tú"]);
    expect(hintOf("segunda", J, [], { word: "No la clavas" }, null)).toEqual(["Tu porra: no la clavas", "No la clavas"]);
    expect(hintOf("final", SOCIO, [], null, null)).toEqual(["La porra del equipo", "La porra"]);
    expect(hintOf("despues", J, ["nota"], null, "Alcides")).toEqual(["MVP: Alcides", "MVP"]);
    expect(hintOf("acta", J, [], null, null)).toEqual(["Votado y con nota", "Hecho"]);
    expect(hintOf("aplazado", J, [], null, null)).toEqual(["Todo en pausa", "En pausa"]);
    expect(hintOf("pendiente", SOCIO, [], null, null)).toEqual(["La porra espera", "Sin acta"]);
  });
  it("and the screen's subtitle", () => {
    expect(subOf("antes", J, ["rsvp", "porra"], null, "")).toBe("Te quedan 2 cosas: decir si vas y tu porra");
    expect(subOf("acta", J, ["mvp"], null, "")).toBe("Te queda una cosa: votar al MVP");
    expect(subOf("despues", SOCIO, [], null, "")).toBe("El MVP, a falta del recuento · la nota sigue abierta");
    expect(subOf("antes", MESA, ["porra"], null, "Hoy anotas tú")).toBe("Hoy anotas tú · y tu porra");
    expect(subOf("antes", FAN, [], null, "")).toBe("Solo para el equipo");
  });
});

describe("the order of the blocks", () => {
  it("puts what is left first, then the rest, as the board does", () => {
    expect(blockOrder({ fase: "antes", who: J, tasks: ["rsvp", "porra", "caja"], has: {} })).toEqual(["rsvp", "porra", "caja", "quedada", "turnos", "ausentes"]);
    expect(blockOrder({ fase: "antes", who: J, tasks: [], has: {} })).toEqual(["ready", "quedada", "rsvp", "porra", "turnos", "caja", "ausentes"]);
    expect(blockOrder({ fase: "acta", who: J, tasks: ["mvp", "nota"], has: {} })).toEqual(["mvp", "nota", "partido", "res", "team", "caja", "turnos"]);
    expect(blockOrder({ fase: "despues", who: SOCIO, tasks: [], has: {} })).toEqual(["mvp", "partido", "nota", "res", "team"]);
    expect(blockOrder({ fase: "segunda", who: MESA, tasks: [], has: {} })).toEqual(["mesa", "live", "team", "turnos"]);
    expect(blockOrder({ fase: "acta", who: FAN, tasks: [], has: {} })).toEqual(["pub", "door"]);
    expect(blockOrder({ fase: "antes", who: FAN, tasks: [], has: {} })).toEqual(["door"]);
    expect(blockOrder({ fase: "aplazado", who: J, tasks: [], has: {} })).toEqual(["paused"]);
    expect(blockOrder({ fase: "pendiente", who: MESA, tasks: [], has: {} })).toEqual(["mesa", "pend", "turnos"]);
  });
  it("leaves out the blocks with nothing real behind them", () => {
    expect(blockOrder({ fase: "acta", who: J, tasks: ["mvp"], has: { caja: false, turnos: false, team: false } })).toEqual(["mvp", "partido", "nota", "res"]);
  });
  it("folds past the second on a phone, the first in glass when it holds a control", () => {
    const B = blockOrder({ fase: "acta", who: J, tasks: ["mvp", "nota"], has: {} });
    const f = foldOf(B, { open: false, tasky: { mvp: true }, isJ: true, gold: false });
    expect(f.b.mvp).toEqual({ show: true, o: 0, c: "is-now vd-glass vd-glass--clear vd-orn" });
    expect(f.b.nota).toEqual({ show: true, o: 1, c: "" });
    expect(f.b.partido).toEqual({ show: true, o: 3, c: "is-extra" });
    expect(f.b.door.show).toBe(false);
    expect(f.more).toEqual({ show: true, o: 2, n: 5, what: "tu partido, la porra de la jornada y la porra del equipo…" });
    const open = foldOf(B, { open: true, tasky: {}, isJ: true, gold: true });
    expect(open.b.mvp.c).toBe("is-lead is-gold");
    expect(open.b.partido.c).toBe("is-extra-open");
    expect(open.more.o).toBe(98);
    expect(foldOf(["pub", "door"], { open: false, tasky: { door: true }, isJ: false, gold: false }).more.show).toBe(false);
  });
});

describe("the team's porra", () => {
  const picks = [
    { uid: "a", name: "Brawan", gf: 1, ga: 3, points: 3 },
    { uid: "b", name: "Jordi", gf: 2, ga: 1, points: 2 },
    { uid: "c", name: "Adrián", gf: 1, ga: 1, points: 1 },
  ];
  it("ranks by the verdict while it is played and by the points with the acta", () => {
    const live = teamRank(picks, { us: 1, them: 2 }, { done: false, ended: false, uid: "b" });
    expect(live.map((r) => [r.name, r.v])).toEqual([
      ["Adrián", "a un gol"],
      ["Brawan", "a un gol"],
      ["Jordi", "lejos"],
    ]);
    expect(live[2]).toMatchObject({ me: true, cls: "is-me is-lejos", pick: "2–1" });
    const done = teamRank(picks, { us: 1, them: 8 }, { done: true, ended: false, uid: null });
    expect(done.map((r) => r.v)).toEqual(["3 puntos", "2 puntos", "1 punto"]);
  });
  it("draws the picks with the result first, and who took the jornada", () => {
    const d = porraDistribution([{ gf: 2, ga: 1 }, { gf: 2, ga: 1 }, { gf: 1, ga: 8 }, { gf: 3, ga: 2 }], { us: 1, them: 8 }, { gf: 3, ga: 2 });
    expect(d.exact).toBe(1);
    expect(d.rows.map((r) => [r.t, r.c, r.w, r.cls])).toEqual([
      ["1–8", 1, 50, "is-real"],
      ["2–1", 2, 100, ""],
      ["3–2", 1, 50, "is-mine"],
    ]);
    expect(bestLine(picks)).toBe("Brawan se lleva la jornada con 3: dijo 1–3.");
    expect(bestLine([{ uid: "x", name: "A", gf: 0, ga: 0, points: 2 }, { uid: "y", name: "B", gf: 1, ga: 1, points: 2 }])).toBe("A y B se llevan la jornada con 2.");
    expect(bestLine([{ uid: "x", name: "A", gf: 0, ga: 0, points: 0 }])).toBe("Nadie puntuó en esta jornada.");
    expect(bestLine([])).toBe("");
  });
  it("writes one goleador per goal (the board's one goleador and one asistencia)", () => {
    expect(goalsOf(2, "alc", "")).toEqual([{ playerId: "alc" }, { playerId: "alc" }]);
    expect(goalsOf(1, "alc", "jor")).toEqual([{ playerId: "alc", assistPlayerId: "jor" }]);
    expect(goalsOf(1, "alc", "alc")).toEqual([{ playerId: "alc" }]);
    expect(goalsOf(0, "alc", "jor")).toEqual([]);
  });
  it("says euros as the board does", () => {
    expect(euros(500)).toBe("5 €");
    expect(euros(250)).toBe("2,50 €");
  });
});
