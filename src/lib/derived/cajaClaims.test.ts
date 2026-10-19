import { describe, expect, it } from "vitest";
import { cajaClaimFields, cajaClaimResolveFields, claimPagoFields, claimProblem, claimStatusText, parseCajaClaim, sortClaims, type CajaClaim } from "./cajaClaims";

const me = { uid: "u1", playerId: "p1", name: "Jordi" };
const claim = (over: Partial<CajaClaim> = {}): CajaClaim => ({ id: "c1", uid: "u1", playerId: "p1", seasonId: "s1", concept: "Cuota", amount: 2500, at: Date.UTC(2026, 9, 18, 22, 30), status: "pendiente", ...over });

describe("cajaClaims", () => {
  it("the fields a member writes (pendiente, his own uid and ficha)", () => {
    expect(cajaClaimFields(me, { seasonId: "s1", concept: "  Cuota octubre ", amount: 2500 })).toEqual({ uid: "u1", playerId: "p1", seasonId: "s1", concept: "Cuota octubre", amount: 2500, status: "pendiente" });
  });
  it("what stops a claim", () => {
    expect(claimProblem({ playerId: null }, { seasonId: "s1", concept: "Cuota", amount: 100 })).toMatch(/ficha/);
    expect(claimProblem(me, { seasonId: "s1", concept: "Cuota", amount: 0 })).toMatch(/cuánto/);
    expect(claimProblem(me, { seasonId: "s1", concept: " ", amount: 100 })).toMatch(/qué/);
    expect(claimProblem(me, { seasonId: "s1", concept: "Cuota", amount: 100 })).toBeNull();
  });
  it("reads a doc or nothing", () => {
    expect(parseCajaClaim("c1", { uid: "u1", playerId: "p1", seasonId: "s1", concept: "Cuota", amount: 2500, at: 5, status: "pendiente" })).toEqual(claim({ at: 5 }));
    expect(parseCajaClaim("c1", { uid: "u1", playerId: "p1", seasonId: "s1", amount: 2500, at: 5, status: "confirmado", resolvedBy: "cap", resolvedAt: 9, movId: "m9" })).toMatchObject({ status: "confirmado", resolvedBy: "cap", resolvedAt: 9, movId: "m9", concept: "" });
    expect(parseCajaClaim("c1", { uid: "u1", playerId: "p1", seasonId: "s1", amount: 0, status: "pendiente" })).toBeNull();
    expect(parseCajaClaim("c1", { uid: "u1", playerId: "p1", seasonId: "s1", amount: 10, status: "pagado" })).toBeNull();
  });
  it("a captain's answer and the pago a confirmation writes (dated the Madrid day he said it)", () => {
    expect(cajaClaimResolveFields("cap", "confirmado", "m9")).toEqual({ status: "confirmado", resolvedBy: "cap", movId: "m9" });
    expect(cajaClaimResolveFields("cap", "rechazado", "m9")).toEqual({ status: "rechazado", resolvedBy: "cap" });
    expect(claimPagoFields(claim(), "cap", 0)).toEqual({ seasonId: "s1", kind: "pago", playerId: "p1", amount: 2500, concept: "Cuota", date: "2026-10-19", matchId: null, by: "cap", void: false });
  });
  it("pending first (oldest first), then the resolved newest first; the member's words", () => {
    const list = [claim({ id: "a", status: "confirmado", at: 1 }), claim({ id: "b", at: 5 }), claim({ id: "c", at: 2 }), claim({ id: "d", status: "rechazado", at: 9 })];
    expect(sortClaims(list).map((c) => c.id)).toEqual(["c", "b", "d", "a"]);
    expect(claimStatusText(claim())).toMatch(/Avisado, pendiente de confirmar$/);
    expect(claimStatusText(claim({ status: "confirmado" }))).toMatch(/Confirmado$/);
  });
});
