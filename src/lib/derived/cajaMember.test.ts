import { describe, expect, it } from "vitest";
import { EMPTY_CAJA_SETTINGS, type CajaMov } from "./caja";
import { cajaOpen, cuotaLine, howToPayText, myBalanceText, myMovs, rowAmount, signedAmount, STATE_WORD } from "./cajaMember";

// (es-ES puts a no-break space before «€»)
const eur = (s: string) => s.replace(/ €/g, " €");
const mov = (id: string, extra: Partial<CajaMov>): CajaMov => ({
  id,
  seasonId: "t1",
  kind: "cargo",
  playerId: "erik",
  amount: 1250,
  concept: "Cuota",
  date: "2026-10-01",
  matchId: null,
  by: "cap",
  createdAt: 1,
  void: false,
  ...extra,
});

describe("the vestuario's caja in words", () => {
  it("your balance: «Debes», «Al día», «Al día · +…»", () => {
    expect(myBalanceText(-1250)).toBe(eur("Debes 12,50 €"));
    expect(myBalanceText(0)).toBe("Al día");
    expect(myBalanceText(300)).toBe(eur("Al día · +3,00 €"));
    expect(myBalanceText(-1)).toBe(eur("Debes 0,01 €"));
  });

  it("a row: a word for each state and its amount (nothing when square)", () => {
    expect(STATE_WORD).toEqual({ debe: "Debe", "al-dia": "Al día", "a-favor": "A favor" });
    expect(rowAmount(-4500)).toBe(eur("45,00 €"));
    expect(rowAmount(0)).toBe("");
    expect(rowAmount(643)).toBe(eur("+6,43 €"));
  });

  it("a movement is signed as its player reads it", () => {
    expect(signedAmount({ kind: "pago", amount: 2000 })).toBe(eur("+20,00 €"));
    expect(signedAmount({ kind: "cargo", amount: 643 })).toBe(eur("−6,43 €"));
  });

  it("your movements only, newest first, void ones kept", () => {
    const movs = [
      mov("a", { date: "2026-09-01" }),
      mov("b", { date: "2026-10-02", kind: "pago", void: true }),
      mov("c", { playerId: "pablo", date: "2026-10-03" }),
      mov("d", { kind: "gasto", playerId: null, date: "2026-10-04" }),
    ];
    expect(myMovs(movs, "erik").map((m) => m.id)).toEqual(["b", "a"]);
    expect(myMovs(movs, null)).toEqual([]);
  });

  it("the caja is open once a captain saved its settings or wrote a movement", () => {
    expect(cajaOpen(EMPTY_CAJA_SETTINGS, [])).toBe(false);
    expect(cajaOpen({ ...EMPTY_CAJA_SETTINGS, updatedAt: 5 }, [])).toBe(true);
    expect(cajaOpen({ ...EMPTY_CAJA_SETTINGS, howToPay: "Bizum" }, [])).toBe(true);
    expect(cajaOpen(EMPTY_CAJA_SETTINGS, [mov("a", { void: true })])).toBe(true);
  });

  it("the cuota line and «Cómo pagar» as plain text with its line breaks", () => {
    expect(cuotaLine(EMPTY_CAJA_SETTINGS)).toBeNull();
    expect(cuotaLine({ cuota: 3000, cuotaPeriod: "temporada" })).toBe(eur("Cuota: 30,00 € por temporada"));
    expect(cuotaLine({ cuota: 1000, cuotaPeriod: "mensual" })).toBe(eur("Cuota: 10,00 € al mes"));
    expect(howToPayText({ howToPay: "  Bizum a Jordi\r\n600 000 000\n" })).toBe("Bizum a Jordi\n600 000 000");
  });
});
