import { describe, expect, it } from "vitest";
import { liveLine } from "./liveActions";
import { guestsLast, withGuestNames } from "./derived/guests";

// Invitados en el acta: the pickers' order and how the log names them.
const MATCH = { guests: [{ id: "g1", name: "Rafa" }] };

describe("liveActions · invitados", () => {
  it("lists the members first, then the guests, each group in its order", () => {
    expect(guestsLast(["guest:g1", "evans", "guest:g2", "erik"])).toEqual(["evans", "erik", "guest:g1", "guest:g2"]);
  });

  it("names a guest «Rafa (invitado)» and leaves the members to their own name", () => {
    const nameOf = withGuestNames(MATCH, (id) => id.toUpperCase());
    expect(nameOf("guest:g1")).toBe("Rafa (invitado)");
    expect(nameOf("erik")).toBe("ERIK");
    expect(liveLine("goal", nameOf("guest:g1"))).toBe("Gol de Rafa (invitado)");
  });

  it("with no match a guest is «Invitado»", () => {
    expect(withGuestNames(null, (id) => id)("guest:g1")).toBe("Invitado");
    expect(withGuestNames(undefined, (id) => id)("erik")).toBe("erik");
  });
});
