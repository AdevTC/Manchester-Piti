import { describe, expect, it } from "vitest";
import { anchorAt, statsViewAt, statsViewPath, type StatsView } from "./interimScreens";

// Until each redesign lands, a new address opens today's page on what its old ?view=, ?tab= or #hash opened.
describe("Números: the view of each screen", () => {
  it("reads it from the address", () => {
    expect(statsViewAt("/estadisticas", {})).toEqual({ view: "summary" });
    expect(statsViewAt("/estadisticas/y-si", {})).toEqual({ view: "summary" });
    expect(statsViewAt("/estadisticas/jugadores", {})).toEqual({ view: "players" });
    expect(statsViewAt("/estadisticas/jugadores", { ranking: "minutos" })).toEqual({ view: "minutes" });
    expect(statsViewAt("/estadisticas/campo/puestos", {})).toEqual({ view: "positions" });
    expect(statsViewAt("/estadisticas/juego/catalogo", {})).toEqual({ view: "game" });
    expect(statsViewAt("/estadisticas/rivales/", {})).toEqual({ view: "rivals" });
    expect(statsViewAt("/estadisticas/records", {})).toEqual({ view: "explore", section: "streaks" });
    expect(statsViewAt("/estadisticas/records/marcas", {})).toEqual({ view: "explore", section: "individual" });
    expect(statsViewAt("/estadisticas/records/evolucion", {})).toEqual({ view: "explore", section: "evolution" });
  });
  it("each view's tab goes to a screen that reads back as that view", () => {
    const views: StatsView[] = ["summary", "players", "positions", "rivals", "game", "explore"];
    for (const view of views) expect(statsViewAt(statsViewPath(view), {}).view, view).toBe(view);
    expect(statsViewAt(statsViewPath("minutes"), { ranking: "minutos" }).view).toBe("minutes");
    expect(statsViewAt(statsViewPath("explore", "evolution"), {}).section).toBe("evolution");
    expect(statsViewAt(statsViewPath("explore", "streaks"), {}).section).toBe("streaks");
  });
});

describe("the blocks", () => {
  it("the block an address points at", () => {
    expect(anchorAt("/vestuario")).toBeNull();
    // (El club, the vestuario and the profile read their own address: no anchor)
    expect(anchorAt("/vestuario/caja")).toBeNull();
    expect(anchorAt("/club/historia")).toBeNull();
    expect(anchorAt("/perfil/nombre")).toBeNull();
    expect(anchorAt("/club")).toBeNull();
  });
});
