import { describe, expect, it } from "vitest";
import { addressKey, hojaOf, pathOf, peopleIndex, rankingOf, rankingParam, screenAt, sheetOfHoja, stateFromUrl, urlOf } from "./url";
import type { NuState } from "./view";

const people = peopleIndex([
  { id: "p1", name: "Alcides" },
  { id: "p2", name: "Adrián T.C." },
  { id: "p3", name: "Kevin" },
  { id: "p4", name: "Kevin" },
]);
const BASE = stateFromUrl("/numeros", {}, people);
const st = (p: Partial<NuState>): NuState =>
  ({ ...BASE, upto: 99, playing: false, raceK: "goles", cromoK: "todos", evoK: "goles", ysi: {}, sortK: "goles", rq: "", catN: 24, allStats: false, colSet: "basico", wsSet: "resumen", clockK: "ambos", streakK: "g", evoIds: null, sq: "", ...p }) as NuState;
const ctx = { people, seasonWord: undefined, edge: 8, narrow: false };

describe("Números: every screen has its address", () => {
  it("reads the 14 screens from the path", () => {
    expect(screenAt("/numeros")).toMatchObject({ place: "temporada", grow: null, ysi: false });
    expect(screenAt("/numeros/y-si")).toMatchObject({ place: "temporada", ysi: true });
    expect(screenAt("/numeros/jugadores/")).toMatchObject({ place: "jugadores" });
    expect(screenAt("/numeros/campo")).toMatchObject({ place: "campo", campoView: "pases" });
    expect(screenAt("/numeros/campo/puestos")).toMatchObject({ place: "campo", campoView: "puestos" });
    expect(screenAt("/numeros/campo/sistemas")).toMatchObject({ place: "campo", campoView: "sistemas" });
    expect(screenAt("/numeros/juego")).toMatchObject({ place: "juego", grow: null });
    expect(screenAt("/numeros/juego/tabla")).toMatchObject({ place: "juego", grow: "mesa" });
    expect(screenAt("/numeros/juego/catalogo")).toMatchObject({ place: "juego", grow: "catalogo" });
    expect(screenAt("/numeros/rivales")).toMatchObject({ place: "rivales" });
    expect(screenAt("/numeros/records")).toMatchObject({ place: "records", recView: "rachas" });
    expect(screenAt("/numeros/records/marcas")).toMatchObject({ recView: "marcas" });
    expect(screenAt("/numeros/records/cromos")).toMatchObject({ recView: "cromos" });
    expect(screenAt("/numeros/records/evolucion")).toMatchObject({ recView: "evolucion" });
  });
  it("writes back the path it read", () => {
    for (const p of ["/numeros", "/numeros/jugadores", "/numeros/campo", "/numeros/campo/puestos", "/numeros/campo/sistemas", "/numeros/juego", "/numeros/juego/tabla", "/numeros/juego/catalogo", "/numeros/rivales", "/numeros/records", "/numeros/records/marcas", "/numeros/records/cromos", "/numeros/records/evolucion"]) {
      const s = stateFromUrl(p, {}, people);
      expect(pathOf(st(s)), p).toBe(p);
    }
    expect(pathOf(st({ place: "temporada", sheet: "ysi" }))).toBe("/numeros/y-si");
  });
});

describe("the boards' Spanish parameters", () => {
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
    const s = stateFromUrl("/numeros/rivales", { temporada: "todas", hasta: "j3", campo: "fuera", jugadores: "alcides,p2", partidos: ["m1", "m2"] }, people);
    expect(s).toMatchObject({ temporada: "todas", upto: 3, campo: "fuera", jug: ["p1", "p2"], partidos: ["m1", "m2"] });
    expect(stateFromUrl("/numeros", { temporada: "temporada-1" }, people)).toMatchObject({ temporada: "esta", seasonWord: "temporada-1" });
    const u = urlOf(st({ place: "rivales", temporada: "esta", upto: 3, campo: "casa", jug: ["p1"], partidos: ["m1"] }), ctx);
    expect(u).toMatchObject({ path: "/numeros/rivales", search: { hasta: "j3", campo: "casa", jugadores: "alcides", partidos: "m1" } });
    expect(urlOf(st({ upto: 8 }), ctx).search.hasta).toBeUndefined();
    const all = urlOf(st({ temporada: "todas", upto: 3 }), ctx).search;
    expect(all.temporada).toBe("todas");
    expect(all.hasta).toBeUndefined();
  });
  it("each screen's own: jugador, estrella, puesto, equipo, parte, familia, fuera-del-audio, q, rival, ver", () => {
    expect(stateFromUrl("/numeros/jugadores", { ranking: "porra", jugador: "alcides", ver: "todo" }, people)).toMatchObject({ rankK: "porra", pick: "p1", grow: "jugadores", sheet: null });
    expect(stateFromUrl("/numeros/campo", { estrella: "kevin" }, people).star).toBeNull();
    expect(stateFromUrl("/numeros/campo/puestos", { puesto: "dc" }, people).puesto).toBe("DC");
    expect(stateFromUrl("/numeros/juego/catalogo", { equipo: "rival", parte: 2, familia: "pases", "fuera-del-audio": 1, q: "pase" }, people)).toMatchObject({ team: "them", parte: "2", catFam: "pases", catX: true, catQ: "pase", grow: "catalogo" });
    expect(stateFromUrl("/numeros/rivales", { rival: "orduna-fc" }, people)).toMatchObject({ rival: "orduna-fc", sheet: null });
    expect(stateFromUrl("/numeros", { ver: "todo" }, people).grow).toBe("tabla");
    const u = urlOf(st({ place: "juego", grow: "catalogo", team: "them", parte: "1", catFam: "Pases", catX: true, catQ: "x" }), ctx);
    expect(u).toEqual({ path: "/numeros/juego/catalogo", search: expect.objectContaining({ equipo: "rival", parte: "1", familia: "pases", "fuera-del-audio": "1", q: "x" }) });
    expect(urlOf(st({ place: "rivales", rival: "Orduña fc", grow: "rivales" }), ctx).search).toMatchObject({ rival: "orduna-fc", ver: "todo" });
  });
  it("the sheets: jugador, rival, metrica and buscar on any screen; hoja for the rest", () => {
    expect(stateFromUrl("/numeros", { jugador: "alcides" }, people)).toMatchObject({ sheet: "player", sheetId: "p1" });
    expect(stateFromUrl("/numeros/juego", { rival: "orduna-fc" }, people)).toMatchObject({ sheet: "rival", sheetId: "orduna-fc" });
    expect(stateFromUrl("/numeros/juego/catalogo", { metrica: "070" }, people)).toMatchObject({ sheet: "metric", sheetId: "070" });
    expect(stateFromUrl("/numeros", { buscar: "" }, people)).toMatchObject({ sheet: "search", sq: "" });
    expect(stateFromUrl("/numeros/y-si", {}, people)).toMatchObject({ sheet: "ysi" });
    expect(hojaOf("scope", null)).toBe("filtros");
    expect(hojaOf("info", "m:goles")).toBe("que-es-m-goles");
    expect(sheetOfHoja("que-es-m-goles")).toEqual({ sheet: "info", id: "m:goles" });
    expect(sheetOfHoja("que-es-moviola")).toEqual({ sheet: "info", id: "moviola" });
    expect(sheetOfHoja("que-es-nada")).toBeNull();
    expect(urlOf(st({ sheet: "player", sheetId: "p2" }), ctx).search.jugador).toBe("adrian-t-c");
    expect(urlOf(st({ sheet: "search", sq: "orduña" }), ctx).search.buscar).toBe("orduña");
  });
  it("one key per address, whatever the order and the remembered season", () => {
    expect(addressKey("/numeros/", { b: 1, a: [1, 2], season: "x", c: undefined })).toBe(addressKey("/numeros", { a: "1,2", b: "1" }));
  });
});
