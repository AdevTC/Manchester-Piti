import { describe, expect, it } from "vitest";
import type { Lineup } from "../formations";
import { demoSquad, lineupOf } from "./testkit";
import { TACTICS } from "../tactics";
import { setTactic } from "./plan";
import { applyStyle, STYLES, styleDiff, styleLabel, styleNow, stylePreview } from "./tacStyles";
import { CONSIGNA } from "./plan";

// Bloque 4 · A3 — los estilos predefinidos, pure.

const sq = demoSquad();
const L7 = (): Lineup => lineupOf(["evans", "illescas", "tello", "huberoski", "eguzquiza", "almachi", "adrian"], "2-3-1", sq);

describe("los estilos", () => {
  it("five, each filling the seven consignas with real values, a pro and a con", () => {
    expect(STYLES.map((s) => s.name)).toEqual(["Presión alta", "Bloque bajo + contra", "Posesión", "Directo", "Equilibrado"]);
    STYLES.forEach((s) => {
      TACTICS.forEach((d) => {
        expect(d.options).toContain(s.tactics[d.key]);
        expect(CONSIGNA[d.key][s.tactics[d.key]]).toBeDefined();
      });
      expect(s.pro.length).toBeGreaterThan(10);
      expect(s.con.length).toBeGreaterThan(10);
    });
  });

  it("the preview says what changes before applying, and how the shape moves", () => {
    const d = styleDiff(L7(), "presion");
    expect(d.rows.map((r) => r.label)).toEqual(["Línea defensiva", "Presión", "Ritmo", "Mentalidad", "Salida de balón", "Foco de ataque"]);
    expect(d.rows.find((r) => r.key === "press")).toMatchObject({ from: "media", to: "alta" });
    expect(d.shape).toMatch(/^El equipo se adelanta \d+ m$/);
    expect(styleDiff(L7(), "bloque").shape).toMatch(/^El equipo se echa atrás \d+ m · más cerrado \(\d+ m\)$/);
    // the default plan is already «Equilibrado»
    expect(styleDiff(L7(), "equilibrado")).toEqual({ rows: [], shape: null });
    expect(styleDiff({ ...L7(), freeMode: true }, "presion").shape).toMatch(/modo libre/);
  });

  it("the preview lineup only changes the consignas (nothing stored); applying sets them and the style", () => {
    const L = L7();
    const p = stylePreview(L, "posesion");
    expect(p.tactics.width).toBe("Amplia");
    expect(p.style).toBeUndefined();
    const a = applyStyle(L, "posesion");
    expect(a.tactics).toEqual(STYLES[2].tactics);
    expect(a.style).toBe("posesion");
  });

  it("knows the style the board plays, and says when it was touched since", () => {
    const L = applyStyle(L7(), "directo");
    expect(styleNow(L)?.id).toBe("directo");
    expect(styleLabel(L)).toBe("Directo");
    const touched = setTactic(L, "width", "Amplia");
    expect(styleNow(touched)).toBeNull();
    expect(styleLabel(touched)).toBe("Directo (retocado)");
    // the plan as it comes is «Equilibrado» even without choosing it
    expect(styleLabel(L7())).toBe("Equilibrado");
  });
});
