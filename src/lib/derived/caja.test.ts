import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../clubData";
import {
  balanceOf,
  balanceRows,
  balances,
  balanceText,
  cajaMovFields,
  cajaSettingsFields,
  cajaVoidFields,
  centsInput,
  chargedAlready,
  cuotaCargos,
  cuotaConcept,
  dayLabel,
  filterMovs,
  fmtEuros,
  jarBalance,
  madridDay,
  madridMonth,
  matchCostConcept,
  matchCostPlayers,
  owedTotal,
  parseCajaMov,
  parseCajaSettings,
  parseEuros,
  sortMovs,
  splitCost,
  type CajaMov,
} from "./caja";

const NB = " ";
let n = 0;
const mov = (o: Partial<CajaMov>): CajaMov => ({ id: `m${++n}`, seasonId: "t1", kind: "cargo", playerId: "ana", amount: 1000, concept: "x", date: "2026-10-15", matchId: null, by: "cap", createdAt: n, void: false, ...o });
const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

describe("splitCost: to the cent", () => {
  it("45,00 € among 7: the first six (dorsal order) pay a cent more and it adds up", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const cargos = splitCost(4500, ids);
    expect(cargos.map((c) => c.amount)).toEqual([643, 643, 643, 643, 643, 643, 642]);
    expect(cargos.map((c) => c.playerId)).toEqual(ids);
    expect(sum(cargos)).toBe(4500);
  });
  it("an exact split has no leftover; duplicates count once", () => {
    expect(splitCost(7000, ["a", "b", "a", "c", "d", "e", "f", "g"]).map((c) => c.amount)).toEqual(Array(7).fill(1000));
  });
  it("fewer cents than players: nobody gets a 0 cargo and it still adds up", () => {
    const cargos = splitCost(3, ["a", "b", "c", "d", "e", "f", "g"]);
    expect(cargos).toEqual([
      { playerId: "a", amount: 1 },
      { playerId: "b", amount: 1 },
      { playerId: "c", amount: 1 },
    ]);
  });
  it("adds up for any total and any squad", () => {
    for (let total = 1; total < 3000; total += 37) for (let k = 1; k <= 14; k++) expect(sum(splitCost(total, Array.from({ length: k }, (_, i) => `p${i}`)))).toBe(total);
  });
  it("nothing for a zero / negative / fractional total or no players", () => {
    expect(splitCost(0, ["a"])).toEqual([]);
    expect(splitCost(-100, ["a"])).toEqual([]);
    expect(splitCost(10.5, ["a"])).toEqual([]);
    expect(splitCost(100, [])).toEqual([]);
  });
});

describe("cuotaCargos and the concepts", () => {
  it("one cargo of the cuota per player; none without a cuota", () => {
    expect(cuotaCargos(3000, ["a", "b", "a"])).toEqual([
      { playerId: "a", amount: 3000 },
      { playerId: "b", amount: 3000 },
    ]);
    expect(cuotaCargos(0, ["a"])).toEqual([]);
  });
  it("names the cuota by season or month, and the match cost by jornada and rival", () => {
    expect(cuotaConcept("temporada", "Temporada 1", 9)).toBe("Cuota Temporada 1");
    expect(cuotaConcept("mensual", "Temporada 1", 9)).toBe("Cuota octubre");
    expect(matchCostConcept(5, "Fusion 7")).toBe("Campo y árbitro · J5 vs Fusion 7");
    expect(matchCostConcept(null, "")).toBe("Campo y árbitro · vs Rival");
  });
});

describe("balances and the jar", () => {
  it("a balance is pagos − cargos; the jar is pagos + ingresos − gastos; void movements count nothing", () => {
    const movs = [
      mov({ kind: "cargo", playerId: "ana", amount: 3000 }),
      mov({ kind: "pago", playerId: "ana", amount: 1750 }),
      mov({ kind: "cargo", playerId: "bea", amount: 3000 }),
      mov({ kind: "pago", playerId: "bea", amount: 3500 }),
      mov({ kind: "cargo", playerId: "cris", amount: 3000, void: true }),
      mov({ kind: "pago", playerId: "cris", amount: 999, void: true }),
      mov({ kind: "ingreso", playerId: null, amount: 5000 }),
      mov({ kind: "gasto", playerId: null, amount: 4500 }),
      mov({ kind: "gasto", playerId: null, amount: 100000, void: true }),
    ];
    expect(balanceOf(movs, "ana")).toBe(-1250);
    expect(balanceOf(movs, "bea")).toBe(500);
    expect(balanceOf(movs, "cris")).toBe(0);
    expect(balances(movs).has("cris")).toBe(false);
    expect(jarBalance(movs)).toBe(1750 + 3500 + 5000 - 4500);
    expect(owedTotal(movs)).toBe(1250);
  });
  it("invariants: the balances add up to pagos − cargos, and voiding a movement is the same as it never existing", () => {
    const movs = [
      ...splitCost(4500, ["a", "b", "c", "d", "e", "f", "g"]).map((c) => mov({ kind: "cargo", ...c })),
      mov({ kind: "pago", playerId: "a", amount: 643 }),
      mov({ kind: "pago", playerId: "z", amount: 2000 }),
      mov({ kind: "gasto", playerId: null, amount: 4500 }),
    ];
    const total = [...balances(movs).values()].reduce((s, b) => s + b, 0);
    expect(total).toBe(643 + 2000 - 4500);
    for (const m of movs) {
      const voided = movs.map((x) => (x.id === m.id ? { ...x, void: true } : x));
      const without = movs.filter((x) => x.id !== m.id);
      expect(jarBalance(voided)).toBe(jarBalance(without));
      expect([...balances(voided)]).toEqual([...balances(without)]);
    }
  });
  it("balance rows: those who owe first (biggest debt first), then by dorsal; strangers with movements too", () => {
    const movs = [mov({ kind: "cargo", playerId: "b", amount: 500 }), mov({ kind: "cargo", playerId: "c", amount: 900 }), mov({ kind: "pago", playerId: "a", amount: 100 }), mov({ kind: "cargo", playerId: "old", amount: 100 })];
    const rows = balanceRows(
      movs,
      [
        { id: "a", name: "ANA", number: 1 },
        { id: "b", name: "BEA", number: 2 },
        { id: "c", name: "CRIS", number: 3 },
        { id: "d", name: "DANI", number: null },
      ],
      (id) => (id === "old" ? "VIEJO" : "?"),
    );
    expect(rows.map((r) => [r.id, r.balance, r.state])).toEqual([
      ["c", -900, "debe"],
      ["b", -500, "debe"],
      ["old", -100, "debe"],
      ["a", 100, "a-favor"],
      ["d", 0, "al-dia"],
    ]);
    expect(rows[2].name).toBe("VIEJO");
  });
});

describe("money in words", () => {
  it("formats es-ES euros from cents", () => {
    expect(fmtEuros(1250)).toBe(`12,50${NB}€`);
    expect(fmtEuros(5)).toBe(`0,05${NB}€`);
    expect(fmtEuros(-1250)).toBe(`-12,50${NB}€`);
  });
  it("says a balance in words (never colour alone)", () => {
    expect(balanceText(-1250)).toBe(`Debe 12,50${NB}€`);
    expect(balanceText(-1250, true)).toBe(`Debes 12,50${NB}€`);
    expect(balanceText(0)).toBe("Al día");
    expect(balanceText(300)).toBe(`A favor 3,00${NB}€`);
    expect(balanceText(300, true)).toBe(`Tienes 3,00${NB}€ a favor`);
  });
  it("reads what the captain types", () => {
    expect(parseEuros("12")).toBe(1200);
    expect(parseEuros("12,5")).toBe(1250);
    expect(parseEuros(" 12,50 € ")).toBe(1250);
    expect(parseEuros("12.50")).toBe(1250);
    expect(parseEuros("1.234,50")).toBe(123450);
    expect(parseEuros("1.234")).toBe(123400);
    expect(parseEuros("0,07")).toBe(7);
    for (const bad of ["", "abc", "12,505", "-3", "1,2,3", "12..5"]) expect(parseEuros(bad)).toBeNull();
    expect(centsInput(1250)).toBe("12,50");
    expect(centsInput(3000)).toBe("30");
  });
});

describe("dates (Madrid)", () => {
  it("the Madrid calendar day, also after 22:00 UTC and across the DST change", () => {
    expect(madridDay(Date.UTC(2026, 9, 15, 22, 30))).toBe("2026-10-16");
    expect(madridDay(Date.UTC(2026, 9, 24, 22, 30))).toBe("2026-10-25");
    expect(madridDay(Date.UTC(2026, 9, 25, 22, 30))).toBe("2026-10-25");
    expect(madridMonth(Date.UTC(2026, 9, 31, 23, 30))).toBe(10);
    expect(dayLabel("2026-10-05")).toBe("5 oct");
    expect(dayLabel("")).toBe("—");
  });
});

describe("matchCostPlayers: who pays the campo y árbitro", () => {
  const dorsal: Record<string, number> = { ana: 1, bea: 4, cris: 7, dani: 9, eva: 10, fer: 12 };
  const order = (id: string) => dorsal[id] ?? 999;
  const row = (minutes: number) => ({ minutes, played: minutes > 0, started: false, benched: minutes === 0, notCalled: false }) as Participation;
  it("with an acta: who played (minutes > 0), starters and subs who came in, in dorsal order", () => {
    const m: ClubMatch = { id: "m", status: "finished", starters: ["eva", "ana", "bea"], bench: ["cris", "dani"], ledger: { eva: row(50), ana: row(50), bea: row(30), cris: row(20), dani: row(0) } };
    expect(matchCostPlayers(m, order)).toEqual({ ids: ["ana", "bea", "cris", "eva"], source: "acta" });
  });
  it("a legacy acta (no ledger): the starters plus whoever its events say played", () => {
    const m: ClubMatch = { id: "m", status: "finished", starters: ["eva", "ana"], bench: ["cris", "dani"], events: [{ id: "e", type: "goal", playerId: "cris", assistPlayerId: "fer" }] };
    expect(matchCostPlayers(m, order)).toEqual({ ids: ["ana", "cris", "eva", "fer"], source: "acta" });
  });
  it("no acta yet: the convocados (starters + bench)", () => {
    const m: ClubMatch = { id: "m", status: "scheduled", starters: ["eva", "ana"], bench: ["dani"] };
    expect(matchCostPlayers(m, order)).toEqual({ ids: ["ana", "dani", "eva"], source: "convocatoria" });
    expect(matchCostPlayers({ ...m, status: "finished", starters: [], bench: [] }, order)).toEqual({ ids: [], source: "convocatoria" });
  });
});

describe("reading and writing the docs", () => {
  it("parses a movement and refuses what is not one", () => {
    const d = { seasonId: "t1", kind: "pago", playerId: "ana", amount: 1250, concept: "Bizum", date: "2026-10-15", matchId: null, by: "cap", createdAt: { toMillis: () => 42 }, void: false };
    expect(parseCajaMov("x", d)).toEqual({ id: "x", ...d, createdAt: 42 });
    expect(parseCajaMov("x", { ...d, kind: "multa" })).toBeNull();
    expect(parseCajaMov("x", { ...d, amount: 0 })).toBeNull();
    expect(parseCajaMov("x", { ...d, amount: 12.5 })).toBeNull();
    expect(parseCajaMov("x", { ...d, playerId: null })).toBeNull();
    expect(parseCajaMov("x", { ...d, kind: "gasto" })).toBeNull();
    expect(parseCajaMov("x", { ...d, kind: "gasto", playerId: null })?.kind).toBe("gasto");
    expect(parseCajaMov("x", null)).toBeNull();
  });
  it("a void movement says who voided it and when (an older one without the trail: nobody, 0)", () => {
    const d = { seasonId: "t1", kind: "pago", playerId: "ana", amount: 1250, concept: "Bizum", date: "2026-10-15", matchId: null, by: "cap", createdAt: 42, void: true };
    expect(parseCajaMov("x", { ...d, voidedBy: "cap2", voidedAt: { toMillis: () => 99 } })).toMatchObject({ void: true, voidedBy: "cap2", voidedAt: 99 });
    expect(parseCajaMov("x", d)).toMatchObject({ void: true, voidedBy: null, voidedAt: 0 });
    expect(parseCajaMov("x", { ...d, void: false })).not.toHaveProperty("voidedBy");
    expect(cajaVoidFields("cap")).toEqual({ void: true, voidedBy: "cap" });
  });
  it("parses the settings with defaults", () => {
    expect(parseCajaSettings(undefined)).toEqual({ cuota: 0, cuotaPeriod: "temporada", howToPay: "", updatedAt: 0 });
    expect(parseCajaSettings({ cuota: 3000, cuotaPeriod: "mensual", howToPay: "Bizum 600", updatedAt: 5 })).toEqual({ cuota: 3000, cuotaPeriod: "mensual", howToPay: "Bizum 600", updatedAt: 5 });
  });
  it("writes the fields the rules expect (no playerId on a gasto, trimmed concept, never void)", () => {
    expect(cajaMovFields("t1", { kind: "gasto", playerId: "ana", amount: 100, concept: "  Balones ", date: "2026-10-15", matchId: null }, "cap")).toEqual({ seasonId: "t1", kind: "gasto", playerId: null, amount: 100, concept: "Balones", date: "2026-10-15", matchId: null, by: "cap", void: false });
    expect(cajaSettingsFields({ cuota: 3000, cuotaPeriod: "mensual", howToPay: " Bizum " })).toEqual({ cuota: 3000, cuotaPeriod: "mensual", howToPay: "Bizum" });
  });
});

describe("the log", () => {
  it("newest first, filtered by kind and player; a repeated cargo is spotted", () => {
    const a = mov({ date: "2026-10-01", createdAt: 1 });
    const b = mov({ date: "2026-10-03", createdAt: 2, kind: "pago" });
    const c = mov({ date: "2026-10-03", createdAt: 3, playerId: "bea", concept: "Cuota octubre" });
    const d = mov({ date: "2026-10-03", createdAt: 4, playerId: "cris", concept: "Cuota octubre", void: true, matchId: "m1" });
    expect(sortMovs([a, b, c, d]).map((m) => m.id)).toEqual([d.id, c.id, b.id, a.id]);
    expect(filterMovs([a, b, c], { kind: "pago", playerId: "" })).toEqual([b]);
    expect(filterMovs([a, b, c], { kind: "", playerId: "bea" })).toEqual([c]);
    expect(chargedAlready([a, b, c, d], "Cuota octubre")).toBe(1);
    expect(chargedAlready([a, b, c, d], "", "m1")).toBe(0);
  });
});
