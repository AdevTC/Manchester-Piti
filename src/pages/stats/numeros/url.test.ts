import { describe, expect, it } from "vitest";
import { addressKey, hojaOf, pathOf, peopleIndex, rankingOf, rankingParam, screenAt, sheetOfHoja, stateFromUrl, urlOf } from "./url";
import type { NuState } from "./view";

const people = peopleIndex([
  { id: "p1", name: "Alcides" },
  { id: "p2", name: "Adrián T.C." },
  { id: "p3", name: "Kevin" },
  { id: "p4", name: "Kevin" },
]);
const BASE = stateFromUrl("/estadisticas", {}, people);
const st = (p: Partial<NuState>): NuState =>
  ({ ...BASE, upto: 99, playing: false, raceK: "goles", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles", rq: "", catN: 24, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "", ...p }) as NuState;
const ctx = { people, seasonWord: undefined, edge: 8, narrow: false };

describe("Números: every screen has its address", () => {
  it("reads every screen including the interactive charts from the path", () => {
    expect(screenAt("/estadisticas")).toMatchObject({ place: "temporada", grow: null, ysi: false });
    expect(screenAt("/estadisticas/y-si")).toMatchObject({ place: "temporada", ysi: true });
    expect(screenAt("/estadisticas/jugadores/")).toMatchObject({ place: "jugadores" });
    expect(screenAt("/estadisticas/jugadores/campo")).toMatchObject({ place: "jugadores", jugView: "campo", campoView: "pases" });
    expect(screenAt("/estadisticas/jugadores/campo/puestos")).toMatchObject({ place: "jugadores", jugView: "campo", campoView: "puestos" });
    expect(screenAt("/estadisticas/jugadores/evolucion")).toMatchObject({ place: "jugadores", jugView: "evo" });
    expect(screenAt("/estadisticas/juego")).toMatchObject({ place: "juego", grow: null });
    expect(screenAt("/estadisticas/juego/tabla")).toMatchObject({ place: "juego", grow: "mesa" });
    expect(screenAt("/estadisticas/juego/graficas")).toMatchObject({ place: "juego", grow: "graficas" });
    expect(screenAt("/estadisticas/juego/catalogo")).toMatchObject({ place: "juego", grow: "catalogo" });
    expect(screenAt("/estadisticas/rivales")).toMatchObject({ place: "rivales" });
  });
  it("the round-3 addresses open where their screens went: El campo in Jugadores, Récords in Temporada", () => {
    expect(screenAt("/estadisticas/campo")).toMatchObject({ place: "jugadores", jugView: "campo", campoView: "pases" });
    expect(screenAt("/estadisticas/campo/puestos")).toMatchObject({ place: "jugadores", jugView: "campo", campoView: "puestos" });
    expect(screenAt("/estadisticas/campo/sistemas")).toMatchObject({ place: "temporada" });
    expect(screenAt("/estadisticas/records")).toMatchObject({ place: "temporada", recView: "rachas" });
    expect(screenAt("/estadisticas/records/marcas")).toMatchObject({ place: "temporada", recView: "marcas" });
    expect(screenAt("/estadisticas/records/cromos")).toMatchObject({ place: "temporada", recView: "cromos" });
    expect(screenAt("/estadisticas/records/evolucion")).toMatchObject({ place: "jugadores", jugView: "evo" });
    expect(pathOf(st(stateFromUrl("/estadisticas/campo/puestos", {}, people)))).toBe("/estadisticas/jugadores/campo/puestos");
    expect(pathOf(st(stateFromUrl("/estadisticas/records/cromos", {}, people)))).toBe("/estadisticas");
  });
  it("writes back the path it read", () => {
    for (const p of ["/estadisticas", "/estadisticas/jugadores", "/estadisticas/jugadores/campo", "/estadisticas/jugadores/campo/puestos", "/estadisticas/jugadores/evolucion", "/estadisticas/juego", "/estadisticas/juego/tabla", "/estadisticas/juego/graficas", "/estadisticas/juego/catalogo", "/estadisticas/rivales"]) {
      const s = stateFromUrl(p, {}, people);
      expect(pathOf(st(s)), p).toBe(p);
    }
    expect(pathOf(st({ place: "temporada", sheet: "ysi" }))).toBe("/estadisticas/y-si");
  });
});

describe("the boards' Spanish parameters", () => {
  it("keeps custom columns, preset and sorting on reload and across screens", () => {
    const selection = { wsSet: "pases", wsColumns: ["067", "068", "069", "070"], wsSort: "070", wsDirection: "asc" as const, wsQuery: "pase", wsFamily: "Pases" };
    const u = urlOf(st({ place: "juego", grow: "mesa", parte: "2", ...selection }), ctx);
    expect(u.search).toMatchObject({ columnas: "067,068,069,070", orden: "070", sentido: "asc", vista: "pases", parte: "2" });
    expect(stateFromUrl(u.path, u.search, people)).toMatchObject(selection);
    const next = urlOf(st({ place: "jugadores", ...selection }), ctx);
    expect(stateFromUrl(next.path, next.search, people)).toMatchObject(selection);
  });
  it("rejects invalid column parameters and preserves an explicitly empty selection", () => {
    expect(stateFromUrl("/estadisticas/juego/tabla", { columnas: "067,067,<script>,070", orden: "bad", sentido: "bad", vista: "bad" }, people)).toMatchObject({ wsColumns: ["067", "070"], wsSort: undefined, wsDirection: "desc", wsSet: "resumen" });
    expect(stateFromUrl("/estadisticas/juego/tabla", { columnas: "" }, people).wsColumns).toEqual([]);
  });
  it("ranking: the quick five by word, the rest by label", () => {
    expect(rankingParam("goles")).toBeUndefined();
    expect(rankingParam("asist")).toBe("asistencias");
    expect(rankingParam("yc")).toBe("amarillas");
    expect(rankingOf("minutos")).toBe("min");
    expect(rankingOf("amarillas")).toBe("yc");
    expect(rankingOf("goles-asistencias")).toBe("ga");
    expect(rankingOf("nada")).toBeNull();
  });
  it("players by their name in the address, by id when two share it", () => {
    expect(people.word("p2")).toBe("adrian-t-c");
    expect(people.word("p3")).toBe("p3");
    expect(people.id("alcides")).toBe("p1");
    expect(people.id("p4")).toBe("p4");
    expect(people.id("kevin")).toBeNull();
  });
  it("the time bar on every screen: temporada, hasta, campo, jugadores, partidos", () => {
    const s = stateFromUrl("/estadisticas/rivales", { temporada: "todas", hasta: "j3", campo: "fuera", jugadores: "alcides,p2", partidos: ["m1", "m2"] }, people);
    expect(s).toMatchObject({ temporada: "todas", upto: 3, campo: "fuera", jug: ["p1", "p2"], partidos: ["m1", "m2"] });
    expect(stateFromUrl("/estadisticas", { temporada: "temporada-1" }, people)).toMatchObject({ temporada: "esta", seasonWord: "temporada-1" });
    const u = urlOf(st({ place: "rivales", temporada: "esta", upto: 3, campo: "casa", jug: ["p1"], partidos: ["m1"] }), ctx);
    expect(u).toMatchObject({ path: "/estadisticas/rivales", search: { hasta: "j3", campo: "casa", jugadores: "alcides", partidos: "m1" } });
    expect(urlOf(st({ upto: 8 }), ctx).search.hasta).toBeUndefined();
    const all = urlOf(st({ temporada: "todas", upto: 3 }), ctx).search;
    expect(all.temporada).toBe("todas");
    expect(all.hasta).toBeUndefined();
  });
  it("each screen's own: jugador, contra, estrella, puesto, equipo, parte, familia, fuera-del-audio, q, rival, ver", () => {
    expect(stateFromUrl("/estadisticas/jugadores", { ranking: "porra", jugador: "alcides", ver: "todo" }, people)).toMatchObject({ rankK: "porra", pick: "p1", grow: "jugadores", sheet: null });
    expect(stateFromUrl("/estadisticas/jugadores", { jugador: "alcides", contra: "adrian-t-c" }, people)).toMatchObject({ pick: "p1", vsOn: true, vsB: "p2" });
    expect(urlOf(st({ place: "jugadores", pick: "p1", vsOn: true, vsB: "p2" }), ctx).search).toMatchObject({ jugador: "alcides", contra: "adrian-t-c" });
    expect(stateFromUrl("/estadisticas/jugadores/campo", { estrella: "alcides" }, people).star).toBe("p1");
    expect(stateFromUrl("/estadisticas/campo", { estrella: "kevin" }, people).star).toBeNull();
    expect(stateFromUrl("/estadisticas/campo/puestos", { puesto: "dc" }, people).puesto).toBe("DC");
    expect(urlOf(st({ place: "jugadores", jugView: "campo", campoView: "puestos", puesto: "DC" }), ctx)).toMatchObject({ path: "/estadisticas/jugadores/campo/puestos", search: { puesto: "dc" } });
    expect(stateFromUrl("/estadisticas/juego/catalogo", { equipo: "rival", parte: 2, familia: "pases", "fuera-del-audio": 1, q: "pase" }, people)).toMatchObject({ team: "them", parte: "2", catFam: "pases", catX: true, catQ: "pase", grow: "catalogo" });
    expect(stateFromUrl("/estadisticas/rivales", { rival: "orduna-fc" }, people)).toMatchObject({ rival: "orduna-fc", sheet: null });
    expect(stateFromUrl("/estadisticas", { ver: "todo" }, people)).toMatchObject({ allTable: true, grow: null });
    expect(urlOf(st({ place: "temporada", allTable: true }), ctx).search.ver).toBe("todo");
    const u = urlOf(st({ place: "juego", grow: "catalogo", team: "them", parte: "1", catFam: "Pases", catX: true, catQ: "x" }), ctx);
    expect(u).toEqual({ path: "/estadisticas/juego/catalogo", search: expect.objectContaining({ equipo: "rival", parte: "1", familia: "pases", "fuera-del-audio": "1", q: "x" }) });
    expect(urlOf(st({ place: "rivales", rival: "Orduña fc" }), ctx).search).toMatchObject({ rival: "orduna-fc" });
  });
  it("the sheets: metrica and buscar on any screen, hoja for the rest; a player or a rival opens his place", () => {
    expect(stateFromUrl("/estadisticas", { jugador: "alcides" }, people)).toMatchObject({ place: "jugadores", pick: "p1", sheet: null });
    expect(stateFromUrl("/estadisticas/juego", { rival: "orduna-fc" }, people)).toMatchObject({ place: "rivales", rival: "orduna-fc", sheet: null });
    expect(stateFromUrl("/estadisticas/juego/catalogo", { metrica: "070" }, people)).toMatchObject({ sheet: "metric", sheetId: "070" });
    expect(stateFromUrl("/estadisticas", { buscar: "" }, people)).toMatchObject({ sheet: "search", sq: "" });
    expect(stateFromUrl("/estadisticas/y-si", {}, people)).toMatchObject({ sheet: "ysi" });
    expect(hojaOf("scope", null)).toBe("filtros");
    expect(hojaOf("stats", null)).toBe("estadisticas");
    expect(hojaOf("export", null)).toBe("exportar");
    expect(stateFromUrl("/estadisticas/juego", { hoja: "exportar" }, people)).toMatchObject({ sheet: "export" });
    expect(stateFromUrl("/estadisticas/jugadores", { hoja: "estadisticas" }, people)).toMatchObject({ sheet: "stats" });
    expect(stateFromUrl("/estadisticas", { hoja: "que-es-moviola" }, people).sheet).toBeNull();
    expect(hojaOf("info", "m:goles")).toBe("que-es-m-goles");
    expect(sheetOfHoja("que-es-m-goles")).toEqual({ sheet: "info", id: "m:goles" });
    expect(sheetOfHoja("que-es-moviola")).toEqual({ sheet: "info", id: "moviola" });
    expect(sheetOfHoja("que-es-nada")).toBeNull();
    expect(urlOf(st({ sheet: "search", sq: "orduña" }), ctx).search.buscar).toBe("orduña");
  });
  it("one key per address, whatever the order and the remembered season", () => {
    expect(addressKey("/estadisticas/", { b: 1, a: [1, 2], season: "x", c: undefined })).toBe(addressKey("/estadisticas", { a: "1,2", b: "1" }));
  });
});
