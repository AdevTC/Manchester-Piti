import { describe, expect, it } from "vitest";
import { ev, makeView, squad } from "../screens/testkit";
import { benchRows, captainNow, finBlockers, halfPlan, pitchTokens, presenceOf, secondHalfUi, takerNow } from "./derive";

describe("lo que la mesa lee del partido", () => {
  it("el siete se reparte por todo el campo (sobre su propio ancho y largo)", () => {
    const { field } = squad();
    const t = pitchTokens(field, []);
    expect(Math.min(...t.map((x) => x.nx))).toBe(0);
    expect(Math.max(...t.map((x) => x.nx))).toBe(100);
    expect(t.find((x) => x.id === "mario")?.ny).toBe(0);
    expect(t.find((x) => x.id === "alex")?.ny).toBe(100);
  });
  it("B-MESA-11: la presencia solo dice «al día» sin nada por subir ni por revisar", () => {
    const base = makeView();
    expect(presenceOf(base).label).toBe("Tú y David anotando, al día");
    expect(presenceOf({ ...base, queue: { ...base.queue, pending: 1 } }).label).toBe("Tú y David anotando, 1 jugada subiendo");
    expect(presenceOf({ ...base, queue: { ...base.queue, review: [{ requestId: "r", type: "foul", text: "x", playerId: null, minute: 3, count: 1, reason: "no" }] } }).cls).toBe("is-wait");
    expect(presenceOf({ ...base, queue: { ...base.queue, online: false, pending: 3 } }).text).toBe("Sin red · 3 en el móvil");
  });
  it("B-MESA-03: un gol sin goleador bloquea el acta como en el servidor", () => {
    const v = makeView({ events: [ev("g", "goal", 4, { pendingScorer: true })] });
    expect(finBlockers(v)).toEqual(["1 gol sin goleador"]);
  });
  it("el banquillo de la lista: los que vinieron (y los que ya jugaron)", () => {
    const v = makeView({ match: { present: ["alex", "hugo"] } });
    expect(benchRows(v).map((x) => x.player.id)).toEqual(["hugo"]);
  });
});

describe("el siete de la 2ª", () => {
  it("B-MESA-02: el portero puede ser cualquiera de los siete (un suplente que entra por el portero, también)", () => {
    const { field, bench } = squad();
    const p = halfPlan(field, bench, { add: ["hugo"], drop: ["alex"], keeper: null });
    expect(p.ok).toBe(false);
    const q = halfPlan(field, bench, { add: ["hugo"], drop: ["alex"], keeper: "hugo" });
    expect(q.ok).toBe(true);
    expect(q.items).toEqual([{ type: "substitution", playerId: "alex", inPlayerId: "hugo" }]);
    const r = halfPlan(field, bench, { add: ["hugo"], drop: ["alex"], keeper: "mario" });
    expect(r.items).toEqual([{ type: "substitution", playerId: "alex", inPlayerId: "hugo" }, { type: "position_swap", playerId: "hugo", inPlayerId: "mario" }]);
  });
  it("B-MESA-07: los cambios se cuentan contra el campo de ahora", () => {
    const { field, bench } = squad();
    const ui = { add: [], drop: [], keeper: null };
    // (Hugo came on for Pablo by another scorer's hand: nothing to undo)
    const now = [...field.filter((x) => x.id !== "pablo"), bench[0]];
    expect(halfPlan(now, [field[5], ...bench.slice(1)], ui).items).toEqual([]);
  });
  it("B-PAR-01: el «2ª parte» del oficial da el siete y su portero; sin él, nada", () => {
    const { field, bench } = squad();
    const v = { field, bench, secondHalf: { seven: ["alex", "mario", "sergio", "dani", "marcos", "david", "hugo"], keeper: "alex", codes: {} } };
    expect(secondHalfUi(v, field.map((p) => p.id))).toEqual({ add: ["hugo"], drop: ["pablo"], keeper: "alex" });
    expect(secondHalfUi({ ...v, secondHalf: null }, [])).toBeNull();
  });
  it("B-PAR-01: el brazalete y los lanzadores siguen a quien está en el campo", () => {
    const { field } = squad();
    const g = { captainId: "hugo", viceId: "mario", takers: { penalties: ["hugo", "sergio"], freekicks: [], corners: [] } };
    expect(captainNow({ field, galones: g })).toBe("mario");
    expect(takerNow({ field, galones: g }, "penalties")).toBe("sergio");
  });
});
