import { describe, expect, it } from "vitest";
import type { AdminMatch } from "../../data/adminLogic";
import { groupOf, hasScore, rowToca, stateWord } from "./matchWords";
import { hoyLede, semana, tocaList, type MatchRow, type TocaInput } from "./hoyModel";
import { answersOf } from "./rsvp";
import { isoDay, left, relDay } from "./fmt";

const NOW = Date.UTC(2026, 10, 2, 9, 0); // lunes 2 nov 2026, 10:00 Madrid
const D = 86_400_000;
const match = (o: Partial<AdminMatch>): AdminMatch => ({ id: "m", rival: "Pitutis", seasonId: "t1", date: NOW - D, status: "scheduled", published: true, draft: false, jornada: 2, ...o }) as AdminMatch;
const review = { goalsFor: 0, goalsAgainst: 0, missingScorers: 0, cuadra: false };
const base: TocaInput = { now: NOW, matches: [], next: null, claims: [], door: [], caja: [], proposals: [], gaps: [], drafts: [], emptySeason: null };

describe("Te toca (hoyModel.tocaList)", () => {
  it("B-HOY-11: a match that never reached la mesa asks «¿Se jugó?» with its three ways, never an «E 0–0»", () => {
    const rows: MatchRow[] = [{ m: match({}), phase: "pendiente", review }];
    const [t] = tocaList({ ...base, matches: rows });
    expect(t.title).toBe("J2 · Pitutis no llegó a la mesa");
    expect(t.detail).toMatch(/¿Se jugó\? Apunta el resultado, o márcalo aplazado o cancelado\./);
    expect(t.detail).not.toMatch(/0–0|\bE\b/);
    expect(t.action).toBe("Apuntar el resultado");
    expect(t.path).toBe("/admin/partidos/m/acta");
    expect(t.alt).toEqual([
      { t: "Aplazado", path: "/admin/partidos/m/datos?estado=aplazado" },
      { t: "No se jugó", path: "/admin/partidos/m/datos?estado=cancelado" },
    ]);
  });

  it("an acta: «falta 1 goleador» → Completar; one that squares → Publicar; most urgent first", () => {
    const rows: MatchRow[] = [
      { m: match({ id: "a" }), phase: "final", review: { goalsFor: 3, goalsAgainst: 1, missingScorers: 1, cuadra: false } },
      { m: match({ id: "b", jornada: 3 }), phase: "final", review: { goalsFor: 2, goalsAgainst: 0, missingScorers: 0, cuadra: true } },
    ];
    const out = tocaList({ ...base, matches: rows, caja: [{ shirt: "ERIK", amount: 1250 }], claims: [{ uid: "u", nick: "nuevo", shirt: "KEVIN" }] });
    expect(out.map((t) => t.title)).toEqual(["Acta J2 · falta 1 goleador", "Acta J3 · lista para publicar", "@nuevo pide la camiseta de KEVIN", "1 pago avisado por confirmar"]);
    expect(out[0]).toMatchObject({ action: "Completar", path: "/admin/partidos/a/acta" });
    expect(out[1]).toMatchObject({ action: "Publicar", path: "/admin/partidos/b/publicar" });
    expect(out[3].detail).toBe("ERIK 12,50 €");
  });

  it("B-HOY-07: a published acta with a correction in a draft is not an acta to publish: «corrección sin publicar»", () => {
    const out = tocaList({ ...base, matches: [{ m: match({ draft: true }), phase: "publicado", review }] });
    expect(out).toEqual([expect.objectContaining({ title: "Acta J2 · corrección sin publicar", action: "Revisar" })]);
  });

  it("the next match within four days: who hasn't answered (after the notice) and nobody keeping la mesa", () => {
    const m = match({ id: "n", date: NOW + 2 * D, convocatoriaNotifiedAt: NOW - D });
    const out = tocaList({ ...base, next: { m, unanswered: ["FER", "KEVIN", "ANDIA", "ERIK"], notified: true, scorer: false } });
    expect(out.map((t) => [t.title, t.detail, t.action])).toEqual([
      ["J2 · 4 sin responder", "FER, KEVIN y ANDIA y 1 más", "Recordar"],
      ["J2 · nadie anota en la mesa", "Elige quién lleva la mesa el miércoles", "Elegir"],
    ]);
  });

  it("a new season without matches: «Nuevo partido» first", () => {
    expect(tocaList({ ...base, emptySeason: { name: "Temporada 2" } })[0]).toMatchObject({ title: "La Temporada 2 no tiene partidos", path: "/admin/partidos/nuevo" });
  });
});

describe("the week and the line under «Hoy»", () => {
  it("the days from the last jornada to the next, today marked, each hito on its day", () => {
    const last = match({ id: "l", date: NOW - 6 * D });
    const next = match({ id: "x", date: NOW + 6 * D, rival: "MAD SKY", jornada: 3 });
    const days = semana({ now: NOW, matches: [{ m: last, phase: "publicado", review }, { m: next, phase: "antes", review }], last, next, trainings: [{ at: NOW + 2 * D, place: "Palomeras", confirmed: true }], reminders: () => true });
    expect(days[0].dd).toBe(27);
    expect(days.at(-1)?.dd).toBe(8);
    expect(days.find((d) => d.today)?.dd).toBe(2);
    expect(days.find((d) => d.dd === 27)?.hitos[0]).toMatchObject({ kind: "hecho", text: "J2 · PIT · 10:00" });
    expect(days.find((d) => d.dd === 8)?.hitos[0]).toMatchObject({ kind: "partido", text: "J3 · MAD · 10:00", path: "/admin/partidos/x" });
    expect(days.find((d) => d.dd === 4)?.hitos[0]).toMatchObject({ kind: "auto", text: "Entreno · Palomeras" });
  });

  it("the line says the moment: «¿se jugó?», a correction in a draft (B-HOY-07), the next match", () => {
    expect(hoyLede(NOW, { m: match({}), phase: "pendiente" })).toBe("Lunes 2 de noviembre · la J2 no llegó a la mesa: ¿se jugó?");
    expect(hoyLede(NOW, { m: match({ draft: true }), phase: "publicado" })).toBe("Lunes 2 de noviembre · acta publicada, con una corrección en borrador");
    expect(hoyLede(NOW, { m: match({ date: NOW + D, home: false, rival: "Red Demons" }), phase: "antes" })).toBe("Lunes 2 de noviembre · mañana juega el Piti en el campo de Red Demons");
    expect(hoyLede(NOW, null)).toBe("Lunes 2 de noviembre · no hay partidos a la vista");
  });
});

describe("what a match is (matchWords)", () => {
  it("B-PAR-03: a cancelled draft is «Cancelado · borrador», out («Fuera»), never «Publicada»", () => {
    const m = match({ published: false, draft: true, status: "cancelled" });
    expect(stateWord("cancelado", m)).toBe("Cancelado · borrador");
    expect(groupOf("cancelado")).toBe("fuera");
  });
  it("B-HOY-11: no score for a match that was not played", () => {
    expect(hasScore("pendiente")).toBe(false);
    expect(hasScore("final")).toBe(true);
    expect(stateWord("pendiente", match({}))).toBe("Sin acta");
  });
  it("a row is yours to do: an acta, «¿Se jugó?», the next match's convocatoria within four days", () => {
    const st = (state: "toca" | "hecho") => [{ id: "convocatoria" as const, state, name: "", icon: "shirt" as const, word: "", path: "" }];
    expect(rowToca({ phase: "pendiente", stations: [], date: NOW, isNext: false, now: NOW })).toBe(true);
    expect(rowToca({ phase: "antes", stations: st("toca"), date: NOW + 2 * D, isNext: true, now: NOW })).toBe(true);
    expect(rowToca({ phase: "antes", stations: st("toca"), date: NOW + 9 * D, isNext: true, now: NOW })).toBe(false);
  });
});

describe("the convocatoria by answer (rsvp.answersOf)", () => {
  it("an absence that covers the day puts him among «No vienen» with its date; a «Voy» wins over it", () => {
    const m = match({ date: Date.UTC(2026, 10, 8, 11, 0) });
    const abs = [
      { id: "a1", uid: "u1", playerId: "fer", name: "fer", from: "2026-11-05", to: "2026-11-12", note: "", createdAt: 0 },
      { id: "a2", uid: "u2", playerId: "erik", name: "erik", from: "2026-11-01", to: "2026-11-09", note: "", createdAt: 0 },
    ];
    const a = answersOf({ match: m, roster: [{ id: "fer" }, { id: "erik" }, { id: "kevin" }], answers: [{ response: "yes", playerId: "erik" }], absences: abs });
    expect(a.groups.find((g) => g.id === "no")?.people).toEqual([{ id: "fer", absent: true, until: "12 nov" }]);
    expect(a.word.get("fer")).toBe("ausente hasta el 12 nov");
    expect(a.word.get("erik")).toBe("viene");
    expect(a.counts).toMatchObject({ yes: 1, no: 0, absent: 1, none: 1, all: 3 });
  });
});

describe("fmt", () => {
  it("relDay, left, isoDay", () => {
    expect(relDay(NOW + D, NOW)).toBe("mañana");
    expect(relDay(NOW + 3 * D, NOW)).toBe("el jueves");
    expect(left(NOW + 2 * D + 4 * 3_600_000, NOW)).toBe("2 días");
    expect(left(NOW + D + 4 * 3_600_000, NOW)).toBe("1 d 4 h");
    expect(relDay(NOW + 13 * D, NOW)).toBe("el dom 15 nov");
    expect(isoDay("2026-11-12")).toBe("12 nov");
  });
});
