import { describe, expect, it } from "vitest";
import { matchdayOf, type MatchdayPhase } from "../../lib/derived/matchday";
import { heroCopy, matchViewAt, niceName, type CopyCtx } from "./inicioModel";
import { HOUR, KO, MIN, SCENES, nameOf } from "./inicio.fixtures";

const nice = (id: string) => niceName(nameOf(id));
function scene(phase: keyof typeof SCENES, opts: Partial<CopyCtx> = {}, scrub: number | null = null) {
  const { matches, now } = SCENES[phase];
  const day = matchdayOf(matches, "t1", now);
  const view = matchViewAt(day, now, scrub);
  const ctx: CopyCtx = { day, view, now, member: false, role: "aficionado", nameOf: nice, sevenPublished: true, weather: null, seasonName: "Temporada 1", squadSize: 16, mvp: null, estreno: true, ...opts };
  return { day, view, ctx, now };
}
/** The en dash of a score, with its word joiners. */
const S = (a: number, b: number) => `${a}⁠–⁠${b}`;

describe("the headline, phase by phase (data-driven)", () => {
  it.each<[keyof typeof SCENES, MatchdayPhase, string | RegExp]>([
    ["pretemporada", "pretemporada", "Palomeras ya espera"],
    ["semana", "semana", "El domingo, Orduña fc"],
    ["antes", "antes", "Orduña fc viene a Palomeras"],
    ["pitido", "pitido", "Todo listo en Palomeras"],
    ["directo1", "directo1", `Adrián T.C. pone el ${S(2, 1)}`],
    ["descanso", "descanso", `Descanso con ${S(2, 1)}`],
    ["directo2", "directo2", `Adrián T.C. pone el ${S(2, 1)}`],
    ["final", "final", `Ganamos ${S(3, 1)} el estreno`],
    ["acta", "acta", "Los ocho del estreno"],
    ["despues", "despues", `Ganamos ${S(3, 1)} el estreno`],
    ["aplazado", "aplazado", "Hoy no se juega"],
    ["pendiente", "pendiente", "Pendiente del acta"],
  ])("%s", (key, phase, h1) => {
    const { day, ctx } = scene(key);
    expect(day.phase).toBe(phase);
    expect(heroCopy(ctx).h1).toEqual(h1);
  });

  it("antes without the seven: it says it will come out on the pitch", () => {
    expect(heroCopy(scene("antes", { sevenPublished: false }).ctx).sub).toMatch(/El siete aún no está/);
    expect(heroCopy(scene("antes").ctx).sub).toMatch(/^El siete ya está en el césped/);
  });

  it("the acta's subline: members vote, fans are told the winner comes out here (never a tally)", () => {
    expect(heroCopy(scene("acta", { member: true }).ctx).sub).toMatch(/^Vota al MVP entre los que jugaron, hasta el martes a las/);
    const fan = heroCopy(scene("acta").ctx).sub;
    expect(fan).toMatch(/el ganador sale aquí/);
    expect(fan).not.toMatch(/\d+ votos?/);
  });

  it("después with the MVP decided: his name and the next match", () => {
    const c = heroCopy(scene("despues", { mvp: { id: "alcides", name: "Alcides", goals: 1 } }).ctx);
    expect(c.h1).toBe("Alcides, el primero");
    expect(c.sub).toMatch(/Un gol y MVP\. El domingo, a Moratalaz: Pitutis a las 14:00\./);
  });

  it("live: the kicker carries the half and the minute; the last play is the subline", () => {
    const c = heroCopy(scene("directo1").ctx);
    expect(c).toMatchObject({ kick: "En juego, 1ª parte, minuto 23", live: true });
    expect(c.sub).toBe("21′, gol de Adrián T.C., asistencia de Jordi.");
  });

  it("pendiente: a clock nobody started says no score anywhere (no «Empate a cero», no «la está cerrando la mesa»)", () => {
    const c = heroCopy(scene("pendiente").ctx);
    expect(c).toMatchObject({ kick: "Jornada 1, ante Orduña fc", h1: "Pendiente del acta", live: false });
    expect(c.sub).not.toMatch(/\d|cerrando/);
  });

  it("a name that ends in its own full stop gets no second one («Adrián T.C.», never «T.C..»)", () => {
    expect(heroCopy(scene("descanso").ctx).sub).toBe("Marcaron Alcides y Adrián T.C. La segunda parte, en unos minutos.");
    const final = heroCopy(scene("final", { nameOf: (x) => (x === "kevin" ? "Rafa J." : nice(x)) }).ctx).sub;
    expect(final).toMatch(/^Goles de Alcides, Adrián T\.C\. y Rafa J\. El acta llega/);
    expect(heroCopy(scene("despues").ctx).sub).not.toMatch(/\.\./);
  });
});

describe("the match at a minute", () => {
  const { day } = scene("final");
  it("scrubbed to the 11th minute: 1–1 and the first half", () => {
    const v = matchViewAt(day, SCENES.final.now, KO + 11 * MIN);
    expect(v).toMatchObject({ phase: "directo1", gf: 1, ga: 1, minute: 12, scrubbed: true });
  });
  it("at half-time, the break; before the kick-off, the countdown phase; after the whistle, the final", () => {
    expect(matchViewAt(day, SCENES.final.now, KO + 28 * MIN).phase).toBe("descanso");
    expect(matchViewAt(day, SCENES.final.now, KO - HOUR).phase).toBe("antes");
    expect(matchViewAt(day, SCENES.final.now, KO + 65 * MIN)).toMatchObject({ phase: "final", gf: 3, ga: 1 });
  });
  it("never past now: the future isn't known yet", () => {
    const live = scene("directo1");
    expect(matchViewAt(live.day, live.now, live.now + HOUR)).toMatchObject({ phase: "directo1", gf: 2, ga: 1 });
  });
});

describe("names", () => {
  it("names in capitals read as names", () => {
    expect(niceName("ADRIÁN T.C.")).toBe("Adrián T.C.");
    expect(niceName("Jordi")).toBe("Jordi");
  });
});
