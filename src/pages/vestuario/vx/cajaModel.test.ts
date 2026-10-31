import { describe, expect, it } from "vitest";
import { EMPTY_CAJA_SETTINGS, fmtEuros, type CajaMov } from "../../../lib/derived/caja";
import { cajaHead, cajaMe, cajaMovRows, cajaMovSums, cajaPot, cajaTeam } from "./cajaModel";

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

describe("cajaMe · cajaHead", () => {
  it("says he owes, with his last cargo, and offers the claim", () => {
    const me = cajaMe(MOVS, "kevin", false);
    expect(me).toMatchObject({ cls: "is-debe", amt: `−${fmtEuros(500)}`, state: "Debes", stCls: "is-warn", line: "J1 · Campo y árbitro, 18 oct. Págalo cuando puedas.", canClaim: true, owed: 500 });
    expect(cajaHead(me, { open: true, socio: false })).toEqual({
      title: `Debes ${fmtEuros(500)}`,
      sub: "Lo último: J1 · Campo y árbitro, 18 oct. Cuando pagues, avisa con «Ya la he pagado» y el capitán lo apunta.",
    });
  });
  it("waits for the captain once he said he paid", () => {
    const me = cajaMe(MOVS, "kevin", true);
    expect(me).toMatchObject({ state: "Pago avisado", stCls: "is-ok", canClaim: false, claimed: true, cls: "" });
    expect(cajaHead(me, { open: true, socio: false }).title).toBe("Pago avisado");
  });
  it("is square (with his last payment), in favour, or without a ficha", () => {
    const sq = cajaMe(MOVS, "jordi", false);
    expect(sq).toMatchObject({ amt: fmtEuros(0), state: "Al día", line: `No debes nada. Lo último que pagaste: ${fmtEuros(500)}, el 19 oct.`, canClaim: false });
    expect(cajaHead(sq, { open: true, socio: false }).title).toBe("Estás al día");
    const fav = cajaMe([...MOVS, mov("f", { playerId: "jordi", kind: "pago", amount: 300, date: "2026-10-21" })], "jordi", false);
    expect(fav).toMatchObject({ amt: `+${fmtEuros(300)}`, line: `Tienes ${fmtEuros(300)} a favor.` });
    expect(cajaHead(fav, { open: true, socio: false }).title).toBe(`Al día · ${fmtEuros(300)} a favor`);
    const socio = cajaMe(MOVS, null, false);
    expect(socio).toMatchObject({ amt: "–", state: "Sin ficha todavía", stCls: "is-off", canClaim: false });
    expect(cajaHead(socio, { open: true, socio: true }).title).toBe("La caja del equipo");
  });
  it("a closed caja says so whoever looks", () => {
    expect(cajaHead(cajaMe([], "kevin", false), { open: false, socio: false })).toEqual({ title: "La caja aún no está abierta", sub: "Solo la lees: la llevan los capitanes." });
  });
});

describe("cajaMovRows · cajaTeam · cajaPot", () => {
  it("lists his movements newest first, a void one kept", () => {
    const rows = cajaMovRows(MOVS, "jordi");
    expect(rows.map((r) => r.id)).toEqual(["d", "c", "b"]);
    expect(rows[0].void).toBe(true);
    expect(rows[1].a).toBe(`+${fmtEuros(500)}`);
    expect(rows.map((r) => r.plus)).toEqual([true, true, false]);
  });
  it("adds up what was charged and paid, void ones out", () => {
    expect(cajaMovSums(MOVS, "jordi")).toEqual({ charged: fmtEuros(500), paid: fmtEuros(500) });
    expect(cajaMovSums(MOVS, null)).toEqual({ charged: fmtEuros(0), paid: fmtEuros(0) });
  });
  it("puts who owes first and counts them", () => {
    const t = cajaTeam(MOVS, squad, (id) => id, "jordi");
    expect(t.rows.map((r) => [r.name, r.num, r.word, r.you])).toEqual([
      ["Kevin", "9", `debe ${fmtEuros(500)}`, false],
      ["Jordi", "7", "al día", true],
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
