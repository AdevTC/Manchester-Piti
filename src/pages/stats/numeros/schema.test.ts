import { describe, expect, it } from "vitest";
import { numerosSearchSchema } from "../../../router";

// The address Números writes must come back from the router whole (a parameter the schema rejects is dropped
// silently: the moviola would forget its jornada, a statistic's card its id).
describe("Números · the router keeps every parameter the page writes", () => {
  it("the time bar and the screens' own", () => {
    const s = numerosSearchSchema.parse({
      temporada: "todas", hasta: "j8", campo: "casa", partidos: "m1,m2", jugadores: ["alcides", "erik"], buscar: "", ver: "todo", ranking: "amarillas",
      jugador: "alcides", estrella: "kevin", puesto: "dc", equipo: "rival", parte: "2", familia: "pases", metrica: "015", "fuera-del-audio": "1", q: "pase", rival: "orduna-fc", hoja: "filtros",
    });
    expect(s).toEqual({
      temporada: "todas", hasta: "j8", campo: "casa", partidos: "m1,m2", jugadores: "alcides,erik", buscar: "", ver: "todo", ranking: "amarillas",
      jugador: "alcides", estrella: "kevin", puesto: "dc", equipo: "rival", parte: 2, familia: "pases", metrica: "015", "fuera-del-audio": 1, q: "pase", rival: "orduna-fc", hoja: "filtros",
    });
    expect(numerosSearchSchema.parse({ metrica: "A07" }).metrica).toBe("A07");
  });
  it("drops what is not one of them", () => {
    expect(numerosSearchSchema.parse({ hasta: "8", metrica: "15", view: "players", players: ["x"] })).toEqual({});
  });
});
