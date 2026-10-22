import { describe, expect, it } from "vitest";
import { anchorAt, interimStatsSearch, statsSearchToWrite, profileHashAt, statsViewAt, statsViewPath, type StatsView } from "./interimScreens";

// Until each redesign lands, a new address opens today's page on what its old ?view=, ?tab= or #hash opened.
describe("Números: the view of each screen", () => {
  it("reads it from the address", () => {
    expect(statsViewAt("/numeros", {})).toEqual({ view: "summary" });
    expect(statsViewAt("/numeros/y-si", {})).toEqual({ view: "summary" });
    expect(statsViewAt("/numeros/jugadores", {})).toEqual({ view: "players" });
    expect(statsViewAt("/numeros/jugadores", { ranking: "minutos" })).toEqual({ view: "minutes" });
    expect(statsViewAt("/numeros/campo/puestos", {})).toEqual({ view: "positions" });
    expect(statsViewAt("/numeros/juego/catalogo", {})).toEqual({ view: "game" });
    expect(statsViewAt("/numeros/rivales/", {})).toEqual({ view: "rivals" });
    expect(statsViewAt("/numeros/records", {})).toEqual({ view: "explore", section: "streaks" });
    expect(statsViewAt("/numeros/records/marcas", {})).toEqual({ view: "explore", section: "individual" });
    expect(statsViewAt("/numeros/records/evolucion", {})).toEqual({ view: "explore", section: "evolution" });
    expect(statsViewAt("/plantilla/cara-a-cara", {})).toEqual({ view: "compare" });
  });
  it("each view's tab goes to a screen that reads back as that view", () => {
    const views: StatsView[] = ["summary", "players", "positions", "rivals", "compare", "game", "explore"];
    for (const view of views) expect(statsViewAt(statsViewPath(view), {}).view, view).toBe(view);
    expect(statsViewAt(statsViewPath("minutes"), { ranking: "minutos" }).view).toBe("minutes");
    expect(statsViewAt(statsViewPath("explore", "evolution"), {}).section).toBe("evolution");
    expect(statsViewAt(statsViewPath("explore", "streaks"), {}).section).toBe("streaks");
  });
  it("reads Números' Spanish parameters as today's page's English ones; its own win", () => {
    expect(interimStatsSearch({ partidos: ["m1"], jugadores: "a,b", familia: "pase", metrica: "070", equipo: "rival", parte: 2, "fuera-del-audio": 1, temporada: "todas" }, "/numeros/juego/catalogo")).toMatchObject({
      matches: ["m1"],
      players: ["a", "b"],
      family: "pase",
      metric: "070",
      team: "opponent",
      period: 2,
      excluded: true,
      seasons: [],
      analysis: "catalog",
    });
    expect(interimStatsSearch({ temporada: "t1,t2" }, "/numeros").seasons).toEqual(["t1", "t2"]);
    expect(interimStatsSearch({ temporada: "t1", seasons: ["t0"], family: "tiro", familia: "pase" }, "/numeros")).toMatchObject({ seasons: ["t0"], family: "tiro" });
    expect(interimStatsSearch({}, "/numeros")).toEqual({});
  });
  it("what the page writes back has no Spanish twin left, so a filter that arrived in Spanish can be removed", () => {
    const arrived = { temporada: "todas", partidos: ["j1"], jugadores: ["p1"], equipo: "rival", parte: 2, familia: "pase", q: "x" };
    const own = statsSearchToWrite(arrived, "/numeros/juego");
    expect(own).toEqual({ matches: ["j1"], players: ["p1"], team: "opponent", period: 2, family: "pase", seasons: [], q: "x" });
    // «Quitar filtros»: the page's own clearing wins, nothing comes back from the Spanish params
    const cleared = { ...own, season: "all", seasons: undefined, matches: undefined, players: undefined, team: undefined, period: undefined };
    expect(interimStatsSearch(cleared, "/numeros/juego")).toMatchObject({ seasons: undefined, matches: undefined, players: undefined, team: undefined, period: undefined });
    // (the catalogue screen says so itself: never written)
    expect(statsSearchToWrite({}, "/numeros/juego/catalogo")).toEqual({});
  });
});

describe("the profile's tab and the blocks", () => {
  it("the profile's tabs", () => {
    expect(profileHashAt("/perfil")).toBe("");
    expect(profileHashAt("/perfil/temporada")).toBe("#temporada");
    expect(profileHashAt("/perfil/temporada/cromos")).toBe("#cromos");
    expect(profileHashAt("/perfil/ajustes/")).toBe("#ajustes");
    expect(profileHashAt("/avisos/a-medida")).toBe("#avisos");
  });
  it("the block an address points at", () => {
    expect(anchorAt("/vestuario")).toBeNull();
    expect(anchorAt("/vestuario/caja")).toBe("vx-caja");
    expect(anchorAt("/vestuario/encuestas/p1")).toBe("encuestas");
    expect(anchorAt("/vestuario/puerta")).toBe("puerta");
    expect(anchorAt("/club/vitrina/escudo")).toBe("cl-crest");
    expect(anchorAt("/club/vitrina/primera-victoria")).toBe("cl-trophies");
    expect(anchorAt("/club/historia")).toBe("cl-history");
    expect(anchorAt("/club/equipo/camiseta")).toBe("cl-kits");
    expect(anchorAt("/perfil/nombre")).toBe("pe-nombre");
    expect(anchorAt("/club")).toBeNull();
  });
});
