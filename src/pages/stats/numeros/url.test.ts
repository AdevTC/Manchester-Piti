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
    expect(screenAt("/estadisticas/campo")).toMatchObject({ place: "campo", campoView: "pases" });
    expect(screenAt("/estadisticas/campo/puestos")).toMatchObject({ place: "campo", campoView: "puestos" });
    expect(screenAt("/estadisticas/campo/sistemas")).toMatchObject({ place: "campo", campoView: "sistemas" });
    expect(screenAt("/estadisticas/juego")).toMatchObject({ place: "juego", grow: null });
    expect(screenAt("/estadisticas/juego/tabla")).toMatchObject({ place: "juego", grow: "mesa" });
    expect(screenAt("/estadisticas/juego/graficas")).toMatchObject({ place: "juego", grow: "graficas" });
    expect(screenAt("/estadisticas/juego/catalogo")).toMatchObject({ place: "juego", grow: "catalogo" });
    expect(screenAt("/estadisticas/rivales")).toMatchObject({ place: "rivales" });
    expect(screenAt("/estadisticas/records")).toMatchObject({ place: "records", recView: "rachas" });
    expect(screenAt("/estadisticas/records/marcas")).toMatchObject({ recView: "marcas" });
    expect(screenAt("/estadisticas/records/cromos")).toMatchObject({ recView: "cromos" });
    expect(screenAt("/estadisticas/records/evolucion")).toMatchObject({ recView: "evolucion" });
  });
  it("writes back the path it read", () => {
    for (const p of ["/estadisticas", "/estadisticas/jugadores", "/estadisticas/campo", "/estadisticas/campo/puestos", "/estadisticas/campo/sistemas", "/estadisticas/juego", "/estadisticas/juego/tabla", "/estadisticas/juego/graficas", "/estadisticas/juego/catalogo", "/estadisticas/rivales", "/estadisticas/records", "/estadisticas/records/marcas", "/estadisticas/records/cromos", "/estadisticas/records/evolucion"]) {
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
  it("each screen's own: jugador, estrella, puesto, equipo, parte, familia, fuera-del-audio, q, rival, ver", () => {
    expect(stateFromUrl("/estadisticas/jugadores", { ranking: "porra", jugador: "alcides", ver: "todo" }, people)).toMatchObject({ rankK: "porra", pick: "p1", grow: "jugadores", sheet: null });
    expect(stateFromUrl("/estadisticas/campo", { estrella: "kevin" }, people).star).toBeNull();
    expect(stateFromUrl("/estadisticas/campo/puestos", { puesto: "dc" }, people).puesto).toBe("DC");
    expect(stateFromUrl("/estadisticas/juego/catalogo", { equipo: "rival", parte: 2, familia: "pases", "fuera-del-audio": 1, q: "pase" }, people)).toMatchObject({ team: "them", parte: "2", catFam: "pases", catX: true, catQ: "pase", grow: "catalogo" });
    expect(stateFromUrl("/estadisticas/rivales", { rival: "orduna-fc" }, people)).toMatchObject({ rival: "orduna-fc", sheet: null });
    expect(stateFromUrl("/estadisticas", { ver: "todo" }, people).grow).toBe("tabla");
    const u = urlOf(st({ place: "juego", grow: "catalogo", team: "them", parte: "1", catFam: "Pases", catX: true, catQ: "x" }), ctx);
    expect(u).toEqual({ path: "/estadisticas/juego/catalogo", search: expect.objectContaining({ equipo: "rival", parte: "1", familia: "pases", "fuera-del-audio": "1", q: "x" }) });
    expect(urlOf(st({ place: "rivales", rival: "Orduña fc", grow: "rivales" }), ctx).search).toMatchObject({ rival: "orduna-fc", ver: "todo" });
  });
  it("the sheets: jugador, rival, metrica and buscar on any screen; hoja for the rest", () => {
    expect(stateFromUrl("/estadisticas", { jugador: "alcides" }, people)).toMatchObject({ sheet: "player", sheetId: "p1" });
    expect(stateFromUrl("/estadisticas/juego", { rival: "orduna-fc" }, people)).toMatchObject({ sheet: "rival", sheetId: "orduna-fc" });
    expect(stateFromUrl("/estadisticas/juego/catalogo", { metrica: "070" }, people)).toMatchObject({ sheet: "metric", sheetId: "070" });
    expect(stateFromUrl("/estadisticas", { buscar: "" }, people)).toMatchObject({ sheet: "search", sq: "" });
    expect(stateFromUrl("/estadisticas/y-si", {}, people)).toMatchObject({ sheet: "ysi" });
    expect(hojaOf("scope", null)).toBe("filtros");
    expect(hojaOf("info", "m:goles")).toBe("que-es-m-goles");
    expect(sheetOfHoja("que-es-m-goles")).toEqual({ sheet: "info", id: "m:goles" });
    expect(sheetOfHoja("que-es-moviola")).toEqual({ sheet: "info", id: "moviola" });
    expect(sheetOfHoja("que-es-nada")).toBeNull();
    expect(urlOf(st({ sheet: "player", sheetId: "p2" }), ctx).search.jugador).toBe("adrian-t-c");
    expect(urlOf(st({ sheet: "search", sq: "orduña" }), ctx).search.buscar).toBe("orduña");
  });
  it("one key per address, whatever the order and the remembered season", () => {
    expect(addressKey("/estadisticas/", { b: 1, a: [1, 2], season: "x", c: undefined })).toBe(addressKey("/estadisticas", { a: "1,2", b: "1" }));
  });
});
