import { describe, expect, it } from "vitest";
import type { StandingRow } from "../../../lib/standings";
import { resultWords } from "./model";
import {
  chipsOf,
  formLabel,
  formOf,
  headOf,
  leadersOf,
  noTableOf,
  recordAfter,
  rivalFacts,
  rivalLede,
  saveNoteOf,
  signed,
  tableView,
  vistazoOf,
  whenText,
  type Moment,
} from "./numerosModel";

const row = (team: string, pj: number, g: number, e: number, p: number, gf: number, gc: number, isUs = false, prevPos?: number): StandingRow => ({ team, pj, g, e, p, gf, gc, pts: g * 3 + e, isUs, ...(prevPos ? { prevPos } : {}) });
// after J1: Red Demons won 2–0, Pitutis and SQUIRTLES drew; we and Orduña fc still to play
const TABLE: StandingRow[] = [
  row("Red Demons", 1, 1, 0, 0, 2, 0),
  row("Pitutis", 1, 0, 1, 0, 1, 1),
  row("SQUIRTLES FC", 1, 0, 1, 0, 1, 1),
  row("Manchester Piti", 0, 0, 0, 0, 0, 0, true),
  row("Orduña fc", 0, 0, 0, 0, 0, 0),
  row("Entrepibas F.C.", 1, 0, 0, 1, 0, 2),
];
const MO = (o: Partial<Moment>): Moment => ({ pre: false, live: false, played: false, done: false, final: false, off: null, dragged: false, minute: 0, edge: 0, duration: 50, ...o });
const base = { rival: "Orduña fc", score: { us: 0, them: 0 }, pick: null, all: false, jornada: 2, tableJornada: 1, already: false, allZero: false } as const;
const R18 = resultWords({ us: 1, them: 8 }, { us: 0, them: 5 });

describe("tableView", () => {
  it("before the whistle: the table as it is, and a pick projects the board's example score", () => {
    const now = tableView(MO({ pre: true }), TABLE, base);
    expect(now.title).toBe("La clasificación");
    expect(now.sub).toBe("Como está, antes de la J2");
    expect(now.me?.pos).toBe(4);
    const e = tableView(MO({ pre: true }), TABLE, { ...base, pick: "E" });
    expect(e.title).toBe("Si empatamos");
    expect(e.sub).toBe("Con un 1–1, por ejemplo; los demás, sin jugar");
    // 1–1: level on points and difference with Pitutis and SQUIRTLES; the league's order breaks it
    expect(e.me).toMatchObject({ pts: 1, pos: 4 });
    const g = tableView(MO({ pre: true }), TABLE, { ...base, pick: "G" });
    const us = g.items.find((i) => i.kind === "row" && i.us);
    expect(us).toMatchObject({ pos: 2, mark: "sube al 2º", up: true, prov: false });
  });

  it("live: «Si acaba así» with the score of the moviola's minute, both rows of our match provisional", () => {
    const v = tableView(MO({ live: true, played: true, minute: 23, edge: 23 }), TABLE, { ...base, score: { us: 0, them: 6 } });
    expect(v.title).toBe("Si acaba así");
    expect(v.sub).toBe("Con el 0–6 del minuto 23; el resto de la J2, sin jugar");
    expect(v.provWord).toBe("Si acaba así");
    const rows = v.items.filter((i) => i.kind === "row");
    expect(rows.filter((r) => r.kind === "row" && r.prov).map((r) => r.kind === "row" && r.team)).toEqual(["Orduña fc", "Manchester Piti"]);
    expect(v.me).toMatchObject({ pos: 6, dg: -6 });
  });

  it("at the whistle without the acta: «Si el acta lo confirma» and «Falta el acta»", () => {
    const v = tableView(MO({ final: true, played: true, minute: 50, edge: 50 }), TABLE, { ...base, score: { us: 1, them: 8 } });
    expect(v.title).toBe("Si el acta lo confirma");
    expect(v.sub).toBe("Con el 1–8 final; el resto de la J2, sin jugar");
    expect(v.provWord).toBe("Falta el acta");
  });

  it("done: the table after the jornada, only our match's rows marked", () => {
    const after = [row("Orduña fc", 1, 1, 0, 0, 8, 1, false, 5), row("Red Demons", 2, 1, 0, 1, 2, 2, false, 1), row("Manchester Piti", 1, 0, 0, 1, 1, 8, true, 2)];
    const v = tableView(MO({ done: true, played: true, minute: 50, edge: 50 }), after, { ...base, tableJornada: 2 });
    expect(v.sub).toBe("Después de la J2");
    const marks = v.items.map((i) => (i.kind === "row" ? i.mark : ""));
    expect(marks).toEqual(["sube al 1º", "", "baja al 3º"]);
  });

  it("aplazado and pendiente: without our match", () => {
    expect(tableView(MO({ off: "aplazado" }), TABLE, base).sub).toBe("Sin nuestro partido: cuenta cuando se juegue");
    expect(tableView(MO({ off: "pendiente" }), TABLE, base).sub).toBe("Sin nuestro partido: cuenta con el acta");
  });

  it("a long league is focused (leader, us ±3, gaps) and comes whole on demand", () => {
    const long = Array.from({ length: 14 }, (_, i) => row(`T${i}`, 3, 3 - Math.min(3, Math.floor(i / 4)), 0, Math.min(3, Math.floor(i / 4)), 6 - i / 3, i / 3, i === 10));
    const f = tableView(MO({ pre: true }), long, { ...base, rival: "T3" });
    expect(f.hidden).toBeGreaterThan(0);
    expect(f.items.some((i) => i.kind === "gap")).toBe(true);
    expect(tableView(MO({ pre: true }), long, { ...base, rival: "T3", all: true }).items).toHaveLength(14);
  });
});

describe("chips and the head", () => {
  it("with a table, each outcome says where we sleep", () => {
    const [g, e, p] = chipsOf(TABLE, "Orduña fc", false, 4);
    expect(g).toMatchObject({ pos: "2º", line: "Dormimos 2º" });
    expect(e.pos).toBe("4º");
    // 0–1: level on points with Entrepibas (0–2), a better difference
    expect(p.pos).toBe("5º");
    expect(p.line).toBe("Dormimos 5º");
  });
  it("without one, the points (the board's words on the first jornada)", () => {
    expect(chipsOf(null, "Orduña fc", true, 5).map((c) => [c.pos, c.line])).toEqual([
      ["3 pts", "Tres puntos para empezar"],
      ["1 pt", "Un punto"],
      ["0 pts", "A cero, con cinco por jugar"],
    ]);
  });
  it("the head's line", () => {
    const rec = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    const o = { hasTable: false, place: null, pos: null, winLine: "", rec, result: R18, narrated: true, descanso: false };
    expect(headOf(MO({ pre: true }), o)).toEqual({ title: "El rival y lo que se juega", sub: "Primera vez contra ellos. La clasificación sale cuando la liga la publique." });
    expect(headOf(MO({ live: true, played: true, dragged: true, minute: 21, edge: 36 }), o).sub).toBe("En el minuto 21 (el directo va por el 36). Desde la mesa y el relato narrado.");
    expect(headOf(MO({ done: true, played: true, minute: 50, edge: 50 }), o).sub).toBe("Del acta. Perdimos 1–8.");
    expect(headOf(MO({ live: true, played: true, minute: 20, edge: 20 }), { ...o, hasTable: true, place: "1º con 3 puntos", pos: 1 }).sub).toBe("En directo, desde la mesa. Si acaba así, 1º con 3 puntos.");
    expect(headOf(MO({ off: "pendiente" }), o)).toEqual({ title: "Números", sub: "Pendiente del acta." });
  });
});

describe("no table, la forma, the season left", () => {
  it("«Sin clasificación todavía» with what this match leaves (the moviola's score)", () => {
    const n = noTableOf(MO({ live: true, played: true, minute: 36 }), { score: { us: 0, them: 6 }, left: 5, total: 6, playedBefore: 0, teams: 7, season: { pts: 0, dg: 0 }, jornada: 1 });
    expect(n.big).toBe("Sin clasificación todavía");
    expect(n.points.map((p) => p.v)).toEqual(["0", "−6", "5"]);
    const pre = noTableOf(MO({ pre: true }), { score: { us: 0, them: 0 }, left: 5, total: 6, playedBefore: 0, teams: 7, season: { pts: 0, dg: 0 }, jornada: 1 });
    expect(pre.big).toBe("La liga empieza esta jornada");
    expect(pre.points.map((p) => `${p.v} ${p.t}`)).toEqual(["0 jugados", "6 jornadas", "7 equipos"]);
  });

  it("la forma: this jornada provisional while played, the rest from the strip", () => {
    const segs = [
      { id: "a", jornada: 1, state: "jugado" as const, letter: "G" as const },
      { id: "b", jornada: 2, state: "directo" as const, letter: null },
      { id: "c", jornada: 3, state: "proximo" as const, letter: null },
    ];
    const f = formOf(segs, "b", MO({ live: true, played: true, minute: 20 }), { us: 0, them: 2 }, R18);
    expect(f.items.map((i) => `${i.t}:${i.tone}`)).toEqual(["G:g", "P:prov", "J3:empty"]);
    expect(f.items[1].aria).toBe("J2, perdiendo, provisional");
    expect([f.from, f.to]).toEqual(["J1", "J3"]);
    expect(formLabel(MO({ done: true, played: true }), 1, R18, 5)).toBe("La forma: la J1, perdida; quedan cinco");
  });

  it("dates in club time", () => {
    expect(whenText(Date.UTC(2026, 9, 18, 12, 0))).toBe("Dom 18 oct, 14:00");
    // (the clocks go back that night: CET)
    expect(whenText(Date.UTC(2026, 9, 25, 13, 0))).toBe("Dom 25 oct, 14:00");
    expect(whenText(NaN)).toBe("Sin fecha");
  });
});

describe("the acta's ledger", () => {
  const ledger = {
    evans: { minutes: 50, saves: 10, passes: 10, passesCompleted: 6, shots: 0, shotsOnTarget: 0, recoveries: 2, interceptions: 1, dribbles: 0, dribblesWon: 0 },
    alcides: { minutes: 30, passes: 20, passesCompleted: 15, shots: 3, shotsOnTarget: 1, recoveries: 5, interceptions: 0, dribbles: 4, dribblesWon: 2 },
  };
  const nameOf = (id: string) => ({ evans: "Evans", alcides: "Alcides" })[id] ?? "Jugador";
  it("«De un vistazo» sums the team", () => {
    expect(vistazoOf(ledger, nameOf)).toEqual([
      { n: 3, unit: "", t: "remates", d: "1 a puerta" },
      { n: 30, unit: "", t: "pases", d: "intentados" },
      { n: 70, unit: " %", t: "de pases buenos", d: "21 de 30" },
      { n: 8, unit: "", t: "recuperaciones", d: "1 interceptación" },
      { n: 10, unit: "", t: "paradas", d: "de Evans" },
      { n: 2, unit: "", t: "regates buenos", d: "de 4" },
    ]);
    expect(vistazoOf(null, nameOf)).toEqual([]);
  });
  it("«Quién sumó»: the best of each column; without a ledger, goals and assists", () => {
    expect(leadersOf(ledger, []).map((l) => `${l.what}:${l.id}:${l.v} ${l.t}`)).toEqual([
      "Pases buenos:alcides:15 pases buenos de 20",
      "Remates:alcides:3 remates, 1 a puerta",
      "Recuperaciones:alcides:5 recuperaciones",
      "Paradas:evans:10 paradas",
      "Minutos:evans:50 minutos",
    ]);
    expect(leadersOf(null, [{ k: "gol", who: "alcides", assist: "evans" }])).toEqual([
      { id: "alcides", v: 1, t: "gol", what: "Goles" },
      { id: "evans", v: 1, t: "asistencia", what: "Asistencias" },
    ]);
  });
  it("the keeper's note: a penalty saved, else his saves once the match is whole", () => {
    expect(saveNoteOf([{ k: "parada", m: 34, who: "evans" }], ledger, 40, 50, nameOf)).toBe("Evans paró un penalti en el 34.");
    expect(saveNoteOf([], ledger, 30, 50, nameOf)).toBe("");
    expect(saveNoteOf([], ledger, 50, 50, nameOf)).toBe("Evans hizo 10 paradas: sin él, la cuenta habría sido más larga.");
  });
});

describe("the rival", () => {
  it("the lede and the facts", () => {
    expect(rivalLede("Orduña fc", { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }, null).b).toBe("Primera vez contra Orduña fc.");
    expect(rivalLede("Orduña fc", { played: 2, wins: 1, draws: 0, losses: 1, gf: 3, ga: 9 }, { gf: 1, ga: 8, when: "18 oct" })).toEqual({ b: "Ya nos hemos visto 2 veces.", rest: "1 victoria, 0 empates y 1 derrota; 3 a favor y 9 en contra. La última, derrota 1–8 el 18 oct." });
    expect(rivalFacts({ home: true, venue: "CDM Palomeras", jornada: 1, theirRow: null }).map((f) => f.text)).toEqual(["Vienen de visitantes al CDM Palomeras.", "También es su primera jornada: nadie sabe aún cómo llegan."]);
    expect(rivalFacts({ home: false, venue: "Las Rozas", jornada: 3, theirRow: { pos: 2, pts: 6, pj: 2 } }).map((f) => f.text)).toEqual(["Jugamos de visitantes, en Las Rozas.", "Llegan 2º, con 6 puntos en 2 partidos."]);
  });
  it("the record after the acta", () => {
    expect(recordAfter({ rec: { played: 1, wins: 0, draws: 0, losses: 1, gf: 1, ga: 8 }, scorers: [{ name: "Alcides", goals: 1 }], biggest: null })).toEqual({
      lede: "Este fue el primer cara a cara: el historial contra ellos empieza aquí.",
      scorers: "Alcides, un gol",
      bestK: "La primera victoria",
      best: "Aún sin victoria contra ellos: la próxima puede ser la primera.",
    });
  });
  it("signed numbers use a true minus", () => {
    expect([signed(2), signed(-7), signed(0)]).toEqual(["+2", "−7", "0"]);
  });
});
