import { describe, expect, it } from "vitest";
import { matchdayOf, type MatchdayPhase } from "../../lib/derived/matchday";
import { boardFace, boardMessage, figuresOf, heroCopy, matchViewAt, niceName, projectStandings, snapsOf, type CopyCtx } from "./inicioModel";
import { HOUR, KO, MIN, SCENES, SEVEN, nameOf } from "./inicio.fixtures";

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
});

describe("the club scoreboard", () => {
  it("counts down before, shows the minute live, «Final» and «acta lista» after, the next one in después", () => {
    expect(boardFace(scene("antes").day, scene("antes").view, SCENES.antes.now)).toMatchObject({ home: "PITI", away: "ORD", h: "–", a: "–", k: "Faltan", c: "2:00:00" });
    expect(boardFace(scene("antes").day, scene("antes").view, SCENES.antes.now).label).toMatch(/faltan 2 h y 0 min/);
    expect(boardFace(scene("pitido").day, scene("pitido").view, SCENES.pitido.now)).toMatchObject({ h: "0", a: "0", k: "Pendiente" });
    expect(boardFace(scene("directo1").day, scene("directo1").view, SCENES.directo1.now)).toMatchObject({ h: "2", a: "1", k: "1ª parte", c: "23′" });
    expect(boardFace(scene("final").day, scene("final").view, SCENES.final.now)).toMatchObject({ h: "3", a: "1", k: "Final" });
    expect(boardFace(scene("acta").day, scene("acta").view, SCENES.acta.now)).toMatchObject({ h: "3", a: "1", c: "acta lista" });
    expect(boardFace(scene("despues").day, scene("despues").view, SCENES.despues.now)).toMatchObject({ away: "PIT", k: "J2, domingo", c: "14:00" });
  });

  it("the boards' message: gold for our goal, the rival's colours for theirs", () => {
    expect(boardMessage(scene("directo1").ctx)).toEqual({ text: `Gol de Adrián T.C.: ${S(2, 1)}`, kind: "gold" });
    expect(boardMessage(scene("antes").ctx)).toEqual({ text: "El siete ya está en el césped", kind: "navy" });
  });
});

describe("«Arrastra el sol»: the match at any minute", () => {
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
  it("snaps at the whistle, half-time and the final, from the clock's stamps", () => {
    const s = snapsOf(day.match!);
    expect(s.pitido).toBeGreaterThan(KO);
    expect(s.descanso).toBe(KO + 26 * MIN);
    expect(s.final).toBe(KO + 61 * MIN);
  });
});

describe("the pitch", () => {
  it("the seven before the match, «tú» on the viewer; the huddle at half-time; the MVP alone after the vote", () => {
    const a = scene("antes");
    const seven = figuresOf({ day: a.day, view: a.view, seven: SEVEN, nameOf, numOf: () => "", me: "jordi", goalBy: null, mvpId: null });
    expect(seven).toHaveLength(7);
    expect(seven.find((f) => f.id === "jordi")?.tag).toBe("tu");
    const d = scene("descanso");
    expect(figuresOf({ day: d.day, view: d.view, seven: SEVEN, nameOf, numOf: () => "", me: null, goalBy: null, mvpId: null }).every((f) => f.huddle)).toBe(true);
    const z = scene("despues");
    expect(figuresOf({ day: z.day, view: z.view, seven: SEVEN, nameOf, numOf: () => "", me: null, goalBy: null, mvpId: "alcides" })).toEqual([expect.objectContaining({ id: "alcides", tag: "mvp" })]);
  });
});

describe("the season", () => {
  it("«Si acaba así»: the live score moves us and the rival", () => {
    const rows = [
      { team: "Entrepibas F.C.", pj: 0, gf: 0, gc: 0, pts: 0, isUs: false },
      { team: "Manchester Piti", pj: 0, gf: 0, gc: 0, pts: 0, isUs: true },
      { team: "Orduña FC", pj: 0, gf: 0, gc: 0, pts: 0, isUs: false },
    ];
    const t = projectStandings(rows, { rival: "Orduña fc", gf: 2, ga: 1 });
    expect(t[0]).toMatchObject({ team: "Manchester Piti", pts: 3, projected: true, us: true });
    expect(t.at(-1)).toMatchObject({ team: "Orduña FC", pts: 0, projected: true });
  });
  it("names in capitals read as names", () => {
    expect(niceName("ADRIÁN T.C.")).toBe("Adrián T.C.");
    expect(niceName("Jordi")).toBe("Jordi");
  });
});
