import { describe, expect, it, vi } from "vitest";
import { sortAnalysisRows, type AnalysisWorkspaceRow } from "../../../lib/analysisWorkspace";
import type { MetricResult } from "../../../../functions/src/narrated/types";
import type { NuState, NuView } from "../numeros/view";
import { catalogo, exFmtOf, exportar, famsOf, ficha, juego, mesa } from "./juegoView";

type V = Parameters<typeof juego>[0];
type St = Parameters<typeof juego>[1];
const st = (p: Partial<NuState> = {}) => ({ jug: [], partidos: [], team: "us", catX: false, catFam: "", catN: 24, wsColumns: undefined, exFmt: "json", sheetId: null, place: "juego", ...p }) as St;
const result = (value: number | null, status: MetricResult["status"] = "complete") => ({ id: "067", unit: "count", status, value, observed: 0, pending: 0, evidenceEventIds: [], ruleId: "r", ruleVersion: 1, parameters: {}, reason: "" }) as MetricResult;

const tile = (id: string, t: string, status: "ok" | "part" | "none", v: string | number = 1) => ({ key: id, id, t, v, status, cls: `is-${status}`, statusT: status, sub: "", pick: () => {} });
const sortCol = (key: string, sort: "ascending" | "descending" | "none") => ({ key, t: `col ${key}`, sort, pick: vi.fn() });

function ws(p: Partial<NuView["ws"]> = {}): NuView["ws"] {
  return {
    sets: [{ key: "resumen", t: "Resumen", on: true, pick: vi.fn() }, { key: "pases", t: "Pases y creación", on: false, pick: vi.fn() }],
    n: 2, cols: [sortCol("067", "descending"), sortCol("070", "none")], rows: [], foot: [{ key: "067", v: "-", status: undefined, reason: "Sin datos" }, { key: "070", v: "80%", status: "complete", reason: "" }],
    totalLabel: "Total del Piti", columns: [], query: "", setQuery: vi.fn(), family: "", families: ["Pases", "Remates"], setFamily: vi.fn(),
    availableCount: 3, selectedCount: 2, selectAll: vi.fn(), clearColumns: vi.fn(), csv: vi.fn(),
    table: { head: ["Jugador", "Dorsal", "col 067"], rows: [["Ana", "7", "3"]] },
    famN: { Pases: 40, Remates: 12 }, total: 412, custom: false, resumen: ["001", "015"],
    ...p,
  } as unknown as NuView["ws"];
}

describe("El juego · de un vistazo", () => {
  it("puts the tiles in their three families by their words, the rest in the last one, and drops empty families", () => {
    const fams = famsOf([{ t: "Goles marcados" }, { t: "Pases intentados" }, { t: "Pases del rival" }, { t: "Recuperaciones" }, { t: "Amarillas del rival" }, { t: "Algo raro" }]);
    expect(fams.map((f) => [f.t, f.tiles.map((x) => x.t)])).toEqual([
      ["Ataque", ["Goles marcados"]],
      ["El balón", ["Pases intentados", "Pases del rival"]],
      ["Defensa y portería", ["Recuperaciones", "Amarillas del rival", "Algo raro"]],
    ]);
    expect(famsOf([{ t: "Remates" }]).map((f) => f.t)).toEqual(["Ataque"]);
  });

  it("maps statuses to dots, opens the ficha and leaves «El rival» off while a player is chosen", () => {
    const open = vi.fn();
    const v = {
      juego: {
        tiles: [tile("015", "Goles marcados", "ok", 4), tile("070", "Precisión de pase", "part", "80 %"), tile("206", "Recuperaciones", "none", "-")],
        teamOpts: [{ t: "Manchester Piti", on: true, pick: vi.fn() }, { t: "El rival", on: false, pick: vi.fn() }], parteOpts: [],
        who: [{ key: "a", t: "Ana", n: 7, on: true, pick: vi.fn() }], whoAll: vi.fn(),
        slices: [], tramos: [], pairs: [], passes: { attempted: 10, completed: 8, failed: 1, unknown: 1 }, cov: { ok: "", part: "", none: "", hasNone: false }, note: "",
      },
      ws: ws(),
    } as unknown as V;
    const g = juego(v, st({ jug: ["a"] }), { open, grow: vi.fn() });
    const tiles = g.fams.flatMap((f) => f.tiles);
    expect(tiles.map((x) => [x.cls, x.v])).toEqual([["is-ok", "4"], ["is-part", "80 %"], ["", "–"]]);
    tiles[0].open();
    expect(open).toHaveBeenCalledWith("metric", "015");
    expect(g.teams.map((o) => !!o.off)).toEqual([false, true]);
    expect(g.locked).toBe(true);
    expect(g.who.map((o) => [o.t, o.on])).toEqual([["Todos", false], ["Ana", true]]);
    expect(g.passMeta).toBe("10 intentados · 80 % de precisión");
    expect(g.mesaT).toBe("Siete vistas rápidas o tus columnas, entre 412");
  });
});

describe("El juego · la mesa", () => {
  it("lists the unknowns last (the view's sort) and marks partial, unknown and the sorted column", () => {
    const row = (id: string, value: number | null, status: MetricResult["status"] = "complete"): AnalysisWorkspaceRow => ({ person: { id, name: id, number: 1 }, results: new Map([["067", result(value, status)]]) });
    const sorted = sortAnalysisRows([row("nadie", null, "unknown"), row("poco", 2, "partial"), row("mucho", 9)], "067", "asc");
    const rows = sorted.map((r) => ({ key: r.person.id, name: r.person.name, n: 1, cls: "", cells: [{ key: "067", v: r.results.get("067")?.value == null ? "-" : String(r.results.get("067")?.value), status: r.results.get("067")?.status, reason: "por qué" }] }));
    const ms = mesa({ ws: ws({ rows, cols: [sortCol("067", "ascending")] }) } as unknown as V, { set: vi.fn(), open: vi.fn() }, "");
    expect(ms.rows.map((r) => r.key)).toEqual(["poco", "mucho", "nadie"]);
    expect(ms.rows.map((r) => r.cells[0].cls)).toEqual(["is-partial is-on", "is-on", "is-unknown is-on"]);
    expect(ms.rows[2].cells[0].v).toBe("–");
    expect(ms.head[0]).toMatchObject({ aria: "ascending", on: true });
    expect(ms.foot.map((c) => c.v)).toEqual(["–", "80%"]);
  });

  it("toggles a column into Personalizado and never leaves the table without columns", () => {
    const set = vi.fn();
    const ms = mesa({ ws: ws({ cols: [sortCol("067", "descending")] }) } as unknown as V, { set, open: vi.fn() }, "");
    const col = (key: string, selected: boolean, available = true) => ({ key, t: key, family: "Pases", selected, available, reason: "falta", toggle: vi.fn() });
    const ms2 = mesa({ ws: ws({ cols: [sortCol("067", "descending")], columns: [col("067", true), col("070", false, false)] }) } as unknown as V, { set, open: vi.fn() }, "");
    expect(ms2.cols[1]).toMatchObject({ sub: "070 · sin datos en las actas", cls: "is-na" });
    ms2.cols[1].pick();
    expect(set).toHaveBeenLastCalledWith({ wsColumns: ["067", "070"] });
    ms2.cols[0].pick();
    expect(set).toHaveBeenLastCalledWith({ wsColumns: ["067"] });
    expect(ms.sets.map((s) => s.t)).toEqual(["Resumen", "Pases y creación", "Personalizado"]);
    ms.sets[2].pick();
    expect(set).toHaveBeenLastCalledWith({ wsColumns: ["067"] });
    expect(ms.fams.map((f) => [f.t, f.n])).toEqual([["Todas las familias", 412], ["Pases", 40], ["Remates", 12]]);
    expect(ms.colCount).toBe("1 columna elegida · 0 en esta lista");
  });

  it("says the selection it follows and opens the export on CSV", () => {
    const open = vi.fn();
    const ms = mesa({ ws: ws() } as unknown as V, { set: vi.fn(), open }, "Hasta la J3");
    expect(ms.lead).toContain("Son las cifras de la selección (Hasta la J3)");
    ms.dl();
    expect(open).toHaveBeenCalledWith("export", "csv");
  });
});

describe("El juego · el catálogo", () => {
  const cat = (p: Partial<NuView["cat"]> = {}) =>
    ({
      loading: false, q: "", setQ: vi.fn(), xOn: false, toggleX: vi.fn(), more: true, showMore: vi.fn(), empty: false, n: 30, excl: 5,
      fams: [{ key: "", t: "Todas", on: true, pick: vi.fn() }, { key: "Pases", t: "Pases", on: false, pick: vi.fn() }, { key: "Vídeo", t: "Vídeo", on: false, pick: vi.fn() }],
      famN: { Pases: 30 },
      items: [{ key: "067", id: "067", t: "Pases intentados", fam: "Pases", cls: "is-part", st: "Parcial · 2", pick: vi.fn(), def: "Los pases.", v: "2", stT: "Parcial" }],
      ...p,
    }) as unknown as NuView["cat"];
  it("counts the families, hides the empty ones and pages by 24", () => {
    const ct = catalogo({ cat: cat() } as unknown as V, st());
    expect(ct.fams.map((f) => [f.t, f.n])).toEqual([["Todas", 30], ["Pases", 30]]);
    expect(ct.count).toBe("30 estadísticas");
    expect(ct.moreT).toBe("Ver 24 más (24 de 30)");
    expect(ct.items[0]).toMatchObject({ v: "2", st: "Parcial", cls: "is-part", def: "Los pases." });
  });
  it("says how many are outside the audio when they are included", () => {
    expect(catalogo({ cat: cat({ xOn: true }) } as unknown as V, st({ catX: true })).count).toBe("30 estadísticas, con las 5 que no se narran por audio");
    expect(catalogo({ cat: cat({ xOn: true, q: "pase" }) } as unknown as V, st({ catX: true })).count).toBe("30 estadísticas, incluidas las que no se narran por audio");
  });
});

describe("El juego · la ficha y la exportación", () => {
  const mt = { id: "070", t: "Precisión de pase", fam: "Pases", v: "-", st: "Parcial", cls: "is-part", def: "", narr: "", scope: "Jugador", why: "", evid: [], noEv: true, evMore: "", excluded: false,
    rows: [{ key: "a", name: "Ana", n: 7, v: "90%", w: 100 }, { key: "b", name: "Bea", n: 9, v: "45%", w: 50 }] };
  it("draws «Por jugador» and sends the column to the mesa, sorted by it", () => {
    vi.useFakeTimers();
    const ask = vi.fn(), grow = vi.fn();
    const fi = ficha({ mt, ws: ws({ cols: [sortCol("067", "none")] }) } as unknown as V, st(), { ask, grow })!;
    expect(fi.rows.map((r) => r.name)).toEqual(["Ana", "Bea"]);
    expect(fi).toMatchObject({ v: "–", cls: "is-part", def: "Sin definición en el catálogo.", narr: "—", hasRows: true });
    fi.toMesa();
    expect(ask).toHaveBeenCalledWith("juego", { wsColumns: ["067", "070"], wsSort: "070", wsDirection: "desc", wsFamily: "Pases", wsQuery: "" });
    vi.runAllTimers();
    expect(grow).toHaveBeenCalledWith("mesa");
    fi.toCat();
    expect(ask).toHaveBeenLastCalledWith("juego", { catFam: "Pases", catQ: "", catN: 24, catX: false });
    vi.useRealTimers();
  });
  it("exports the format it was opened with and downloads for real", () => {
    expect(exFmtOf(st({ sheetId: "csv", exFmt: "json" }))).toBe("csv");
    const csv = vi.fn(), json = vi.fn();
    const ex = exportar({ ws: ws(), json: { hoy: "2026-10-31" } } as unknown as V, st({ sheetId: "csv" }), { set: vi.fn(), csv, json }, "");
    expect(ex.preview.split("\n")[0]).toBe("Jugador;Dorsal;col 067");
    ex.go();
    expect(csv).toHaveBeenCalledWith("mesa");
    const ej = exportar({ ws: ws(), json: { hoy: "2026-10-31" } } as unknown as V, st(), { set: vi.fn(), csv, json }, "En casa");
    expect(ej.preview).toContain('"filtro": "En casa"');
    expect(ej.doneT).toBe("Descargado: piti-estadisticas-2026-10-31.json");
    ej.go();
    expect(json).toHaveBeenCalled();
  });
});
