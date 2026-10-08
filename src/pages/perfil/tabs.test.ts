import { describe, expect, it } from "vitest";
import { counter, hashOf, slideDir, tabForKey, tabFromHash, tabsFor } from "./tabs";
import { ago, jornadaRange, stuffLines } from "./lines";

describe("las pestañas del perfil", () => {
  it("Capitanía solo para capitanes", () => {
    expect(tabsFor(false).map((t) => t.id)).toEqual(["carta", "temp", "avisos", "ajustes", "cuenta"]);
    expect(tabsFor(true).map((t) => t.id)).toEqual(["carta", "temp", "avisos", "ajustes", "cuenta", "cap"]);
  });
  it("los enlaces #carta…#capitania, en ambos sentidos", () => {
    expect(tabFromHash("#temporada", false)).toBe("temp");
    expect(tabFromHash("#TEMPORADA", false)).toBe("temp");
    expect(tabFromHash("#capitania", false)).toBeNull();
    expect(tabFromHash("#capitania", true)).toBe("cap");
    expect(tabFromHash("#nada", true)).toBeNull();
    expect(tabFromHash("", true)).toBeNull();
    expect(hashOf("temp")).toBe("#temporada");
    expect(hashOf("cap")).toBe("#capitania");
  });
  it("teclas: ←/→ dan la vuelta, Inicio/Fin a los extremos", () => {
    const ids = tabsFor(false).map((t) => t.id);
    expect(tabForKey("ArrowRight", "carta", ids)).toBe("temp");
    expect(tabForKey("ArrowLeft", "carta", ids)).toBe("cuenta");
    expect(tabForKey("ArrowRight", "cuenta", ids)).toBe("carta");
    expect(tabForKey("Home", "avisos", ids)).toBe("carta");
    expect(tabForKey("End", "avisos", ids)).toBe("cuenta");
    expect(tabForKey("Enter", "avisos", ids)).toBeNull();
  });
  it("«01 / 05» y el lado del que entra el panel", () => {
    const ids = tabsFor(true).map((t) => t.id);
    expect(counter(0, 5)).toBe("01 / 05");
    expect(counter(5, 6)).toBe("06 / 06");
    expect(slideDir("carta", "avisos", ids)).toBe("r");
    expect(slideDir("avisos", "carta", ids)).toBe("l");
  });
});

describe("las frases de Temporada", () => {
  const conv = { answered: 0, total: 0, yes: 0, maybe: 0, no: 0, next: null, nextId: null };
  it("tus cosas, vacías", () => {
    const l = stuffLines({ next: null, boards: { count: 0, last: null }, porra: null, conv, now: 0 });
    expect(l.map((x) => x.text)).toEqual(["Aún no tienes tableros: crea el primero", "Aún sin pronósticos esta temporada", "Aún no hay convocatorias esta temporada"]);
  });
  it("tus cosas, con datos (la próxima sin responder va en oro)", () => {
    const DAY = 86_400_000;
    const now = Date.UTC(2026, 10, 1, 10);
    const l = stuffLines({
      next: { id: "m8", rival: "MAD SKY", dateMs: Date.UTC(2026, 10, 8, 11), home: false, j: 8 },
      boards: { count: 3, last: { id: "b1", name: "2-3-1 contra MAD SKY", at: now - 2 * DAY, href: "/pizarra?tablero=b1" } },
      porra: { predictions: 7, exact: 2, points: 10, rank: 3, of: 15 },
      conv: { answered: 7, total: 7, yes: 6, maybe: 1, no: 0, next: null, nextId: "m8" },
      now,
    });
    expect(l[0]).toMatchObject({ title: "¿Vas a MAD SKY?", text: "J8 · dom 8 nov · 12:00 · fuera. Aún no has respondido.", call: true });
    expect(l[1]).toMatchObject({ text: "3 tableros · el último, «2-3-1 contra MAD SKY», hace 2 días", href: "/pizarra?tablero=b1" });
    expect(l[2].text).toBe("7 pronósticos · 2 exactos · vas 3.º de 15");
    expect(l[3].text).toBe("7 de 7 respondidas · Voy ×6 · Duda ×1");
  });
  it("respondida: deja de ir en oro", () => {
    const l = stuffLines({ next: { id: "m8", rival: "X", dateMs: 0, home: null, j: null }, boards: { count: 0, last: null }, porra: null, conv: { ...conv, next: "yes", nextId: "m8" }, now: 0 });
    expect(l[0]).toMatchObject({ text: "Has dicho que vas.", call: false });
  });
  it("rango de jornadas y «hace…»", () => {
    expect(jornadaRange([])).toBe("");
    expect(jornadaRange([{ j: 1, label: "J1", goals: 0, played: true, p: 0 }])).toBe("en la J1");
    expect(jornadaRange([{ j: 1, label: "J1", goals: 0, played: true, p: 0 }, { j: 7, label: "J7", goals: 0, played: true, p: 0 }])).toBe("de la J1 a la J7");
    expect(ago(1000, 1000 + 30_000)).toBe("ahora");
    expect(ago(0, 5)).toBe("hace poco");
    expect(ago(1, 1 + 3 * 3_600_000)).toBe("hace 3 h");
    expect(ago(1, 1 + 30 * 3_600_000)).toBe("ayer");
  });
});
