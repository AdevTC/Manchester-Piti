// CAJA · the words and lists of the caja (model.ts): they say derived/caja's sums, never others.
import { describe, expect, it } from "vitest";
import type { CajaMov } from "../../../../lib/derived/caja";
import type { CajaClaim } from "../../../../lib/derived/cajaClaims";
import type { AdminMatch } from "../../data/adminLogic";
import { chargedOf, costMatches, costTarget, cuotaLine, dayWeek, euros, filterBook, howLine, lastCostTotal, owedLines, resolvedLines, saldoRows, saldoText, signedAmount, splitLine, squadOf, withPending } from "./model";

const NB = " ";
const mov = (o: Partial<CajaMov> & Pick<CajaMov, "id">): CajaMov => ({ seasonId: "t1", kind: "cargo", playerId: "a", amount: 1000, concept: "x", date: "2026-10-27", matchId: null, by: "u", createdAt: 1, void: false, ...o });
const t = (s: string) => s.replace(/\s/g, " ");
const NOW = Date.UTC(2026, 10, 2, 9);
const match = (o: Partial<AdminMatch> & Pick<AdminMatch, "id">): AdminMatch => ({ seasonId: "t1", rival: "R", date: Date.UTC(2026, 9, 25, 10), status: "finished", draft: false, published: true, jornada: 1, ...o }) as AdminMatch;

describe("caja model", () => {
  it("money in the board's words: whole euros without «,00», the sign of the book, a day with its weekday", () => {
    expect(t(euros(25500))).toBe(`255 €`);
    expect(t(euros(728))).toBe(`7,28 €`);
    expect(t(signedAmount({ kind: "pago", amount: 2000 }))).toBe(`+20 €`);
    expect(t(signedAmount({ kind: "cargo", amount: 800 }))).toBe(`−8 €`);
    expect(t(signedAmount({ kind: "gasto", amount: 4550 }))).toBe(`−45,50 €`);
    expect(dayWeek("2026-10-19")).toBe("lun 19 oct");
    expect(dayWeek("")).toBe("sin fecha");
    void NB;
  });

  it("the cuota and «Cómo pagar» lines", () => {
    expect(t(cuotaLine({ cuota: 2500, cuotaPeriod: "mensual" }))).toBe("25 € al mes");
    expect(t(cuotaLine({ cuota: 3000, cuotaPeriod: "temporada" }))).toBe("30 € por temporada");
    expect(cuotaLine({ cuota: 0, cuotaPeriod: "temporada" })).toBe("Sin cuota · ponla en Ajustes");
    expect(howLine({ howToPay: " Bizum " })).toBe("Cómo pagar: Bizum");
    expect(howLine({ howToPay: "" })).toMatch(/^Falta «Cómo pagar»/);
  });

  it("saldos by dorsal (also who left the squad); «Os deben» with the three biggest debts", () => {
    const squad = [
      { id: "b", name: "BETO", number: 7 },
      { id: "a", name: "ANA", number: 1 },
      { id: "c", name: "CARO", number: null },
      { id: "d", name: "DANI", number: 9 },
      { id: "e", name: "EVA", number: 10 },
    ];
    const movs = [mov({ id: "1", playerId: "b", amount: 3300 }), mov({ id: "2", playerId: "d", amount: 800 }), mov({ id: "3", playerId: "e", amount: 3300 }), mov({ id: "4", playerId: "a", kind: "pago", amount: 500 }), mov({ id: "5", playerId: "x", amount: 100 })];
    const rows = saldoRows(movs, squad, () => "EX");
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "d", "e", "c", "x"]);
    const o = owedLines(rows, 7500, squad.length);
    expect(t(o.owed)).toBe("Os deben 75 € · 4 jugadores");
    expect(t(o.who)).toBe("Más: BETO 33 € · EVA 33 € · DANI 8 € y 1 más");
    expect(owedLines([], 0, 0).owed).toBe("Sin plantilla en esta temporada");
    expect(t(saldoText(-800))).toBe("Debe 8 €");
    expect(t(saldoText(500))).toBe("A favor 5 €");
    expect(saldoText(0)).toBe("Al día");
  });

  it("the squad of a season with that season's shirt name and dorsal", () => {
    const players = [
      { id: "p1", number: 4, shirtName: "UNO", seasons: ["t1"], seasonDetails: { t1: { number: 14, shirtName: "UNITO" } } },
      { id: "p2", number: 2, shirtName: "DOS", seasons: ["t0"] },
      { id: "p3", number: 3, shirtName: "TRES", seasons: ["t1"] },
    ] as unknown as Parameters<typeof squadOf>[0];
    expect(squadOf(players, "t1")).toEqual([
      { id: "p3", name: "TRES", number: 3 },
      { id: "p1", name: "UNITO", number: 14 },
    ]);
  });

  it("the book's filters (by kind, by player, «El bote») and what waits behind «Deshacer» once", () => {
    const movs = [mov({ id: "1" }), mov({ id: "2", kind: "gasto", playerId: null }), mov({ id: "3", kind: "pago", playerId: "b" })];
    expect(filterBook(movs, "", "bote").map((m) => m.id)).toEqual(["2"]);
    expect(filterBook(movs, "cargo", "todos").map((m) => m.id)).toEqual(["1"]);
    expect(filterBook(movs, "", "b").map((m) => m.id)).toEqual(["3"]);
    expect(withPending(movs, [])).toBe(movs);
    expect(withPending(movs, [mov({ id: "3" }), mov({ id: "9" })]).map((m) => m.id)).toEqual(["1", "2", "3", "9"]);
  });

  it("«Resueltos»: newest first, who and when, the reason of a rejection", () => {
    const c = (o: Partial<CajaClaim>): CajaClaim => ({ id: "c", uid: "u", playerId: "a", seasonId: "t1", concept: "Cuota", amount: 2500, at: 1, status: "pendiente", ...o });
    const lines = resolvedLines([c({ id: "1" }), c({ id: "2", status: "rechazado", resolvedBy: "cap", resolvedAt: NOW - 3_600_000, reason: "No llegó" }), c({ id: "3", status: "confirmado", resolvedBy: "cap", resolvedAt: NOW - 60_000 })], () => "ANA", () => "jordi", NOW);
    expect(lines.map((l) => l.id)).toEqual(["3", "2"]);
    expect(t(lines[0].title)).toBe("ANA · Cuota · 25 €");
    expect(lines[0].detail).toBe("Confirmado por jordi · hace 1 min");
    expect(lines[1].detail).toBe("Rechazado por jordi · hace 1 h · «No llegó»");
  });

  it("the cost of a match: what is charged, the played matches newest first, the one to charge, the usual total", () => {
    const ms = [
      match({ id: "j1", jornada: 1 }),
      // (la mesa ended it, the acta still to publish: it counts)
      match({ id: "j2", jornada: 2, date: Date.UTC(2026, 10, 1, 10), status: "scheduled", events: [{ id: "e1", type: "goal", minute: 3, playerId: "a" }] }),
      match({ id: "j3", jornada: 3, date: Date.UTC(2026, 10, 8, 10), status: "scheduled" }),
      // (past its hour, never on la mesa: «¿Se jugó?», no cost yet)
      match({ id: "jp", jornada: 4, date: Date.UTC(2026, 10, 1, 18), status: "scheduled" }),
      match({ id: "jx", status: "cancelled" }),
    ];
    const movs = [mov({ id: "1", matchId: "j1", amount: 727, date: "2026-10-26" }), mov({ id: "2", matchId: "j1", amount: 728, date: "2026-10-26" }), mov({ id: "3", matchId: "j1", amount: 5000, void: true })];
    expect(chargedOf(movs, "j1")).toEqual({ n: 2, total: 1455, date: "2026-10-26" });
    expect(costMatches(ms, "t1", NOW).map((m) => m.id)).toEqual(["j2", "j1"]);
    expect(costMatches(ms, "t1", NOW, ms[2]).map((m) => m.id)).toEqual(["j3", "j2", "j1"]);
    expect(costTarget(ms, "t1", NOW, movs)?.id).toBe("j2");
    expect(costTarget(ms, "t1", NOW, [...movs, mov({ id: "4", matchId: "j2" })])?.id).toBe("j2");
    expect(costTarget([], "t1", NOW, movs)).toBeNull();
    expect(lastCostTotal(movs)).toBe(1455);
    expect(lastCostTotal([])).toBe(0);
    expect(t(splitLine(8000, [728, 728, 727]))).toBe("80 € entre 3 · de 7,27 € a 7,28 €");
    expect(t(splitLine(800, [400, 400]))).toBe("8 € entre 2 · 4 € cada uno");
  });
});
