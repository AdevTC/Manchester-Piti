import { describe, expect, it } from "vitest";
import { buildPaletteGroups, commandMatches, flatten, normalize, type PaletteCommand } from "./search";

const run = () => undefined;
const cmd = (c: Partial<PaletteCommand> & Pick<PaletteCommand, "id" | "group" | "title">): PaletteCommand => ({ icon: "·", run, ...c });
const COMMANDS: PaletteCommand[] = [
  cmd({ id: "s:plantilla", group: "Secciones", title: "Plantilla" }),
  cmd({ id: "a:nuevo", group: "Acciones", title: "Nuevo partido", description: "Rival, fecha y campo", keywords: "crear" }),
  ...Array.from({ length: 12 }, (_, i) =>
    cmd({ id: `m:${i + 1}`, group: "Partidos", title: `J${i + 1} · Rival ${i + 1}`, exact: [`J${i + 1}`], whenEmpty: i + 1 === 7 || i + 1 === 8 }),
  ),
  cmd({ id: "m:fusion", group: "Partidos", title: "J13 · FUSION 7", exact: ["J13"], whenEmpty: false }),
  cmd({ id: "p:adrian", group: "Jugadores", title: "ADRIÁN T.C.", exact: ["10"], whenEmpty: false }),
  cmd({ id: "p:andia", group: "Jugadores", title: "ANDIA", exact: ["19"], whenEmpty: false }),
  cmd({ id: "x:extra", group: "Herramientas", title: "Exportar plantilla" }),
];
const titles = (q: string) => buildPaletteGroups(COMMANDS, q).map((g) => [g.title, g.items.map((i) => i.id)]);

describe("normalize", () => {
  it("drops accents, case and extra spaces", () => {
    expect(normalize("  ADRIÁN   T.C. ")).toBe("adrian t.c.");
  });
});

describe("commandMatches", () => {
  it("finds by title, description or keywords, accents ignored", () => {
    expect(commandMatches(COMMANDS[1], "crear")).toBe(true);
    expect(commandMatches(COMMANDS[1], "fecha")).toBe(true);
    expect(commandMatches(COMMANDS.find((c) => c.id === "p:adrian")!, "adrian")).toBe(true);
  });
  it("finds a dorsal only when typed exactly", () => {
    const andia = COMMANDS.find((c) => c.id === "p:andia")!;
    expect(commandMatches(andia, "19")).toBe(true);
    expect(commandMatches(andia, "1")).toBe(false);
  });
  it("reads «J1» as a jornada: not J10–J13", () => {
    expect(titles("J1")).toEqual([["Partidos", ["m:1"]]]);
    expect(titles("j 8")).toEqual([["Partidos", ["m:8"]]]);
  });
});

describe("buildPaletteGroups", () => {
  it("with no query: actions, sections, the pinned matches, no players; groups in the designed order", () => {
    expect(titles("")).toEqual([
      ["Acciones", ["a:nuevo"]],
      ["Secciones", ["s:plantilla"]],
      ["Partidos", ["m:7", "m:8"]],
      ["Herramientas", ["x:extra"]],
    ]);
  });
  it("finds a rival, players by name, and caps long groups at six", () => {
    expect(titles("fusion")).toEqual([["Partidos", ["m:fusion"]]]);
    expect(titles("adrian")).toEqual([["Jugadores", ["p:adrian"]]]);
    expect(titles("rival")[1]).toEqual(["Partidos", ["m:1", "m:2", "m:3", "m:4", "m:5", "m:6"]]);
    expect(titles("plantilla")).toEqual([
      ["Secciones", ["s:plantilla"]],
      ["Herramientas", ["x:extra"]],
    ]);
  });
  it("sorts inside a group by `order`", () => {
    const g = buildPaletteGroups([cmd({ id: "b", group: "Acciones", title: "B", order: 2 }), cmd({ id: "a", group: "Acciones", title: "A", order: 1 })], "");
    expect(flatten(g).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("returns nothing when nothing matches", () => {
    expect(buildPaletteGroups(COMMANDS, "zzz")).toEqual([]);
  });
});
