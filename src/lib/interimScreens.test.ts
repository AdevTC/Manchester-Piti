import { describe, expect, it } from "vitest";
import { anchorAt, profileHashAt, statsViewAt, statsViewPath, type StatsView } from "./interimScreens";

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
  });
  it("each view's tab goes to a screen that reads back as that view", () => {
    const views: StatsView[] = ["summary", "players", "positions", "rivals", "game", "explore"];
    for (const view of views) expect(statsViewAt(statsViewPath(view), {}).view, view).toBe(view);
    expect(statsViewAt(statsViewPath("minutes"), { ranking: "minutos" }).view).toBe("minutes");
    expect(statsViewAt(statsViewPath("explore", "evolution"), {}).section).toBe("evolution");
    expect(statsViewAt(statsViewPath("explore", "streaks"), {}).section).toBe("streaks");
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
