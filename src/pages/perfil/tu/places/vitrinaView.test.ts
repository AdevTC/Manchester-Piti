import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../../../../lib/clubData";
import type { PlayerDoc } from "../../../../lib/schemas";
import { MODEL_VERSION } from "../../../../lib/rating/constants";
import type { RecapCard } from "../../../../lib/derived/seasonRecap";
import { buildMe, tierInfo, type Answer, type Me, type MeInput } from "../me";
import { cromosMeta, cromoStart, cromoWords, seasonCromos, sheetLayout, type CromosSource } from "../cromosModel";
import { headOf, metalOf, porraWords, roadMeta, roadOf, scaleOf, wallOf, whysOf } from "./vitrinaView";

// Production-shaped (2026-10-31): Temporada 1 with the J1 played (Jordi 40′ at right back, a frozen nota of 4,7,
// lost 1–8), the J2 seen from outside (not called up) and twenty jornadas still to play; his card 60 Bronce,
// provisional.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 11, 12);
const NOW = T0 + 14 * DAY;
const player = (id: string, number: number, shirtName: string): PlayerDoc => ({ id, number, shirtName, firstName: shirtName, lastName: "", seasons: ["t1"], active: true }) as unknown as PlayerDoc;
const PLAYERS = [player("jordi", 28, "JORDI"), player("alcides", 7, "ALCIDES"), player("kevin", 10, "KEVIN"), player("erik", 9, "ERIK")];
const row = (o: Partial<Participation>): Participation =>
  ({ minutes: 0, started: false, benched: false, notCalled: false, played: false, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...o }) as Participation;
const notas = (players: Record<string, number>) => ({ model: MODEL_VERSION, rival: 1, players: Object.fromEntries(Object.entries(players).map(([id, nota]) => [id, { nota, minutes: 40, weight: 0.8, narrated: false }])) });
const finished = (id: string, day: number, gf: number, ga: number, ledger: Record<string, Participation>, nts: Record<string, number>): ClubMatch =>
  ({ id, seasonId: "t1", rival: `Rival ${id}`, home: true, status: "finished", date: T0 + day * DAY, duration: 50, goalsFor: gf, goalsAgainst: ga, events: [], ledger, notas: notas(nts) }) as ClubMatch;
const upcoming = (n: number): ClubMatch[] => Array.from({ length: n }, (_, i) => ({ id: `u${i + 3}`, seasonId: "t1", rival: `Rival ${i + 3}`, home: true, status: "scheduled", date: T0 + (21 + i * 7) * DAY, events: [] }) as unknown as ClubMatch);
const J1 = finished(
  "j1",
  0,
  1,
  8,
  {
    jordi: row({ played: true, started: true, minutes: 40, stints: [{ from: 0, to: 25 }, { from: 35, to: 50 }], positionsPlayed: { LD: 30, LI: 10 } }),
    alcides: row({ played: true, started: true, minutes: 50, stints: [{ from: 0, to: 50 }], goals: 1 }),
    kevin: row({ played: true, started: false, minutes: 10, stints: [{ from: 25, to: 35 }] }),
    erik: row({ notCalled: true }),
  },
  { jordi: 4.7, alcides: 6.2, kevin: 5.1 },
);
const J2 = finished("j2", 7, 3, 1, { jordi: row({ notCalled: true }), alcides: row({ played: true, minutes: 50, stints: [{ from: 0, to: 50 }] }) }, { alcides: 7.1 });
const MATCHES = [J1, J2, ...upcoming(20)];
const SEASONS = [{ id: "t1", name: "Temporada 1" }];
const input: MeInput = { playerId: "jordi", seasonId: "t1", matches: MATCHES, players: PLAYERS, seasons: SEASONS, mvpResults: new Map(), standings: [], now: NOW, answers: new Map<string, Answer>(), card: null };
const BRONCE = tierInfo({ rating: 60, tier: "bronce", tierName: "Bronce", global: { status: "provisional" } as never, racha: false });
const me: Me = { ...buildMe(input), tier: BRONCE };

describe("Tu vitrina: the head and the road (one played, 60 Bronce provisional)", () => {
  it("says the metal and the next one", () => {
    expect(headOf("jugador", BRONCE, false)).toMatchObject({ title: "Bronce, camino de Plata", share: "Compartir mi carta" });
    expect(headOf("jugador", tierInfo({ rating: 70, tier: "plata", tierName: "Plata", racha: false }), false).title).toBe("Plata, camino de Oro");
    expect(headOf("jugador", tierInfo({ rating: 80, tier: "racha", tierName: "En racha", racha: true }), false).title).toBe("Oro, camino de la cima");
    expect(headOf("jugador", tierInfo(null), false).title).toBe("Tu carta, por estrenar");
    expect(headOf("socio", BRONCE, false)).toMatchObject({ title: "Tu carné y lo tuyo", share: "Compartir mi póster" });
    expect(headOf("nuevo", BRONCE, true).title).toBe("Tu sobre, aún cerrado");
  });
  it("the live thresholds: Bronce under 65, Plata 65–74, Oro 75 or more", () => {
    expect([64, 65, 74, 75].map((r) => metalOf(r, BRONCE))).toEqual(["Bronce", "Plata", "Plata", "Oro"]);
  });
  it("puts him on the scale (60 is 40 % along 40…90) and says it in words", () => {
    expect(scaleOf(BRONCE)).toEqual({ left: 40, aria: "Tu valoración, 60, en la franja Bronce. Plata empieza en 65 y Oro en 75." });
    expect(scaleOf(tierInfo(null))).toBeNull();
  });
  it("the stations: the debut he earned in the J1, today, the next ones with progress and the gates", () => {
    const road = roadOf(me);
    expect(road[0]).toMatchObject({ cls: "is-done", t: "Debut", bar: null });
    expect(road[0].s).toMatch(/^J1 · contra Rival j1/);
    expect(road[1]).toMatchObject({ cls: "is-now", t: "Hoy · 60 Bronce", s: "Provisional: sale de 1 partido" });
    expect(road.filter((s) => s.cls === "").length).toBe(Math.min(4, me.rewards.next.length));
    expect(road.find((s) => s.cls === "is-gate")).toMatchObject({ t: "Plata · 65", s: "Te faltan 5 de valoración" });
    expect(road[road.length - 1]).toMatchObject({ cls: "is-gate is-oro", t: "Oro · 75", s: "Te faltan 15" });
    // the gate falls after the second next station
    expect(road.findIndex((s) => s.cls === "is-gate")).toBe(4);
    expect(roadMeta(me.rewards)).toBe(`${me.rewards.earned.length} de ${me.rewards.earned.length + me.rewards.next.length} ganadas · las paradas, de la más cercana a la más lejana`);
  });
  it("why Bronce and what makes him Plata, in words", () => {
    const w = whysOf(me, "");
    expect(w.whyH).toBe("Por qué eres Bronce");
    expect(w.whyT).toBe("Tu valoración es 60 y Bronce es todo lo que está por debajo de 65. Sale de tu nota en la J1 (4,7, «baja»): con un solo partido aún es provisional y se mueve mucho.");
    expect(w.upH).toBe("Qué te hace Plata");
    expect(w.upT).toMatch(/^Llegar a 65: te faltan 5\./);
    expect(w.upT).toContain("no suman puntos");
    expect(whysOf({ ...me, tier: tierInfo(null) }, "Se revela con tu primer partido de la temporada.").whyT).toBe("Se revela con tu primer partido de la temporada.");
  });
});

describe("Tu vitrina: ONE reward wall", () => {
  const [won, next] = wallOf(me.rewards);
  it("earned pieces name the match that gave them", () => {
    expect(won.t).toBe("Ganadas");
    const debut = won.items.find((x) => x.t === "Debut");
    expect(debut).toMatchObject({ kind: "Evolución", icon: "card", bar: null });
    expect(debut?.s).toMatch(/^J1 · contra Rival j1/);
    expect(debut?.cls).toContain("is-lit");
    expect(won.meta).toMatch(/^\d+ piezas? · cada una con el partido que te la dio$/);
  });
  it("the next ones in silhouette with what they ask and how far he is", () => {
    expect(next.items.length).toBe(me.rewards.next.length);
    expect(next.items.every((x) => x.cls.startsWith("is-off"))).toBe(true);
    const goal = next.items.find((x) => x.t === "Primer gol");
    expect(goal).toMatchObject({ s: "Te falta 1 gol · 0 de 1", bar: { pct: 0, aria: "Primer gol: 0 de 1" } });
    // gold only for our goals and the MVP
    expect(won.items.filter((x) => x.cls.includes("is-gold")).every((x) => /gol|MVP|Doblete|Hat|Goleador/i.test(x.t))).toBe(true);
  });
  it("an empty shelf says so", () => {
    const [w, n] = wallOf({ earned: [], next: [] });
    expect(w.items).toEqual([]);
    expect(w.empty).toContain("La primera llega jugando");
    expect(n.empty).toContain("Lo tienes todo");
  });
  it("the socio's porra in words", () => {
    expect(porraWords({ predictions: 5, exact: 1, points: 7, rank: 3, of: 12 })).toBe("5 pronósticos · 1 exacto · vas 3.º de 12 · 7 puntos.");
    expect(porraWords(null)).toBeNull();
  });
});

describe("Tu temporada en cromos: ONE model (the season recap)", () => {
  const src: CromosSource = { playerId: "jordi", uid: "u-jordi", seasonId: "t1", now: NOW, raw: { matches: MATCHES, players: PLAYERS, seasons: SEASONS, mvpResults: new Map(), standings: [] }, offer: null, porra: { predictions: 2, exact: 0, points: 3, rank: 4, of: 9 } };
  const c = seasonCromos(src);
  it("tells the season «hasta ahora» from his first match, with the porra and without the closing cromo", () => {
    expect(c).not.toBeNull();
    const kinds = c?.cards.map((x) => x.kind);
    expect(kinds?.[0]).toBe("portada");
    expect(kinds).toContain("partidos");
    expect(kinds).toContain("porra");
    expect(kinds).not.toContain("cierre");
    expect(c?.closed).toBe(false);
    expect(kinds?.indexOf("porra")).toBeLessThan(kinds?.indexOf("equipo") ?? -1);
    if (c) expect(cromosMeta(c)).toBe(`En curso: ${c.cards.length} cromos. Al final de la temporada sale la historia entera.`);
  });
  it("«Tu puesto» is the position he actually played most (bug 6)", () => {
    const pos = c?.cards.find((x) => x.kind === "posiciones");
    expect(pos).toBeDefined();
    if (pos) expect(cromoWords(pos, false)).toMatchObject({ k: "Tu puesto", t: "Lateral derecho" });
  });
  it("the words of each cromo", () => {
    const P = (card: RecapCard) => cromoWords(card, false);
    expect(P({ kind: "partidos", played: 1, minutes: 40 })).toMatchObject({ t: "1 partido", s: "40′ en el campo." });
    expect(P({ kind: "porra", rank: 3, of: 12, points: 7 })).toMatchObject({ t: "3.º de 12", s: "7 puntos." });
    expect(P({ kind: "portada", name: "JORDI", number: "28", season: "Temporada 1" })).toMatchObject({ k: "Temporada 1, hasta ahora", t: "28 · Jordi" });
    expect(P({ kind: "goles", goals: 1, assists: 0, best: null })).toMatchObject({ t: "1 gol", gold: true });
    expect(cromoWords({ kind: "cierre", season: "Temporada 1" }, true).k).toBe("Gracias por la temporada");
  });
  it("nothing without a ficha or a played match", () => {
    expect(seasonCromos({ ...src, playerId: null })).toBeNull();
    expect(seasonCromos({ ...src, playerId: "erik" })).toBeNull();
  });
  it("«Descargar todos» lays every cromo out in ONE image (bug 17)", () => {
    expect(sheetLayout(6)).toMatchObject({ cols: 5, rows: 2, cw: 432, ch: 768 });
    expect(sheetLayout(3)).toMatchObject({ cols: 3, rows: 1 });
  });
  it("a tile opens the viewer on its cromo, once", () => {
    cromoStart.set(3);
    expect(cromoStart.peek()).toBe(3);
    expect(cromoStart.peek()).toBe(3);
    cromoStart.clear();
    expect(cromoStart.peek()).toBe(0);
  });
});
