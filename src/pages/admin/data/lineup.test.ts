import { describe, expect, it } from "vitest";
import { convocatoriaStatus, place, rsvpGroups, rsvpOf, sevenWhy } from "./lineup";

describe("the one convocatoria, client side", () => {
  const six = { starters: ["a", "b", "c", "d", "e", "f"], bench: ["h"] };
  it("place(): hang in el siete (first free peg), down to the banquillo, the toggle and «Ya hay siete»", () => {
    const hung = place(six, "h", "T");
    expect(hung).toEqual({ ok: true, lineup: { starters: ["a", "b", "c", "d", "e", "f", "h"], bench: [] } });
    if (!hung.ok) throw new Error("hung");
    expect(place(hung.lineup, "z", "T")).toEqual({ ok: false, reason: "full" });
    expect(place(hung.lineup, "a", "B")).toEqual({ ok: true, lineup: { starters: ["b", "c", "d", "e", "f", "h"], bench: ["a"] } });
    // tapping where he already is takes him out
    expect(place(six, "h", "B")).toEqual({ ok: true, lineup: { starters: six.starters, bench: [] } });
    expect(place(six, "a", "T")).toEqual({ ok: true, lineup: { starters: ["b", "c", "d", "e", "f"], bench: ["h"] } });
  });
  it("RSVP per roster player (unlinked members don't hang on a peg)", () => {
    const r = rsvpOf(
      [
        { response: "yes", playerId: "a" },
        { response: "maybe", playerId: "b" },
        { response: "no", playerId: "c" },
        { response: "yes", playerId: null },
      ],
      ["a", "b", "c", "d"],
    );
    expect(rsvpGroups(["a", "b", "c", "d"], r)).toEqual({ si: ["a"], duda: ["b"], no: ["c"], sin: ["d"] });
  });
  it("status: announced, changed since, and the line under el siete", () => {
    expect(convocatoriaStatus({})).toEqual({ notified: false, published: false, changed: false });
    expect(convocatoriaStatus({ convocatoriaAt: 5, convocatoriaNotifiedAt: 5 })).toEqual({ notified: true, published: true, changed: false });
    expect(convocatoriaStatus({ convocatoriaAt: 9, convocatoriaNotifiedAt: 5 })).toEqual({ notified: true, published: false, changed: true });
    const none = { notified: false, published: false, changed: false };
    expect(sevenWhy(six, none, ["ALMACHI", "ANDIA"])).toBe("Falta 1 para el siete · ALMACHI, ANDIA en duda");
    const seven = { starters: ["a", "b", "c", "d", "e", "f", "g"], bench: ["h", "i"] };
    expect(sevenWhy(seven, none, [])).toBe("Listo: avisa por push a los 9 convocados");
    expect(sevenWhy(seven, { notified: true, published: true, changed: false }, [])).toBe("Publicada · los 9 convocados tienen el aviso");
    expect(sevenWhy(seven, { notified: true, published: false, changed: true }, [])).toBe("Ha cambiado: vuelve a avisar a los 9 convocados");
  });
});
