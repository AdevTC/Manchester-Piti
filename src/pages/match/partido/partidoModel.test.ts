import { describe, expect, it } from "vitest";
import { asiOf, atVenue, blocksTitle, closesWords, dayPlan, firmaGoals, firmaOf, goalBlocks, halvesOf, headOf, icsWithDescription, meetTimeOf, mvpView, notifyLabel, offOf, rivalShort, sevenLine } from "./partidoModel";
import { resultWords, type Play } from "./model";

// J1: Sunday 18 October 2026, 19:00 in Madrid (17:00 UTC)
const KICK = Date.UTC(2026, 9, 18, 17, 0);
const MIN = 60_000;
const play = (id: string, m: number, k: Play["k"]): Play => ({ id, m, k, side: k === "rival" || k === "tarjetaRival" ? "them" : "us", title: id, sub: "" });
const R = resultWords({ us: 1, them: 8 }, { us: 0, them: 5 });

describe("partidoModel · words", () => {
  it("names the rival short and the venue in running text", () => {
    expect(rivalShort("Orduña fc")).toBe("Orduña");
    expect(rivalShort("Entrepibas F.C.")).toBe("Entrepibas");
    expect(atVenue("CDM Palomeras")).toBe("en el CDM Palomeras");
    expect(atVenue("Leganés")).toBe("en Leganés");
  });

  it("titles the screen by moment", () => {
    const o = { kick: KICK, venue: "CDM Palomeras", rival: "Orduña fc", home: true, result: R, mesa: null, cancelled: false, postponedTo: null };
    expect(headOf("antes", o)).toEqual({ h: "El plan del día", sub: "Domingo 18 de octubre, en el CDM Palomeras" });
    expect(headOf("descanso", o).h).toBe("Descanso, 0–5");
    expect(headOf("final", o).h).toBe("Final, 1–8");
    expect(headOf("acta", { ...o, mesa: "Illescas" }).sub).toBe("Publicada por Illescas desde la mesa");
    expect(headOf("aplazado", o)).toEqual({ h: "Aplazado", sub: "Contra Orduña fc, en casa" });
    expect(headOf("pendiente", { ...o, home: false }).sub).toBe("En casa de Orduña fc");
  });
});

describe("partidoModel · the day hour by hour", () => {
  it("reads the quedada's time from the meeting note, else half an hour before", () => {
    expect(meetTimeOf("En la puerta del CDM a las 18:15.", KICK)).toBe(KICK - 45 * MIN);
    expect(meetTimeOf("Quedamos 18.40", KICK)).toBe(KICK - 20 * MIN);
    expect(meetTimeOf("Trae las dos camisetas", KICK)).toBe(KICK - 30 * MIN);
    // a time after the kick-off, or too early, is not the quedada
    expect(meetTimeOf("Cena a las 21:30", KICK)).toBe(KICK - 30 * MIN);
    expect(meetTimeOf("A las 09:00", KICK)).toBe(KICK - 30 * MIN);
  });

  it("lists the quedada (members), the whistle, the floodlights and the final in order", () => {
    const plan = dayPlan({ kick: KICK, duration: 50, member: true, meet: KICK - 30 * MIN, meetNote: "", mesa: "Illescas", whistle: false });
    expect(plan.map((s) => s.t)).toEqual(["Quedada", "Pitido inicial", "Encienden los focos", "Final"]);
    expect(plan[0]).toMatchObject({ h: "18:30", d: "Media hora antes del pitido." });
    expect(plan[1]).toMatchObject({ h: "19:00", d: "50 minutos de fútbol 7. Lo anota Illescas desde la mesa.", cls: "is-key" });
    expect(plan[2].h).toMatch(/^19:[01]\d$/);
    expect(plan[2].d).toMatch(/^El sol se pone a las 19:\d\d: la segunda parte se juega con luz artificial\.$/);
    expect(plan[3]).toMatchObject({ h: "19:50", t: "Final" });
  });

  it("leaves the quedada out for a fan and marks the whistle when it is now", () => {
    const plan = dayPlan({ kick: KICK, duration: 50, member: false, meet: KICK - 30 * MIN, meetNote: "", mesa: null, whistle: true });
    expect(plan[0]).toMatchObject({ t: "Pitido inicial", d: "50 minutos de fútbol 7.", cls: "is-key is-now" });
  });

  it("drops the floodlights of a morning match", () => {
    const morning = Date.UTC(2026, 9, 18, 9, 0);
    expect(dayPlan({ kick: morning, duration: 50, member: false, meet: morning, meetNote: "", mesa: null, whistle: false }).map((s) => s.t)).toEqual(["Pitido inicial", "Final"]);
  });

  it("words the published seven with its captain", () => {
    expect(sevenLine({ published: true, system: "3-2-1", captain: "a", captainName: "Adrián T.C.", captainCode: "MC" })).toBe("El siete ya está publicado: 3-2-1, con Adrián T.C., el capitán, de mediocentro.");
    expect(sevenLine({ published: true, system: "3-2-1", captain: null, captainName: "", captainCode: null })).toBe("El siete ya está publicado: 3-2-1.");
    expect(sevenLine({ published: false, system: "3-2-1", captain: null, captainName: "", captainCode: null })).toBeNull();
  });
});

describe("partidoModel · the goals by blocks and halves", () => {
  const plays = [play("a", 2, "rival"), play("b", 10, "rival"), play("c", 11, "rival"), play("d", 29, "rival"), play("e", 43, "gol"), play("f", 49, "rival"), play("g", 51, "rival")];
  it("counts each block of ten up to the minute, the stoppage in the last", () => {
    const b = goalBlocks(plays, 50, 50, "Orduña fc");
    expect(b.map((x) => [x.lab, x.us, x.them])).toEqual([
      ["0–10′", 0, 2],
      ["10–20′", 0, 1],
      ["20–30′", 0, 1],
      ["30–40′", 0, 0],
      ["40–50′", 1, 1],
    ]);
    expect(b[0]).toMatchObject({ themH: 100, usH: 0, later: false, aria: "Del 0 al 10: 0 del Piti y 2 de Orduña fc" });
    const at23 = goalBlocks(plays, 23, 50, "Orduña fc");
    expect(at23.map((x) => x.later)).toEqual([false, false, false, true, true]);
    expect(at23[2].them).toBe(0);
  });
  it("splits the halves once the second has started", () => {
    expect(halvesOf(plays, 23, 50)).toEqual([{ t: "1ª parte", s: "0–3" }]);
    expect(halvesOf(plays, 50, 50)).toEqual([
      { t: "1ª parte", s: "0–3" },
      { t: "2ª parte", s: "1–2" },
    ]);
    expect(blocksTitle(23, 50)).toBe("Los goles hasta el 23′, de diez en diez");
    expect(blocksTitle(50, 50)).toBe("Los goles, de diez en diez");
  });
});

describe("partidoModel · si acaba así", () => {
  it("speaks of points until the league publishes a table", () => {
    expect(asiOf({ fase: "primera", us: 0, them: 5, m: 23, table: null })).toEqual({
      k: "Si acaba así",
      t: "Sin puntos esta vez",
      sub: "La liga aún no ha publicado la clasificación: los puntos cuentan en cuanto la suba.",
      go: "Ver las cifras del partido",
    });
    expect(asiOf({ fase: "final", us: 2, them: 2, m: 50, table: null })).toMatchObject({ k: "Si el acta lo confirma", t: "Un punto" });
  });
  it("speaks of the table when there is one", () => {
    expect(asiOf({ fase: "segunda", us: 3, them: 1, m: 36, table: { position: 1 } })).toMatchObject({ t: "Dormimos líderes", sub: "Con el 3–1 del minuto 36: 1º en la tabla.", go: "Ver la tabla, si acaba así" });
    expect(asiOf({ fase: "segunda", us: 3, them: 1, m: 36, table: { position: 4 } }).t).toBe("Tres puntos");
  });
});

describe("partidoModel · the MVP", () => {
  const nameOf = (id: string) => ({ a: "Alcides", b: "Kevin" })[id] ?? id;
  const NOW = Date.UTC(2026, 9, 21, 10, 0); // Wednesday
  const CLOSES = Date.UTC(2026, 9, 23, 21, 54); // Friday 23:54 in Madrid
  const base = { member: true, jornada: 1, winners: [], counts: {}, total: 5, eligible: 7, closesAt: CLOSES, now: NOW, nameOf };
  it("words when the vote closes in club time", () => {
    expect(closesWords(CLOSES, NOW)).toBe("el viernes a las 23:54");
    expect(closesWords(CLOSES, CLOSES - 3600_000)).toBe("hoy a las 23:54");
    expect(closesWords(CLOSES, CLOSES - 86_400_000)).toBe("mañana a las 23:54");
    expect(closesWords(CLOSES, NOW - 10 * 86_400_000)).toBe("el 23 de octubre a las 23:54");
  });
  it("tells the open vote's turnout", () => {
    expect(mvpView({ ...base, fase: "acta" })).toMatchObject({ k: "El MVP, votándose", line: "Se vota hasta el viernes a las 23:54. Ya han votado 5 de 7; el recuento sale al cerrar.", vote: true, decided: false });
    expect(mvpView({ ...base, fase: "acta", member: false })).toMatchObject({ line: "El vestuario vota al MVP hasta el viernes a las 23:54: ya han votado 5 de 7.", vote: false });
  });
  it("crowns the winner once closed, or waits for the count", () => {
    expect(mvpView({ ...base, fase: "despues", winners: ["a"], counts: { a: 3, b: 2 } })).toMatchObject({ decided: true, k: "MVP de la J1", line: "Alcides, con 3 de 5 votos. Lo eligió el vestuario." });
    expect(mvpView({ ...base, fase: "despues", winners: ["a", "b"], counts: { a: 2, b: 2 } }).line).toBe("Alcides y Kevin, con 2 de 5 votos cada uno. Lo eligió el vestuario.");
    expect(mvpView({ ...base, fase: "despues" }).line).toBe("La votación cerró con 5 de 7 votos: el MVP sale cuando se publique el recuento.");
  });
});

describe("partidoModel · the signature", () => {
  it("draws a closed path and a dot per goal", () => {
    const pulse = Array.from({ length: 51 }, (_, i) => (i % 10) - 5);
    const f = firmaOf(pulse, [play("a", 0, "gol"), play("b", 25, "rival"), play("c", 30, "cambio")], 50);
    expect(f.d.startsWith("M80.0 ")).toBe(true);
    expect(f.d.endsWith(" Z")).toBe(true);
    expect(f.dots).toHaveLength(2);
    // the first goal on top, out of the ring; theirs at the break, at the bottom, in
    expect(f.dots[0]).toEqual({ x: "80.0", y: "21.0", them: false });
    expect(Number(f.dots[1].y)).toBeGreaterThan(80);
    expect(f.dots[1].them).toBe(true);
    expect(firmaGoals(1, 8)).toBe("un gol nuestro y ocho suyos");
    expect(firmaGoals(3, 1)).toBe("tres goles nuestros y uno suyo");
  });
});

describe("partidoModel · aplazado and pendiente", () => {
  it("explains a postponement without a new date, and offers the notice", () => {
    const o = offOf("aplazado", { reason: "El CDM cerró el campo por un torneo de base", mesa: false, cancelled: false, postponedTo: null });
    expect(o.big).toBe("Sin fecha nueva todavía");
    expect(o.d).toBe("El CDM cerró el campo por un torneo de base. La liga pondrá la fecha y te avisamos en cuanto la haya.");
    expect(o.facts).toHaveLength(3);
    expect(o).toMatchObject({ notify: true, mesa: false });
    expect(notifyLabel("aplazado", false)).toBe("Avísame cuando haya fecha");
    expect(notifyLabel("pendiente", true)).toBe("Te avisaremos del acta");
  });
  it("sends la mesa to publish the acta, everyone else to the notice", () => {
    const mesa = offOf("pendiente", { reason: "", mesa: true, cancelled: false, postponedTo: null });
    expect(mesa).toMatchObject({ big: "El resultado llega con el acta", notify: false, mesa: true });
    expect(mesa.facts.at(-1)?.icon).toBe("mesa");
    expect(offOf("pendiente", { reason: "", mesa: false, cancelled: false, postponedTo: null })).toMatchObject({ notify: true, mesa: false });
  });
});

describe("partidoModel · the calendar", () => {
  it("adds the quedada to an .ics event, escaped", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Manchester Piti vs Orduña fc", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    expect(icsWithDescription(ics, "Quedada a las 18:30: en la puerta, con las dos camisetas").split("\r\n")[3]).toBe("DESCRIPTION:Quedada a las 18:30: en la puerta\\, con las dos camisetas");
    expect(icsWithDescription(ics, "")).toBe(ics);
  });
});
