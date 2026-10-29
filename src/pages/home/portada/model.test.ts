import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../../lib/clubData";
import { capOf, heroOf, lensOf, movOf, ribbon, tardeOf, type Ctx, type Fase, type Fixture, type Quien } from "./model";
import { doorsOf, playRows, tasksOf, type TasksIn } from "./bands";
import { campoOf, jugadasOf } from "./screenModel";
import { onPitch, pulseOf, type LedgerRow, type Partido, type Play } from "./partido";
import { SCORE_DASH } from "../../../lib/derived/words";

const N = (id: string) => ({ jordi: "Jordi", alcides: "Alcides", evans: "Evans", fer: "Fer", erik: "Erik", adrian: "Adrián T.C." })[id] ?? id;
const play = (id: string, m: number, k: Play["k"], who: string | null, extra: Partial<Play> = {}): Play => ({ id, m, k, side: k === "rival" ? "them" : "us", who, out: null, assist: null, title: k === "gol" ? `Gol de ${N(who ?? "")}` : k === "rival" ? "Gol de Orduña fc" : `Entra ${N(who ?? "")}`, sub: "", ...extra });
const PLAYS: Play[] = [play("p1", 2, "rival", null), play("p2", 10, "cambio", "erik", { out: "fer" }), play("p3", 10, "cambio", "jordi", { out: "evans" }), play("p4", 43, "gol", "alcides")];
const row = (st: [number, number][], ex: [number, string, 0 | 1][] = [], g = 0): LedgerRow => ({ min: st.reduce((t, [a, b]) => t + b - a, 0), st, ex, g, a: 0, sv: 0, pos: null });
const LEDGER: Record<string, LedgerRow> = {
  alcides: row([[0, 50]], [], 1),
  fer: row([[0, 10]], [[10, "erik", 0]]),
  erik: row([[10, 50]], [[10, "fer", 1]]),
  evans: row([[0, 10]], [[10, "jordi", 0]]),
  jordi: row([[10, 50]], [[10, "evans", 1]]),
};
const LINEUP = [
  { id: "evans", code: "POR", x: 50, y: 95 },
  { id: "fer", code: "LI", x: 18, y: 72 },
  { id: "alcides", code: "DC", x: 50, y: 22 },
];
const match = { id: "j1", starters: ["evans", "fer", "alcides"], bench: ["erik", "jordi"], notCalled: ["andia"], system: "3-2-1" } as unknown as ClubMatch;
const P: Partido = { match, duration: 50, lineup: LINEUP, plays: PLAYS, ledger: LEDGER, onAt: onPitch(LINEUP, LEDGER, 50), pulse: pulseOf(PLAYS, 50) };
const fx = (o: Partial<Fixture>): Fixture => ({ matchId: "j1", j: 1, rival: "Orduña fc", code: "OR", home: true, kickoff: 0, dayLong: "Domingo 18 de octubre", dow: "domingo", day: 18, time: "19:00", competition: "Liga", ...o });
const ctx = (fase: Fase, quien: Quien = "jugador", o: Partial<Ctx> = {}): Ctx => {
  const edge = fase === "directo" ? 30 : fase === "descanso" ? 25 : 50;
  return {
    fase,
    quien,
    me: quien === "jugador" ? "jordi" : null,
    meName: quien === "socio" ? "Marta" : "Jordi",
    P,
    M: fx({}),
    N: fx({ matchId: "j2", j: 2, rival: "Pitutis", code: "PI", home: false, dow: "domingo", day: 25, time: "14:00", dayLong: "Domingo 25 de octubre" }),
    m: edge,
    edge,
    score: fase === "directo" ? { us: 0, them: 1 } : { us: 1, them: 1 },
    names: { name: N, short: (id) => N(id).toLocaleUpperCase("es"), num: () => "7" },
    now: 0,
    sunset: "19:29",
    lights: "19:10",
    lightsFromStart: false,
    nextLights: "dia",
    nextLeft: "Faltan 3 días",
    kickLeft: "2 h 14 min",
    weather: null,
    estreno: true,
    mvp: { open: fase === "acta", closes: "el martes a las 21:00", total: 5, eligible: 7 },
    postponed: "",
    todayLine: "Jueves 22 de octubre",
    porra: null,
    rsvp: null,
    mvpVoted: null,
    alerts: false,
    pip: false,
    matchHref: "j1",
    nextHref: "j2",
    ...o,
  };
};
const NO_TASKS: TasksIn = { rsvp: null, porraOpen: false, caja: null, turno: null, poll: null, mesaMine: false };

describe("La portada: the lens", () => {
  it("between matches counts down to the next one and keeps the last in «El último»", () => {
    const c = ctx("semana");
    const l = lensOf(c);
    expect(l.kicker).toBe("J2 · Domingo 25 de octubre · Liga");
    expect(l.face).toBe("time");
    expect(l.status).toBe("En casa de Pitutis. Faltan 3 días");
    const mov = movOf(c, null, false);
    expect(mov.kind).toBe("last");
    expect(mov.last?.title).toBe("Empatamos ante Orduña fc");
  });

  it("live: the clock, the half, and the minute the moviola went back to", () => {
    const c = ctx("directo");
    expect(lensOf(c)).toMatchObject({ face: "score", live: true, clock: "30′", status: "de la segunda parte" });
    const back = ctx("directo", "jugador", { m: 12 });
    expect(lensOf(back)).toMatchObject({ live: false, status: "en directo; estás viendo el minuto 12" });
    expect(movOf(back, null, false)).toMatchObject({ backable: true, backLabel: "Volver al directo" });
  });

  it("the moviola marks goals and cards, folds the changes of a minute into one tick", () => {
    const mov = movOf(ctx("acta"), null, false);
    expect(mov.marks.map((k) => k.m)).toEqual([2, 43]);
    expect(mov.subs).toEqual([{ left: 20, n: 2, later: false }]);
    expect(mov.tip).toBe("Final");
  });

  it("the ribbon closes both halves on the axis", () => {
    const r = ribbon([0, 9, 0], 2, 2);
    expect(r.us.startsWith("M0 37")).toBe(true);
    expect(r.us.endsWith("Z")).toBe(true);
  });

  it("«La tarde» puts the sun, the match's window and «Ahora»", () => {
    const t = tardeOf({ koMin: 19 * 60, endMin: 19 * 60 + 50, nowMin: 16 * 60 + 46, sunset: "19:29", lights: "19:10", meet: "18:30", pitido: false, showMeet: true });
    expect(t.marks[0]).toMatchObject({ h: "16:46", t: "Ahora" });
    expect(t.winL).toBeCloseTo(62.5, 1);
    expect(t.top.map((x) => x.t)).toContain("Quedada");
  });
});

describe("La portada: the headline and your line", () => {
  it("the acta of the first match, with the vote", () => {
    const h = heroOf(ctx("acta"));
    expect(h.h1).toBe("Empate a uno en el estreno");
    expect(h.me).toBe("Jordi, jugaste 40 minutos en un tramo. Vota al MVP hasta el martes a las 21:00.");
    expect(h.acts.map((a) => a.t)).toEqual(["Leer el acta", "Compartir el cartel"]);
  });

  it("live: who scored last, the scorer's minute", () => {
    const h = heroOf(ctx("directo", "socio", { m: 30 }));
    expect(h.h1).toBe("Marca Orduña fc");
    expect(h.acts.map((a) => a.id)).toEqual(["abrir", "pip", "alerts"]);
  });

  it("the anotador opens la mesa first", () => {
    const h = heroOf(ctx("antes", "anotador"));
    expect(h.acts[0]).toMatchObject({ id: "mesa", t: "Abrir la mesa", pri: true });
    expect(h.h1).toBe("Hoy debuta el Piti");
  });

  it("the capsule of the screens says the score and the minute", () => {
    expect(capOf(ctx("directo", "jugador", { m: 12 }))).toMatchObject({ score: "0⁠–⁠1", when: "Viendo el 12′", live: false });
    expect(capOf(ctx("aplazado"))).toMatchObject({ score: "Aplazado", word: true });
  });

  it("away, the board puts the home side first: their goals lead the score and its label, our crest goes right", () => {
    const away = ctx("directo", "jugador", { m: 12, M: fx({ home: false }) });
    expect(capOf(away)).toMatchObject({ score: `1${SCORE_DASH}0`, home: false, aria: "Volver a Inicio: Orduña fc 1, Manchester Piti 0" });
    const l = lensOf(away);
    expect(l).toMatchObject({ home: false, us: 0, them: 1 });
    expect(l.scoreLabel).toBe("Orduña fc 1, Manchester Piti 0, en el minuto 12");
    expect(lensOf(ctx("directo", "jugador", { m: 12 })).scoreLabel).toBe("Manchester Piti 0, Orduña fc 1, en el minuto 12");
  });
});

describe("La portada: the bands", () => {
  it("a fan gets «Desde la grada»: avisos, pedir entrar, the shirt", () => {
    const t = tasksOf(ctx("antes", "fan"), NO_TASKS);
    expect(t.h).toBe("Desde la grada");
    expect(t.list.map((x) => x.key)).toEqual(["alerts", "entrar", "camiseta"]);
    expect(t.door).toBe(false);
  });

  it("a player before the whistle: ¿vas?, the porra; and what comes next fills the row", () => {
    const t = tasksOf(ctx("antes"), { ...NO_TASKS, rsvp: { value: null, yes: 7, maybe: 2, answered: 12, called: 16, busy: false, error: "" }, porraOpen: true });
    expect(t.list.map((x) => x.key)).toEqual(["rsvp", "porra"]);
    expect(t.pending).toBe(2);
    expect(t.note?.t).toBe("Lo siguiente, a las 19:00");
    expect(t.layout).toBe("tk-3");
  });

  it("the plays fold a minute's changes: «Dos cambios a la vez»", () => {
    const rows = playRows(PLAYS, N);
    expect(rows.map((r) => r.title)).toEqual(["Gol de Orduña fc", "Dos cambios a la vez", "Gol de Alcides"]);
    expect(rows[1].pairs).toEqual([
      { inn: "Erik", innId: "erik", out: "Fer" },
      { inn: "Jordi", innId: "jordi", out: "Evans" },
    ]);
  });

  it("the Partidos door paints the jornadas, the night's one current", () => {
    const tasks = tasksOf(ctx("acta"), NO_TASKS);
    const d = doorsOf(ctx("acta"), tasks, {
      jornadas: [
        { id: "j1", j: 1, rival: "Orduña fc", gf: 1, ga: 1, res: "E", off: false, live: false, sky: "flood", dayNum: "18" },
        { id: "j2", j: 2, rival: "Pitutis", gf: null, ga: null, res: "", off: false, live: false, sky: "day", dayNum: "25" },
      ],
      total: 2,
      squadN: 16,
      rail: [],
      standings: null,
      leader: { name: "Alcides", goals: 1 },
      birthday: null,
      vitrina: "La vitrina, por estrenar",
      mine: null,
    });
    expect(d.jornadas[0]).toMatchObject({ top: "J1", bot: "E", cls: expect.stringContaining("is-cur") });
    expect(d.big).toBe("1");
    expect(d.bigL).toBe("gol en la temporada: Alcides");
  });
});

describe("Los minutos and Jugada a jugada", () => {
  it("one row per player, the most minutes first, his stints as bars and his changes", () => {
    const v = campoOf(ctx("acta"), { open: "jordi", captain: "alcides", system: "3-2-1", meet: null, coverage: null, evening: true });
    expect(v.rows.map((r) => r.id)).toEqual(["alcides", "erik", "jordi", "evans", "fer"]);
    const j = v.rows.find((r) => r.id === "jordi");
    expect(j).toMatchObject({ minText: "40′", open: true, me: true });
    expect(j?.ex).toEqual([{ m: 10, dir: "Entra", with: "por Evans", withId: "evans", cls: "is-in" }]);
    expect(v.spots.find((s) => s.id === "erik")).toMatchObject({ left: 18 });
  });

  it("before the whistle: «El siete de esta noche» only for an evening kick-off", () => {
    const i = { open: null, captain: null, system: "3-2-1", meet: null, coverage: null };
    expect(campoOf(ctx("antes"), { ...i, evening: true }).h).toBe("El siete de esta noche");
    expect(campoOf(ctx("antes"), { ...i, evening: false }).h).toBe("El siete de hoy");
  });

  it("the two halves, newest first, filtered", () => {
    const v = jugadasOf(ctx("acta"), 1);
    expect(v.halves.map((h) => [h.t, h.n])).toEqual([
      ["Segunda parte", "1 jugada"],
      ["Primera parte", "1 jugada"],
    ]);
  });
});
