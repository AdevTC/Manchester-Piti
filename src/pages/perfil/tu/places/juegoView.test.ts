import { describe, expect, it } from "vitest";
import { buildMe } from "../me";
import { info, input, PLAYED } from "./juego/fixture";
import { baseMarks, canSend, caraHref, compareRows, juegoTitle, ladders, marksText, nudgeText, partnerView, pitchSpots, playedText, proposalStatus, rankMeta, squadNumbers, tapSpot } from "./juegoView";

const me = buildMe(input);
const squad = squadNumbers(input);
const nameOf = (id: string) => squad.find((s) => s.id === id)?.name ?? "";


describe("juegoView: the pitch and the proposal (today's Posiciones)", () => {
  it("marks the ficha, the minutes where he played, and says it in the aria", () => {
    const spots = pitchSpots(baseMarks(info()), PLAYED, true);
    expect(spots).toHaveLength(13);
    const ld = spots.find((s) => s.code === "LD");
    expect(ld).toMatchObject({ mark: "main", min: 40, x: 85, y: 66 });
    expect(ld?.aria).toBe("Lateral derecho, tu preferida, has jugado 40 minutos. Toca para cambiar");
    expect(spots.find((s) => s.code === "LI")?.mark).toBe("also");
    // out of season: the pitch is only looked at
    expect(pitchSpots(baseMarks(info()), PLAYED, false).find((s) => s.code === "POR")?.aria).toBe("Portero, sin marcar");
  });
  it("one tap ✓, two ★, three off", () => {
    let s = { main: "LD" as const, also: [] } as Parameters<typeof tapSpot>[0];
    s = tapSpot(s, "DC");
    expect(s).toEqual({ main: "LD", also: ["DC"] });
    s = tapSpot(s, "DC");
    expect(s).toEqual({ main: "DC", also: ["LD"] });
    s = tapSpot(s, "DC");
    expect(s).toEqual({ main: null, also: ["LD"] });
  });
  it("every state of the proposal, with «Ahora en tu ficha» once the captain answered", () => {
    expect(proposalStatus(info(), null, "Lateral derecho")).toMatchObject({ t: "Las de tu ficha", ficha: null });
    expect(proposalStatus(info(), { main: "DC", also: [] }, null).t).toBe("Cambios sin enviar");
    const pend = info({ state: "pendiente", proposal: { main: "MD", also: [] } });
    expect(baseMarks(pend)).toEqual({ main: "MD", also: [] });
    expect(proposalStatus(pend, null, null)).toMatchObject({ tone: "warn", t: "Enviada: pendiente de que el capitán la vea" });
    expect(proposalStatus(info({ state: "aprobada" }), null, null)).toMatchObject({ t: "El capitán aprobó tu propuesta", ficha: "Ahora en tu ficha: Lateral derecho ★, Lateral izquierdo." });
    expect(proposalStatus(info({ state: "ajustada" }), null, null).t).toBe("El capitán ajustó tu propuesta");
    expect(proposalStatus(info({ state: "rechazada" }), null, null)).toMatchObject({ t: "El capitán no aprobó tu propuesta", ficha: expect.stringContaining("Ahora en tu ficha") });
    expect(proposalStatus(info({ inSeason: false }), null, null).t).toBe("Tu ficha no está en esta temporada");
    expect(proposalStatus(info({ approved: { main: null, also: [] } }), null, "Defensa").d).toContain("Tu ficha dice defensa, sin puesto exacto");
  });
  it("«Enviar al capitán» only with valid changes, never out of season", () => {
    expect(canSend(info(), null)).toBe(false);
    expect(canSend(info(), { main: "LD", also: ["LI"] })).toBe(false);
    expect(canSend(info(), { main: "DC", also: [] })).toBe(true);
    expect(canSend(info({ inSeason: false }), { main: "DC", also: [] })).toBe(false);
    expect(canSend(info(), { main: null, also: [] })).toBe(false);
  });
  it("the title, the marks, «Dónde has jugado» and the nudge", () => {
    expect(juegoTitle({ main: "LD", also: [] }, null)).toBe("De lateral derecho, y donde haga falta");
    expect(juegoTitle({ main: null, also: [] }, null)).toBe("Dinos dónde juegas");
    expect(marksText({ main: "LD", also: ["LI", "ED"] })).toBe("Lateral derecho ★, Lateral izquierdo, Extremo derecho");
    expect(playedText(PLAYED)).toEqual({ line: "Lateral derecho: 40′.", note: "Según la pizarra oficial de tu partido. Con cambios continuos, cuenta el puesto que ocupaste más tiempo." });
    expect(playedText(null).line).toBe("Aún en ningún puesto.");
    expect(nudgeText(PLAYED, info(), { main: "DC", also: [] })).toBe("Has jugado de lateral derecho y no lo tienes puesto.");
    expect(nudgeText(PLAYED, info(), { main: "LD", also: [] })).toBeNull();
  });
});

describe("juegoView: his place in the squad, his partner and the comparison", () => {
  it("the squad's numbers, by dorsal, with first names", () => {
    expect(squad.map((s) => [s.name, s.num, s.minutos, s.partidos])).toEqual([
      ["Alcides", "7", 100, 2],
      ["Erik", "9", 50, 1],
      ["Kevin", "10", 60, 2],
      ["Jordi", "28", 40, 1],
    ]);
    expect(squad.find((s) => s.id === "jordi")?.nota).toBe(4.7);
  });
  it("ladders: a real place where he has a value, «aún a cero, como N más» otherwise, the leader named", () => {
    const l = Object.fromEntries(ladders(me.ranks, squad, nameOf).map((x) => [x.key, x]));
    expect(ladders(me.ranks, squad, nameOf).map((x) => x.key)).toEqual(["minutos", "nota", "partidos", "goles", "asistencias"]);
    expect(l.minutos).toMatchObject({ value: "40′ · 4.º", line: "Lidera Alcides, 100′ · 4 han jugado" });
    expect(l.minutos.slots).toEqual(["on", "on", "on", "me"]);
    expect(l.partidos.value).toBe("1 · 3.º");
    expect(l.partidos.line).toContain("empatado con 1 compañero");
    expect(l.goles).toMatchObject({ value: "—", line: "Aún a cero, como 2 más · lidera Alcides, 1", aria: "Goles: aún a cero" });
    expect(l.goles.slots).not.toContain("me");
    expect(l.asistencias.line).toBe("Aún a cero, como 2 más · lidera Kevin, 2");
    expect(l.nota.value).toBe("4,7 · 4.º");
  });
  it("the ladders' heading and the partner", () => {
    expect(rankMeta("Temporada 1", me.rows, 4)).toBe("Temporada 1, tras la J2 · los 4 de la plantilla");
    expect(partnerView(me.partner, nameOf)).toEqual({ n: "7", name: "Alcides", line: "40′ juntos en el campo · en 1 partido" });
    expect(partnerView(null, nameOf).name).toBe("Aún nadie");
  });
  it("three numbers side by side, who's ahead in words, and the cara a cara with both", () => {
    const jordi = squad.find((s) => s.id === "jordi");
    const kevin = squad.find((s) => s.id === "kevin");
    if (!jordi || !kevin) throw new Error("fixture");
    expect(compareRows(jordi, kevin)).toEqual([
      { label: "Partidos", mine: "1", his: "2", side: "him", ahead: "Kevin, por 1" },
      { label: "Goles · asistencias", mine: "0 · 0", his: "0 · 2", side: "him", ahead: "Kevin, por 2" },
      { label: "Nota media", mine: "4,7", his: "5,8", side: "him", ahead: "Kevin, por 1,1" },
    ]);
    expect(caraHref("jordi", "kevin")).toEqual({ to: "/plantilla/cara-a-cara", search: { a: "jordi", b: "kevin" } });
  });
});
