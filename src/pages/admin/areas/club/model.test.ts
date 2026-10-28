import { describe, expect, it } from "vitest";
import { blankRow, claChecks, draftFrom, draftJornada, la, markUs, rotaSig, saysText, standingsSig, tableBehind, toCount, turErrs, withKeys } from "./model";
import type { Standings } from "../../../../lib/standings";

const row = (team: string, pj: number, isUs = false) => ({ team, pj, g: pj, e: 0, p: 0, gf: pj, gc: 0, pts: 3 * pj, isUs });
const table = (over: Partial<Standings> = {}): Standings => ({ id: "t1", competition: "Liga F7", jornada: 2, updatedAt: 5, updatedBy: "u", rows: [row("Rayo", 2), row("Manchester Piti", 2, true)], ...over });

describe("club model", () => {
  it("la(): «la Temporada 1», a free name in quotes", () => {
    expect(la("Temporada 1")).toBe("la Temporada 1");
    expect(la("Archivo 2025/26")).toBe("«Archivo 2025/26»");
  });

  it("H-HOY-12: the table is behind when its jornada is older than the last published acta", () => {
    expect(tableBehind(table({ jornada: 2 }), 3)).toEqual({ table: 2, acta: 3 });
    expect(tableBehind(table({ jornada: 3 }), 3)).toBeNull();
    expect(tableBehind(null, 3)).toBeNull();
    expect(tableBehind(table({ jornada: null }), null)).toBeNull();
  });

  it("what the web will say, or why it can't", () => {
    expect(saysText(table().rows, 2)).toBe("Vamos 2.º de 2 · 6 pts · J2");
    expect(saysText([row("Rayo", 1), row("Otro", 1)], null)).toMatch(/^sin nuestra fila/);
  });

  it("the checks: the rules' errors, a team twice, and the hints that never block", () => {
    const rows = withKeys([row("Rayo", 2), { ...row("rayo ", 2), pts: 5 }, row("Manchester Piti", 2, true)]);
    const { errs, warns } = claChecks(rows, { pj: 2, g: 1, e: 0, p: 1, gf: 3, gc: 3 });
    expect(errs).toContain("«rayo» está dos veces.");
    expect(warns.some((w) => w.startsWith("rayo: Pts (5)"))).toBe(true);
    expect(warns.some((w) => w.startsWith("Nuestra fila no cuadra"))).toBe(true);
    expect(claChecks(withKeys([row("A", 1)]), null).errs.length).toBeGreaterThan(0);
  });

  it("a draft starts from the saved table, its signature changes when another captain saves", () => {
    const d = draftFrom(table(), 100);
    expect(d.rows.map((r) => r.team)).toEqual(["Rayo", "Manchester Piti"]);
    expect(d.jornada).toBe("2");
    expect(d.base).toBe(standingsSig(table()));
    expect(standingsSig(table({ updatedAt: 6 }))).not.toBe(d.base);
    expect(draftJornada({ jornada: "" })).toBeNull();
    expect(draftJornada({ jornada: "07" })).toBe(7);
  });

  it("number fields: digits only, empty is 0", () => {
    expect(toCount("")).toBe(0);
    expect(toCount("12a")).toBe(12);
    expect(toCount("0012")).toBe(1);
  });

  it("a paste without «nosotros» marks the Piti", () => {
    const rows = markUs([blankRow("Rayo"), blankRow("Manchester Piti")]);
    expect(rows.map((r) => r.isUs)).toEqual([false, true]);
  });

  it("turnos: the rota's signature and its errors", () => {
    const jobs = [{ id: "lavar", name: "Lavar", icon: "shirt" as const, awayOnly: false, order: ["a"] }];
    expect(rotaSig(jobs)).toBe(rotaSig([{ ...jobs[0], name: "Lavar " }]));
    expect(rotaSig(null)).toBe("");
    expect(turErrs([{ ...jobs[0], name: "" }]).length).toBeGreaterThan(0);
  });
});
