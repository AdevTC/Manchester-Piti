import { describe, expect, it } from "vitest";
import type { AdminMatch } from "../data/adminLogic";
import { carrilPhase, phaseWord, stationLabel, stationOf, stationsOf, stepStation, type CarrilInput } from "./carril";

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 5, 17, 0);
const base: AdminMatch = { id: "m3", seasonId: "t1", rival: "Red Demons", date: NOW + 3 * 24 * H, status: "scheduled", home: true, venue: "CDM Palomeras", draft: false, published: true, jornada: 3, starters: [], bench: [] } as AdminMatch;
const review = { goalsFor: 0, goalsAgainst: 0, missingScorers: 0, cuadra: false };
const input = (m: Partial<AdminMatch>, r: Partial<CarrilInput["review"]> = {}, extra: Partial<CarrilInput> = {}): CarrilInput => ({ match: { ...base, ...m } as AdminMatch, now: NOW, review: { ...review, ...r }, ...extra });
const words = (i: CarrilInput) => Object.fromEntries(stationsOf(i).map((s) => [s.id, `${s.state} · ${s.word}`]));

describe("the carril", () => {
  it("six stations in order, each with its address", () => {
    const st = stationsOf(input({}));
    expect(st.map((s) => s.name)).toEqual(["Convocatoria", "Datos", "La mesa", "Acta", "Publicar", "Después"]);
    expect(st.map((s) => s.path)).toEqual(["convocatoria", "datos", "en-juego", "acta", "publicar", "despues"].map((s) => `/admin/partidos/m3/${s}`));
  });
  it("before the match: the convocatoria is yours until it goes, the rest waits", () => {
    expect(words(input({ starters: ["a", "b"], bench: ["c"] }))).toMatchObject({
      convocatoria: "toca · Sin mandar · 3 colgados",
      datos: expect.stringMatching(/^hecho · \S+ \d+ \S+ · \d\d:\d\d$/),
      "en-juego": "luego · Sin anotador",
      acta: "luego · Después del partido",
      publicar: "luego · Cuando cuadre",
      despues: "luego · MVP, notas, caja",
    });
    // sent, with answers: done, in words; changed since: yours again
    expect(words(input({ convocatoriaNotifiedAt: NOW - H, convocatoriaAt: NOW - 2 * H }, {}, { rsvp: { yes: 9, maybe: 2, no: 1, none: 4 } })).convocatoria).toBe("hecho · 9 vienen · 4 sin responder");
    expect(words(input({ convocatoriaNotifiedAt: NOW - 2 * H, convocatoriaAt: NOW - H })).convocatoria).toBe("toca · Ha cambiado: avisa otra vez");
  });
  it("what the match lacks is yours in Datos; la mesa asks for its anotador three days before", () => {
    expect(words(input({ venue: "" })).datos).toBe("toca · Falta el campo");
    expect(words(input({ date: NOW + 2 * 24 * H }))["en-juego"]).toBe("toca · Sin anotador");
    expect(words(input({ date: NOW + 2 * 24 * H, mesa: { name: "Jorge", since: NOW } }))["en-juego"]).toBe("luego · Anota Jorge");
  });
  it("played, not published: the acta is yours, publishing once it adds up", () => {
    // (the acta being written is a draft over the calendar's scheduled copy)
    const played = { date: NOW - 4 * H, status: "finished", draft: true } as Partial<AdminMatch>;
    expect(words(input(played, { goalsFor: 3, goalsAgainst: 2, missingScorers: 1 }))).toMatchObject({ acta: "toca · Falta 1 goleador", publicar: "luego · Antes, el acta" });
    expect(words(input(played, { goalsFor: 3, goalsAgainst: 2, cuadra: true }))).toMatchObject({ acta: "toca · Cuadra", publicar: "toca · Lista" });
  });
  it("a match that never reached la mesa asks «¿Se jugó?», never a 0–0 nobody wrote (B-HOY-11)", () => {
    const m = { date: NOW - 5 * 24 * H, status: "scheduled", events: [] } as Partial<AdminMatch>;
    expect(carrilPhase({ ...base, ...m } as AdminMatch, NOW)).toBe("pendiente");
    const w = words(input(m));
    expect(w.acta).toBe("toca · ¿Se jugó?");
    expect(w["en-juego"]).toBe("hecho · No llegó a la mesa");
    expect(Object.values(w).join(" ")).not.toMatch(/0–0|empate/);
    expect(stationOf("pendiente")).toBe("acta");
  });
  it("published: done in words; a correction in a draft is yours again, not «final sin publicar» (B-HOY-07)", () => {
    const pub = { date: NOW - 30 * H, status: "finished", published: true, goalsFor: 1, goalsAgainst: 8 } as Partial<AdminMatch>;
    expect(words(input(pub, { goalsFor: 1, goalsAgainst: 8, cuadra: true }))).toMatchObject({ acta: "hecho · 1–8 · derrota", publicar: "hecho · En la web", despues: "hecho · Al día" });
    const fix = { ...pub, draft: true } as Partial<AdminMatch>;
    expect(carrilPhase({ ...base, ...fix } as AdminMatch, NOW, false, true)).toBe("publicado");
    expect(phaseWord("publicado", { published: true, draft: true })).toBe("Publicado · con una corrección en borrador");
    expect(words(input(fix, { cuadra: true }, { publishedFinal: true }))).toMatchObject({ acta: "toca · Corrección en borrador", publicar: "toca · La web cuenta la anterior" });
  });
  it("aplazado or cancelado: Datos says so and is where the match opens", () => {
    expect(words(input({ status: "postponed" })).datos).toBe("toca · Aplazado");
    expect(stationOf(carrilPhase({ ...base, status: "cancelled" } as AdminMatch, NOW))).toBe("datos");
  });
  it("each station names itself whole for a screen reader; ← → walk them, stopping at the ends", () => {
    expect(stationLabel(stationsOf(input({}))[0])).toBe("1 de 6 · Convocatoria: Sin mandar · te toca");
    expect(stepStation("convocatoria", "ArrowRight")).toBe("datos");
    expect(stepStation("convocatoria", "ArrowLeft")).toBeNull();
    expect(stepStation("despues", "ArrowRight")).toBeNull();
  });
});
