import { describe, expect, it } from "vitest";
import { placeForGo, placeLabel, PLACES, salaDirection, sameMatch, screenOf } from "./places";
import { keyStep, CHORD_MS } from "./shortcuts";

describe("the five places", () => {
  it("Hoy · Partidos · Plantilla · Caja · Club, each with its g + letter", () => {
    expect(PLACES.map((p) => `${p.name} g ${p.go}`)).toEqual(["Hoy g h", "Partidos g p", "Plantilla g l", "Caja g a", "Club g b"]);
    expect(placeForGo("B")).toBe("club");
  });
  it("a counter says itself in words, only when there is something to do", () => {
    expect(placeLabel("Partidos", 0)).toBe("Partidos");
    expect(placeLabel("Partidos", 1)).toBe("Partidos · 1 cosa por hacer");
    expect(placeLabel("Caja", 2)).toBe("Caja · 2 cosas por hacer");
  });
});

describe("what the frame knows of an address", () => {
  const at = (p: string) => screenOf(p);
  it("each place's own screen has no way back (the dock stays)", () => {
    for (const p of ["/admin", "/admin/partidos", "/admin/plantilla", "/admin/plantilla/socios", "/admin/plantilla/capitanes", "/admin/plantilla/cromos", "/admin/caja", "/admin/club"]) expect(at(p).back, p).toBeUndefined();
  });
  it("inside a match, a ficha or a room: «‹ Volver» (and so no dock)", () => {
    expect(at("/admin/partidos/m1").back).toEqual({ to: "/admin/partidos", label: "Volver a Partidos" });
    expect(at("/admin/partidos/m1/acta/narracion").back).toEqual({ to: "/admin/partidos/m1/acta", label: "Volver al acta" });
    expect(at("/admin/plantilla/erik").back?.to).toBe("/admin/plantilla");
    expect(at("/admin/plantilla/alta").back?.to).toBe("/admin/plantilla");
    expect(at("/admin/caja/coste/m1").back?.to).toBe("/admin/caja");
    expect(at("/admin/club/turnos").back?.to).toBe("/admin/club");
    expect(at("/admin/club/web/historia").back?.to).toBe("/admin/club/web");
  });
  it("the match: its id and the station in the address", () => {
    expect(at("/admin/partidos/m1/datos")).toMatchObject({ place: "partidos", matchId: "m1", station: "datos", screen: "datos" });
    expect(at("/admin/partidos/m1")).toMatchObject({ matchId: "m1", station: undefined, screen: "partido" });
    expect(at("/admin/partidos/m1/acta/historial")).toMatchObject({ station: "acta", screen: "acta-historial" });
    expect(at("/admin/partidos/nuevo")).toMatchObject({ screen: "nuevo", matchId: undefined });
    expect(at("/admin/partidos/archivados/m9")).toMatchObject({ screen: "archivado", matchId: "m9" });
  });
  it("an address the sala does not have", () => {
    for (const p of ["/admin/nada", "/admin/partidos/m1/otra", "/admin/partidos/m1/datos/mas", "/admin/club/cocina", "/admin/caja/otra", "/admin/plantilla/erik/mas"]) expect(at(p).place, p).toBeNull();
  });
});

describe("how a change of screen travels (law 4)", () => {
  it("between places by the capsule's order", () => {
    expect(salaDirection("/admin", "/admin/caja")).toBe("right");
    expect(salaDirection("/admin/club/turnos", "/admin/partidos")).toBe("left");
  });
  it("between stations by the carril's order", () => {
    expect(salaDirection("/admin/partidos/m1/convocatoria", "/admin/partidos/m1/acta")).toBe("right");
    expect(salaDirection("/admin/partidos/m1/despues", "/admin/partidos/m1/datos")).toBe("left");
  });
  it("deeper comes in from the right, back up from the left", () => {
    expect(salaDirection("/admin/partidos", "/admin/partidos/m1")).toBe("right");
    expect(salaDirection("/admin/plantilla/erik", "/admin/plantilla")).toBe("left");
  });
  it("the match's head stays only between two screens of the same match", () => {
    expect(sameMatch("/admin/partidos/m1/convocatoria", "/admin/partidos/m1/datos")).toBe(true);
    expect(sameMatch("/admin/partidos/m1", "/admin/partidos/m2")).toBe(false);
    expect(sameMatch("/admin/partidos", "/admin/partidos/m1")).toBe(false);
  });
});

describe("the keyboard (g + letter, /, n)", () => {
  it("g then a place's letter goes there, within the chord's time", () => {
    const a = keyStep(null, "g", 1000);
    expect(a.result.kind).toBe("armed");
    expect(keyStep(a.armedAt, "p", 1500).result).toEqual({ kind: "go", place: "partidos" });
    expect(keyStep(a.armedAt, "p", 1000 + CHORD_MS + 1).result.kind).toBe("none");
  });
  it("/ is the screen's search and n a new match", () => {
    expect(keyStep(null, "/", 0).result.kind).toBe("search");
    expect(keyStep(null, "n", 0).result.kind).toBe("nuevo");
    expect(keyStep(null, "x", 0).result.kind).toBe("none");
  });
});
