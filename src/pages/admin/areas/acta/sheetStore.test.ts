import { describe, expect, it } from "vitest";
import { fromMatch, type MatchSheet } from "../../acta/sheetModel";
import { SheetStore, isDirty } from "./sheetStore";

const server = (): MatchSheet =>
  fromMatch({
    seasonId: "t1",
    rival: "FUSION 7",
    date: Date.UTC(2026, 10, 1, 9, 0),
    status: "finished",
    duration: 50,
    home: true,
    goalsFor: 1,
    goalsAgainst: 0,
    starters: ["a", "b", "c", "d", "e", "f", "g"],
    bench: [],
    notCalled: [],
    revision: 4,
    events: [{ id: "g1", type: "goal", minute: 9, playerId: "a" }],
  } as Parameters<typeof fromMatch>[0]);

describe("el buffer del acta al guardar", () => {
  it("lo editado mientras el guardado sube sigue sin guardar (no se da por guardado lo que no se mandó)", () => {
    const store = new SheetStore("m1", server(), null);
    store.set((v) => ({ ...v, report: "Primera versión" }));
    const sent = store.get().value;
    // (while saveMatchSheet is on its way, the captain keeps typing)
    store.set((v) => ({ ...v, report: "Primera versión, y un párrafo más" }));
    store.saved(sent, false, 1);
    expect(store.get().base).toBe(sent);
    expect(store.get().value.report).toBe("Primera versión, y un párrafo más");
    expect(isDirty(store.get())).toBe(true);
  });

  it("sin ediciones durante el guardado queda limpio; publicar sube la revisión de la base y de lo editado", () => {
    const store = new SheetStore("m1", server(), null);
    store.set((v) => ({ ...v, report: "Crónica" }));
    const sent = store.get().value;
    store.saved(sent, true, 1);
    expect(isDirty(store.get())).toBe(false);
    expect(store.get().value.revision).toBe(5);

    const store2 = new SheetStore("m2", server(), null);
    store2.set((v) => ({ ...v, report: "Crónica" }));
    const sent2 = store2.get().value;
    store2.set((v) => ({ ...v, report: "Crónica corregida" }));
    store2.saved(sent2, true, 1);
    expect(store2.get().base.revision).toBe(5);
    expect(store2.get().value).toMatchObject({ revision: 5, report: "Crónica corregida" });
    expect(isDirty(store2.get())).toBe(true);
  });
});
