import { describe, expect, it } from "vitest";
import { mesaLine, mesaOf } from "./mesa";
import { mesaName, nextMesa } from "../../../functions/src/mesaLogic";

describe("mesaLine", () => {
  it("names who keeps la mesa", () => {
    expect(mesaLine({ mesa: { name: "Jorge", since: 1 } })).toBe("Lo anota Jorge desde la mesa");
  });
  it("is null without a valid stamp", () => {
    expect(mesaLine({})).toBeNull();
    expect(mesaLine(null)).toBeNull();
    expect(mesaLine({ mesa: { name: " ", since: 1 } })).toBeNull();
    expect(mesaOf({ mesa: { name: "Jorge" } })).toBeNull();
  });
});

describe("mesaName / nextMesa", () => {
  it("prefers the nickname, then the ficha's name, trimmed and capped", () => {
    expect(mesaName(" Jorge ", "JORGE M.")).toBe("Jorge");
    expect(mesaName("", "ADRIÁN T.C.")).toBe("ADRIÁN T.C.");
    expect(mesaName(undefined, undefined)).toBeNull();
    expect(mesaName("x".repeat(60), null)).toHaveLength(40);
  });
  it("keeps the stored `since` for the same name, stamps a new one otherwise", () => {
    expect(nextMesa({ name: "Jorge", since: 5 }, "Jorge", 9)).toBeNull();
    expect(nextMesa({ name: "Jorge", since: 5 }, "Huberoski", 9)).toEqual({ name: "Huberoski", since: 9 });
    expect(nextMesa(undefined, "Jorge", 9)).toEqual({ name: "Jorge", since: 9 });
    expect(nextMesa(undefined, null, 9)).toBeNull();
  });
});
