import { describe, expect, it } from "vitest";
import { libraryPlays } from "../playLibrary";
import { charlaView } from "./charla";
import { setSystem, toBench, toggleRole } from "./ops";
import { demoSquad, lineupOf } from "./testkit";
import {
  addVariant,
  charlaPlanB,
  cmpVariantKey,
  mergeRoles,
  removeVariant,
  renameVariant,
  variantCmpOptions,
  variantName,
  variantNameError,
  variantPills,
  variantSummary,
  variantView,
  writeVariant,
} from "./variants";

const sq = demoSquad();
const ids = sq.list.map((c) => c.id);
const SEVEN = ["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"];
const L7 = () => ({ ...lineupOf(SEVEN, "2-3-1", sq), roles: { captainId: "tello", penaltiesId: "adrian" } });
const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";

describe("the versions of the seven", () => {
  it("a new variant is a copy of the titular's seven, in the fixed order, at most one of each", () => {
    const L = L7();
    const b = addVariant(L, "vb");
    expect(b?.variants).toHaveLength(1);
    expect(b?.variants?.[0]).toMatchObject({ id: "vb", name: "Plan B", formation: "2-3-1", freeMode: false });
    expect(b?.variants?.[0].slots.map((s) => s.playerId)).toEqual(SEVEN);
    // (a copy: changing the titular doesn't touch it)
    expect(b?.variants?.[0].slots).not.toBe(L.slots);
    const both = addVariant(b!, "v2");
    expect(both?.variants?.map((v) => v.id)).toEqual(["v2", "vb"]);
    expect(addVariant(both!, "vb")).toBeNull();
  });

  it("the variant on screen is a whole lineup; the titular (and an unknown variant) is the board itself", () => {
    const L = addVariant(L7(), "vb")!;
    expect(variantView(L, "titular", ids)).toBe(L);
    expect(variantView(L, "v2", ids)).toBe(L);
    const v = variantView(L, "vb", ids);
    expect(v.slots.map((s) => s.playerId)).toEqual(SEVEN);
    expect(v.bench).not.toContain("tello");
    expect(variantName(L, "vb")).toBe("Plan B");
    expect(variantName(L, "titular")).toBe("Titular");
  });

  it("a change on a variant goes into the variant: the titular's seven, system and plan stay", () => {
    const L = addVariant(L7(), "vb")!;
    const shown = variantView(L, "vb", ids);
    // TELLO to the bench and another system, on Plan B
    const next = setSystem(toBench(shown, "tello"), "3-2-1");
    const out = writeVariant(L, "vb", shown, next);
    expect(out.slots.map((s) => s.playerId)).toEqual(SEVEN);
    expect(out.formation).toBe("2-3-1");
    const vb = out.variants?.find((v) => v.id === "vb");
    expect(vb?.formation).toBe("3-2-1");
    expect(vb?.slots[2].playerId).toBeNull();
    // the galones are the board's: TELLO keeps the armband (he only isn't in Plan B's seven)
    expect(out.roles).toEqual({ captainId: "tello", penaltiesId: "adrian" });
    // on the titular, the change is the change
    expect(writeVariant(L, "titular", L, next)).toBe(next);
  });

  it("the galones a variant gives or takes from someone on its pitch count; the ones that only fell don't", () => {
    expect(mergeRoles({ captainId: "tello" }, {}, {}, new Set(["evans"]))).toEqual({ captainId: "tello" });
    expect(mergeRoles({ captainId: "tello" }, { captainId: "tello" }, {}, new Set(["tello"]))).toEqual({});
    expect(mergeRoles({ captainId: "tello" }, { captainId: "tello" }, { captainId: "evans" }, new Set(["evans"]))).toEqual({ captainId: "evans" });
    const L = addVariant(L7(), "vb")!;
    const shown = variantView(L, "vb", ids);
    const out = writeVariant(L, "vb", shown, toggleRole(shown, "cornersId", "evans"));
    expect(out.roles.cornersId).toBe("evans");
  });

  it("renamed (unique, never «Titular», 24 characters at most) and removed", () => {
    const L = addVariant(addVariant(L7(), "vb")!, "v2")!;
    expect(variantNameError(L, "vb", "  ")).toBe("Ponle un nombre.");
    expect(variantNameError(L, "vb", "titular")).toBe("Ya hay una versión con ese nombre.");
    expect(variantNameError(L, "vb", "2ª PARTE")).toBe("Ya hay una versión con ese nombre.");
    expect(variantNameError(L, "vb", "x".repeat(25))).toBe("Como mucho 24 caracteres.");
    expect(variantNameError(L, "vb", "Si vamos perdiendo")).toBeNull();
    const r = renameVariant(L, "vb", "  Si   vamos perdiendo ");
    expect(variantName(r, "vb")).toBe("Si vamos perdiendo");
    expect(removeVariant(r, "vb").variants?.map((v) => v.id)).toEqual(["v2"]);
  });

  it("the pills: Titular, the variants there are, and «+» for the rest only on an editable board", () => {
    const L = addVariant(L7(), "vb")!;
    expect(variantPills(L, "vb", true).map((p) => [p.label, p.add, p.on])).toEqual([
      ["Titular", false, false],
      ["2ª parte", true, false],
      ["Plan B", false, true],
    ]);
    expect(variantPills(L, "titular", false).map((p) => p.label)).toEqual(["Titular", "Plan B"]);
    expect(variantPills(L7(), "titular", false)).toHaveLength(1);
  });

  it("Comparar can face the other versions", () => {
    const L = addVariant(addVariant(L7(), "vb")!, "v2")!;
    expect(variantCmpOptions(L7(), "titular")).toEqual([]);
    expect(variantCmpOptions(L, "vb")).toEqual([
      { id: "v:titular", name: "Versión · Titular" },
      { id: "v:v2", name: "Versión · 2ª parte" },
    ]);
    expect(cmpVariantKey("v:vb")).toBe("vb");
    expect(cmpVariantKey("v:nada")).toBeNull();
    expect(cmpVariantKey("partido")).toBeNull();
  });

  it("what a variant changes, in words", () => {
    const L = L7();
    const v = setSystem({ ...L, slots: L.slots.map((s, i) => (i === 6 ? { ...s, playerId: "erik" } : s)) }, "3-2-1");
    expect(variantSummary(L, v, nm)).toBe("3-2-1 · entra ERIK por ADRIAN");
    expect(variantSummary(L, L, nm)).toBe("2-3-1 · los mismos siete");
    expect(variantSummary(L, setSystem(L, "3-1-2"), nm)).toBe("3-1-2 · los mismos siete, otro dibujo");
  });

  it("la charla presents the titular and, at the plan, its Plan B (when it changes something)", () => {
    const L = addVariant(L7(), "vb")!;
    expect(charlaPlanB(L, ids, nm)).toBeNull();
    expect(charlaPlanB(L7(), ids, nm)).toBeNull();
    const shown = variantView(L, "vb", ids);
    const withB = writeVariant(L, "vb", shown, { ...shown, slots: shown.slots.map((s, i) => (i === 6 ? { ...s, playerId: "kevin" } : s)) });
    const pb = charlaPlanB(withB, ids, nm);
    expect(pb).toEqual({ t: "Plan B", d: "Si hace falta: 2-3-1 · entra KEVIN por ADRIAN." });
    const play = libraryPlays(withB)[0];
    const args = { L: withB, sq, play, playShort: "Córner", match: null, boardName: "Mi tablero", sysName: "2-3-1", tacSum: "Presión media", qv: 50, in3d: false, playing: false, planB: pb };
    const v = charlaView({ ...args, step: 10 });
    expect(v.kind).toBe("plan");
    expect(v.plan?.at(-1)).toMatchObject({ t: "Plan B", d: "Si hace falta: 2-3-1 · entra KEVIN por ADRIAN." });
    expect(v.guion[10].t).toBe("El plan · Presión media · Plan B");
    // without one, the plan is the consignas alone
    expect(charlaView({ ...args, planB: null, step: 10 }).plan?.some((c) => c.t === "Plan B")).toBe(false);
  });
});
