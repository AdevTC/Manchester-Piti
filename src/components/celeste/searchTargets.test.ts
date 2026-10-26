import { describe, expect, it } from "vitest";
import { targetHref } from "./searchModel";
import { legacyHref } from "../../lib/legacyUrls";

// «Buscar» leads to the new addresses: never one the router has to redirect.
describe("where a search result leads", () => {
  it.each([
    [{ to: "jugador", playerId: "alcides", season: "t1" }, "/jugadores/alcides?season=t1"],
    [{ to: "partido", matchId: "j1" }, "/partidos/j1"],
    [{ to: "match", matchId: "j1", tab: "vestuario" }, "/partidos/j1/vestuario"],
    [{ to: "partidos" }, "/partidos"],
    [{ to: "partidos", season: "t0" }, "/partidos?temporada=t0"],
    [{ to: "partidos", view: "tabla" }, "/partidos/tabla"],
    [{ to: "stats" }, "/estadisticas"],
    [{ to: "stats", view: "players" }, "/estadisticas/jugadores"],
    [{ to: "stats", view: "minutes" }, "/estadisticas/jugadores?ranking=minutos&ver=todo"],
    [{ to: "stats", view: "positions" }, "/estadisticas/campo/puestos"],
    [{ to: "stats", view: "explore" }, "/estadisticas/records/marcas"],
    [{ to: "plantilla" }, "/plantilla"],
    [{ to: "club" }, "/club"],
    [{ to: "clubAt", hash: "cl-kits" }, "/club/equipo"],
    [{ to: "clubAt", hash: "cl-trophies" }, "/club/vitrina"],
    [{ to: "vestuario" }, "/vestuario"],
    [{ to: "vestuario", hash: "vx-caja" }, "/vestuario/caja"],
    [{ to: "vestuario", hash: "vx-ausencias" }, "/vestuario/ausencias"],
    [{ to: "vestuario", hash: "vx-rsvp" }, "/vestuario#vx-rsvp"],
    [{ to: "profile" }, "/perfil"],
    [{ to: "pizarra" }, "/pizarra"],
  ] as const)("%o → %s", (target, href) => {
    expect(targetHref(target)).toBe(href);
    expect(legacyHref(href)).toBeNull();
  });
  it("«Vota al MVP» with no vote open: the vestuario's #vx-mvp, sent to the last vote once the matches are in", () => {
    expect(targetHref({ to: "vestuario", hash: "vx-mvp" })).toBe("/vestuario#vx-mvp");
  });
  it("«Sacar el marcador» opens no page; the calendar feed is its own address", () => {
    expect(targetHref({ to: "pip" })).toBeNull();
    expect(targetHref({ to: "href", href: "webcal://x.test/calendario.ics" })).toBe("webcal://x.test/calendario.ics");
  });
});
