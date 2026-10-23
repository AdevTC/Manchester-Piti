import { describe, expect, it } from "vitest";
import { EMPTY_CAJA_SETTINGS, fmtEuros, type CajaMov } from "../../../lib/derived/caja";
import { cajaMe, cajaMovRows, cajaPot, cajaTeam } from "./cajaModel";

const mov = (id: string, p: Partial<CajaMov>): CajaMov => ({ id, seasonId: "s1", kind: "cargo", playerId: "kevin", amount: 500, concept: "", date: "2026-10-18", matchId: null, by: "cap", createdAt: 1, void: false, ...p });
const MOVS = [
  mov("a", { concept: "J1 · Campo y árbitro" }),
  mov("b", { playerId: "jordi", concept: "J1 · Campo y árbitro" }),
  mov("c", { playerId: "jordi", kind: "pago", concept: "Pago por Bizum", date: "2026-10-19" }),
  mov("d", { playerId: "jordi", kind: "pago", amount: 300, concept: "Doble", date: "2026-10-20", void: true }),
  mov("e", { playerId: null, kind: "gasto", amount: 100, concept: "Agua" }),
];
const squad = [
  { id: "jordi", name: "Jordi", number: 7 },
  { id: "kevin", name: "Kevin", number: 9 },
];

describe("cajaMe", () => {
  it("says he owes, with his last cargo, and offers the claim", () => {
    const me = cajaMe(MOVS, "kevin", false);
    expect(me).toMatchObject({ cls: "is-debe", state: `Debes ${fmtEuros(500)}`, line: "J1 · Campo y árbitro, 18 oct", canClaim: true, owed: 500 });
  });
  it("waits for the captain once he said he paid", () => {
    expect(cajaMe(MOVS, "kevin", true)).toMatchObject({ state: "Pago avisado", canClaim: false, claimed: true });
  });
  it("is square, or without a ficha", () => {
    expect(cajaMe(MOVS, "jordi", false)).toMatchObject({ state: "Al día", line: "No debes nada.", canClaim: false });
    expect(cajaMe(MOVS, null, false)).toMatchObject({ state: "Sin ficha todavía", canClaim: false });
  });
});

describe("cajaMovRows · cajaTeam · cajaPot", () => {
  it("lists his movements newest first, a void one kept", () => {
    const rows = cajaMovRows(MOVS, "jordi");
    expect(rows.map((r) => r.id)).toEqual(["d", "c", "b"]);
    expect(rows[0].void).toBe(true);
    expect(rows[1].a).toBe(`+${fmtEuros(500)}`);
  });
  it("puts who owes first and counts them", () => {
    const t = cajaTeam(MOVS, squad, (id) => id, "jordi");
    expect(t.rows.map((r) => [r.name, r.word, r.you])).toEqual([
      ["Kevin", `debe ${fmtEuros(500)}`, false],
      ["Jordi", "al día", true],
    ]);
    expect(t.line).toBe("1 debe · primero quien debe");
    expect(cajaTeam([], squad, (id) => id, null).line).toBe("Nadie debe nada");
  });
  it("adds up the bote and says the cuota and how to pay", () => {
    const p = cajaPot(MOVS, { ...EMPTY_CAJA_SETTINGS, cuota: 3000, howToPay: "Bizum\r\nal capitán" });
    expect(p).toEqual({ bote: fmtEuros(400), cuota: `Cuota: ${fmtEuros(3000)} por temporada.`, pay: "Bizum\nal capitán" });
    expect(cajaPot([], EMPTY_CAJA_SETTINGS)).toMatchObject({ cuota: null, pay: "Pregunta a un capitán cómo pagar." });
  });
});
