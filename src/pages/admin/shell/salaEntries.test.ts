import { describe, expect, it } from "vitest";
import { searchView } from "../../../components/celeste/searchModel";
import type { PaletteCommand } from "../palette/search";
import { salaEntries, SALA_OPTIONS } from "./salaEntries";

// The sala's commands as entries of the web's search: each group to its kind, the dorsal and the jornada found only
// exactly, the keys and the address kept, and the sala's empty field (the pinned matches, the actions, the places).
const run = () => undefined;
const cmd = (c: Partial<PaletteCommand> & Pick<PaletteCommand, "id" | "group" | "title">): PaletteCommand => ({ icon: "·", run, ...c });
const COMMANDS: PaletteCommand[] = [
  cmd({ id: "a:nuevo", group: "Acciones", icon: "+", title: "Nuevo partido", description: "Rival, fecha y hora · tecla N", keys: "N", href: "/admin/partidos/nuevo" }),
  cmd({ id: "s:hoy", group: "Sitios", icon: "HO", vicon: "home", title: "Hoy", keys: "G H", href: "/admin" }),
  cmd({ id: "s:caja", group: "Sitios", icon: "CA", vicon: "euro", title: "Caja", description: "2 por hacer", keys: "G A", href: "/admin/caja" }),
  cmd({ id: "m:m3", group: "Partidos", icon: "J3", title: "J3 · MAD SKY", description: "dom 8 nov · 12:00", exact: ["J3"], whenEmpty: true, order: -1 }),
  cmd({ id: "m:m13", group: "Partidos", icon: "J13", title: "J13 · Orduña", exact: ["J13"], whenEmpty: false, order: 3 }),
  cmd({ id: "p:9", group: "Jugadores", icon: "9", title: "9 · ERIK", description: "Delantero", exact: ["9"], whenEmpty: false }),
  cmd({ id: "p:19", group: "Jugadores", icon: "19", title: "19 · KEVIN", description: "Lateral", exact: ["19"], whenEmpty: false }),
  cmd({ id: "x:tool", group: "Herramientas", icon: "✎", title: "Corregir un cambio" }),
];

describe("salaEntries", () => {
  it("each group to its kind (in its `order`), with its icon, keys, preview and the command to run", () => {
    const es = salaEntries(COMMANDS);
    expect(es.map((e) => [e.title, e.kind])).toEqual([
      ["J3 · MAD SKY", "partido"],
      ["Nuevo partido", "accion"],
      ["Hoy", "seccion"],
      ["Caja", "seccion"],
      ["J13 · Orduña", "partido"],
      ["9 · ERIK", "jugador"],
      ["19 · KEVIN", "jugador"],
      ["Corregir un cambio", "accion"],
    ]);
    expect(es[1]).toMatchObject({ icon: "plus", keys: "N", detail: "Rival, fecha y hora · tecla N", pv: { line: "", url: "/admin/partidos/nuevo" }, go: { to: "run", run } });
    expect(es[2]).toMatchObject({ icon: "home", keys: "G H", pv: { url: "/admin" } });
    expect(es[5]).toMatchObject({ num: "9", jn: undefined });
    expect(es[0]).toMatchObject({ jn: "3", num: undefined, idle: true });
    expect(es[7]).toMatchObject({ icon: "post" });
  });

  it("a dorsal or a jornada only typed exactly («9» is not 19, «j3» not J13)", () => {
    const es = salaEntries(COMMANDS);
    const titles = (q: string) => searchView(es, { q, scope: "todo", more: {} }, "jugador", SALA_OPTIONS).flat.map((e) => e.title);
    expect(titles("9")[0]).toBe("9 · ERIK");
    expect(titles("9")).not.toContain("19 · KEVIN");
    expect(titles("j3")[0]).toBe("J3 · MAD SKY");
    expect(titles("@kev")).toEqual(["19 · KEVIN"]);
  });

  it("the empty field: the pinned match, the actions and the places, in the sala's words", () => {
    const v = searchView(salaEntries(COMMANDS), { q: "", scope: "todo", more: {} }, "jugador", SALA_OPTIONS);
    expect(v.groups.map((g) => [g.title, g.items.map((e) => e.title)])).toEqual([
      ["Partidos", ["J3 · MAD SKY"]],
      ["Acciones", ["Nuevo partido", "Corregir un cambio"]],
      ["Sitios", ["Hoy", "Caja"]],
    ]);
    expect(v.hint).toBe("Un partido, un jugador, un sitio o algo que hacer");
    const sitios = searchView(salaEntries(COMMANDS), { q: "", scope: "tu", more: {} }, "jugador", SALA_OPTIONS);
    expect(sitios.chip).toBe("Sitios");
    expect(sitios.flat.map((e) => e.title)).toEqual(["Hoy", "Caja"]);
  });
});
