import { describe, expect, it } from "vitest";
import { addGuest, guestInUse, guestSlot, lineupWithGuests, nextGuestId, removeGuest } from "./guests";
import { pickOptions } from "../partidos/pickModel";
import { defaultSheet, fromMatch, toPayload } from "./sheetModel";

const base = { starters: ["evans", "erik"], bench: ["kevin"] };

describe("Invitados en el acta · añadir y quitar", () => {
  it("«Añadir invitado» names him g1, g2… and puts him on the banquillo", () => {
    const one = addGuest(base, "  Rafa ");
    expect(one.ok && one.value).toEqual({ starters: ["evans", "erik"], bench: ["kevin", "guest:g1"], guests: [{ id: "g1", name: "Rafa" }] });
    const two = one.ok ? addGuest(one.value, "Iván") : null;
    expect(two?.ok && two.guest).toEqual({ id: "g2", name: "Iván" });
  });

  it("refuses an empty name, one over 30 letters, a repeated one and a fifth guest", () => {
    expect(addGuest(base, "   ")).toEqual({ ok: false, error: "Escribe el nombre del invitado." });
    expect(addGuest(base, "x".repeat(31))).toEqual({ ok: false, error: "El nombre del invitado va hasta 30 letras." });
    const rafa = { ...base, guests: [{ id: "g1", name: "Rafa" }] };
    expect(addGuest(rafa, "rafa")).toEqual({ ok: false, error: "Ya hay un invitado que se llama rafa." });
    const four = { ...base, guests: ["A", "B", "C", "D"].map((name, i) => ({ id: `g${i + 1}`, name })) };
    expect(addGuest(four, "E")).toEqual({ ok: false, error: "Ya hay 4 invitados: es el máximo por partido." });
  });

  it("reuses a freed id", () => {
    expect(nextGuestId([{ id: "g1", name: "A" }, { id: "g3", name: "C" }])).toBe("g2");
  });

  it("removes a guest no event names, and takes him out of the convocatoria", () => {
    const x = { starters: ["evans", "guest:g1"], bench: ["guest:g2"], notCalled: [], guests: [{ id: "g1", name: "Rafa" }, { id: "g2", name: "Iván" }], events: [] };
    const r = removeGuest(x, "g1");
    expect(r.ok && r.value.guests).toEqual([{ id: "g2", name: "Iván" }]);
    expect(r.ok && r.value.starters).toEqual(["evans"]);
  });

  it("keeps a guest an event names (scorer, assist or who comes in)", () => {
    for (const e of [{ playerId: "guest:g1" }, { assistPlayerId: "guest:g1" }, { inPlayerId: "guest:g1" }]) {
      const events = [{ id: "e", type: "goal" as const, minute: 3, ...e }];
      expect(guestInUse(events, "g1")).toBe(true);
      expect(removeGuest({ ...base, guests: [{ id: "g1", name: "Rafa" }], events }, "g1")).toEqual({ ok: false, error: "Rafa sale en el acta: quita antes sus jugadas." });
    }
  });

  it("the acta's convocatoria: a new guest on the banquillo, a removed one out of it", () => {
    const l = lineupWithGuests({ starters: ["evans", "guest:g9"], bench: ["kevin"] }, { guests: [{ id: "g1", name: "Rafa" }] });
    expect(l).toEqual({ starters: ["evans"], bench: ["kevin", "guest:g1"] });
    expect(guestSlot(l, "g1")).toBe("B");
    expect(guestSlot(l, "g2")).toBeNull();
  });

  it("the acta's pickers: the members, then the guests with «INV»", () => {
    const info = (id: string) => (id === "guest:g1" ? { name: "Rafa (invitado)", number: null } : { name: id.toUpperCase(), number: 7 });
    expect(pickOptions(["guest:g1", "erik"], info)).toEqual([{ id: "erik", num: "7", name: "ERIK" }, { id: "guest:g1", num: "INV", name: "Rafa (invitado)" }]);
  });

  it("the sheet keeps its guests from the match to saveMatchSheet", () => {
    const sheet = fromMatch({ seasonId: "t1", rival: "MAD SKY", date: Date.UTC(2026, 9, 10), duration: 50, starters: ["guest:g1"], bench: [], guests: [{ id: "g1", name: "Rafa" }], events: [{ id: "a", type: "goal", minute: 3, playerId: "guest:g1" }] });
    expect(sheet.guests).toEqual([{ id: "g1", name: "Rafa" }]);
    const out = toPayload(sheet, true, (id) => id ?? "—");
    expect(out.ok && out.sheet.guests).toEqual([{ id: "g1", name: "Rafa" }]);
    const none = toPayload({ ...defaultSheet("t1"), rival: "X", date: Date.UTC(2026, 9, 10) }, true, (id) => id ?? "—");
    expect(none.ok && "guests" in none.sheet).toBe(false);
  });
});
