import { describe, expect, it } from "vitest";
import type { JornadaRow, Reward, Rewards, SeasonFigures, TierInfo } from "../me";
import type { PendingItem } from "../usePending";
import { attrSheetView, calmLine, canChange, countdown, doneText, doorCount, formView, idView, milestoneView, nextView, socioTrio, todoMeta, todoView } from "./tuView";

// Production-shaped: J1 played (4,7, baja), J2 didn't play (in the acta, no minutes), J3 next, J4–J22 to come.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 18, 16, 0); // Sunday 18 Oct 2026, 18:00 Madrid
const NOW = Date.UTC(2026, 9, 31, 10, 0); // Saturday 31 Oct 2026
const row = (j: number, o: Partial<JornadaRow> = {}): JornadaRow => ({
  matchId: `m${j}`,
  j,
  jLabel: `J${j}`,
  kind: "up",
  rival: `Rival ${j}`,
  home: true,
  dateMs: T0 + (j - 1) * 7 * DAY,
  status: "scheduled",
  gf: null,
  ga: null,
  result: null,
  dur: 50,
  min: null,
  start: null,
  pos: null,
  posLong: null,
  stints: [],
  g: 0,
  a: 0,
  nota: null,
  notaText: "—",
  band: "no",
  bandWord: "Sin nota",
  ledger: [],
  mvp: false,
  answer: null,
  reason: null,
  ...o,
});
const J1 = row(1, { kind: "played", rival: "Orduña", gf: 3, ga: 8, result: "P", min: 40, start: true, pos: "LD", posLong: "Lateral derecho", nota: 4.7, notaText: "4,7", band: "s5", bandWord: "Baja", status: "finished" });
const J2 = row(2, { kind: "didnt", rival: "Atlético Pinto", gf: 2, ga: 2, result: "E", start: false, status: "finished" });
const J3 = row(3, { kind: "next", rival: "Red Demons", home: true, dateMs: Date.UTC(2026, 10, 8, 17, 0) });
const ROWS: JornadaRow[] = [J1, J2, J3, ...Array.from({ length: 19 }, (_, i) => row(i + 4))];
const FIG: SeasonFigures = { jornadas: 2, played: 1, minutes: 40, average: 4.7, best: J1, goals: 0, assists: 0, ga: 0, mvps: 0 };
const TIER: TierInfo = { rating: 60, tier: "bronce", name: "Bronce", provisional: true, plata: 65, oro: 75, next: { name: "Plata", at: 65, missing: 5 }, tiers: [] };
const reward = (id: string, o: Partial<Reward> = {}): Reward => ({ id, kind: "evolucion", t: id, d: "", reward: "", gold: false, earned: false, match: null, progress: { cur: 0, goal: 1, pct: 0 }, need: "", ...o });
const REWARDS: Rewards = {
  earned: [reward("evo-debut", { t: "Debut", earned: true, progress: null, reward: "Tu primera carta", match: { matchId: "m1", j: 1, rival: "Orduña", dateMs: T0, label: "J1 · contra Orduña · 18 oct" } })],
  next: [
    reward("logro-ten", { kind: "logro", t: "10 partidos", progress: { cur: 1, goal: 10, pct: 10 }, need: "Te faltan 9 partidos", reward: "Medalla en tu vitrina" }),
    reward("evo-goal", { t: "Primer gol", progress: { cur: 0, goal: 1, pct: 0 }, need: "Te falta 1 gol", reward: "Estela dorada en el nombre", gold: true }),
    reward("logro-assist", { kind: "logro", t: "Asistente", progress: { cur: 0, goal: 3, pct: 0 }, need: "Te faltan 3 asistencias", reward: "Medalla en tu vitrina" }),
  ],
};

const noop = async () => {};
const base = { noticeIds: [], icon: "check" as const, after: "", error: "" };

describe("countdown and the next match", () => {
  it("counts Madrid days", () => {
    expect(countdown(NOW, J3.dateMs)).toBe("Faltan 8 días");
    expect(countdown(NOW, NOW + 3600_000)).toBe("Hoy");
    expect(countdown(NOW, NOW + DAY)).toBe("Mañana");
  });
  it("draws the next match's line with the venue, and never «en casa» when home is unknown", () => {
    const v = nextView(J3, NOW, "CDM Palomeras");
    expect(v).toEqual({ in: "Faltan 8 días", rival: "Red Demons", line: "J3 · en casa · domingo, 8 de noviembre · 18:00 · CDM Palomeras".replace("domingo, ", "domingo ") });
    expect(nextView({ ...J3, home: null }, NOW)?.line).toContain("campo por confirmar");
    expect(nextView(null, NOW)).toBeNull();
  });
  it("the calm line names the next jornada", () => {
    expect(calmLine(J3)).toBe("Lo próximo: J3 contra Red Demons, el domingo, 8 de noviembre a las 18:00.".replace("domingo, ", "domingo "));
    expect(calmLine(null)).toBe("Te avisamos cuando haya algo que contestar.");
  });
});

describe("who he is", () => {
  const o = { kind: "jugador" as const, captain: false, seasonName: "Temporada 1", lastJ: "J2", tier: TIER, figures: FIG, onlyPlayed: J1, showNumbers: true, started: true, first: null, racha: false, pendingClaim: false };
  it("a player with one played match: provisional, from that match", () => {
    const v = idView(o);
    expect(v.kick).toBe("Tu página · Temporada 1, tras la J2");
    expect(v.chips).toEqual([{ t: "Bronce · 60 · provisional", cls: "is-ok" }]);
    expect(v.why).toBe("60 de valoración: sale de tus notas por partido, con un solo partido (J1, 4,7). Por eso es provisional. La misma que en la pizarra.");
  });
  it("a captain, a socio, a new account", () => {
    expect(idView({ ...o, captain: true }).chips.map((c) => c.t)).toContain("Capitán del vestuario");
    expect(idView({ ...o, kind: "socio" })).toMatchObject({ kick: "Tu página · socio", chips: [{ t: "Socio del club", cls: "is-ok" }] });
    expect(idView({ ...o, kind: "nuevo", pendingClaim: true })).toMatchObject({ kick: "Tu página · ficha en camino", chips: [{ t: "Ficha pendiente", cls: "is-warn" }] });
    expect(idView({ ...o, kind: "nuevo" }).chips[0].t).toBe("Sin ficha todavía");
  });
  it("before the season starts", () => {
    expect(idView({ ...o, showNumbers: false, started: false, first: { dateMs: T0, rival: "Orduña" }, figures: { ...FIG, played: 0 } }).why).toBe("La Temporada 1 aún no ha empezado: tus números salen en la J1, el domingo, 18 de octubre contra Orduña.".replace("domingo, ", "domingo "));
  });
});

describe("«Lo que te toca» cards", () => {
  const rsvp: PendingItem = { ...base, kind: "rsvp", key: "rsvp-m3", title: "¿Vas el domingo 8 a Red Demons?", body: "J3 · 18:00 · en casa · contestan 6 de 16", done: false, value: null, busy: false, pick: noop };
  const caja: PendingItem = { kind: "caja", key: "caja", title: "Debes 12,50 €", body: "Bizum a Kevin o en mano el domingo.", owes: true, claimed: false, done: false, busy: false, error: "", claim: noop };
  const turno: PendingItem = { ...base, kind: "turno", key: "turno-m3", title: "Te toca el agua", body: "Turnos de la J3. Si no puedes, cámbialo en el vestuario.", done: false, busy: false, mark: noop };
  const poll: PendingItem = { ...base, kind: "poll", key: "poll-p", title: "Nueva encuesta", body: "Kevin: ¿Cena después del partido?", done: false, opts: [{ id: "a", label: "Sí", n: 7, pct: 64, on: false }, { id: "b", label: "No", n: 4, pct: 36, on: false }], pick: noop };
  const porra: PendingItem = { kind: "porra", key: "porra-m3", matchId: "m3", rival: "Red Demons", saved: null, done: false, busy: false, error: "", save: noop };
  const mvp: PendingItem = { ...base, kind: "mvp", key: "mvp-m2", title: "Vota al MVP de la J2", body: "6 de 11 ya han votado · se cierra el martes a las 18:00", done: false, matchJ: 2, cands: [{ id: "p1", name: "Erik", num: "9", min: 50, on: false }], pick: noop };
  const door: PendingItem = { ...base, kind: "door", key: "door", title: "Llaman a la puerta del vestuario", body: "Ana y 2 más piden entrar.", done: false, path: "/vestuario/puerta" };

  it("words each kind as the prototype (the convocatoria leads, la caja is private)", () => {
    expect(todoView(rsvp)).toMatchObject({ kick: "Convocatoria · J3", title: "¿Vas el domingo 8 a Red Demons?", line: "18:00 · en casa · contestan 6 de 16.", lead: true, icon: "cal" });
    expect(todoView(caja)).toMatchObject({ kick: "La caja", title: "Debes 12,50 €", priv: true, warn: true });
    expect(todoView(turno)).toMatchObject({ kick: "Tu turno · J3", title: "Te toca el agua", line: "Si no puedes, cámbialo en el vestuario." });
    expect(todoView(poll)).toMatchObject({ kick: "Encuesta de Kevin", title: "¿Cena después del partido?", line: "11 votos hasta ahora." });
    expect(todoView(porra, (id) => (id === "m3" ? 3 : null))).toMatchObject({ kick: "Tu porra · J3", title: "Piti – Red Demons" });
    expect(todoView(mvp)).toMatchObject({ kick: "El MVP · J2", title: "Vota al MVP de la J2", icon: "trophy" });
    expect(todoView(door)).toMatchObject({ kick: "Capitanía · la puerta", title: "3 llaman a la puerta" });
    expect(doorCount("Ana pide entrar (ana@x.es).")).toBe(1);
  });
  it("says what an answered one did, and which can change", () => {
    expect(doneText(rsvp)).toBeNull();
    expect(doneText({ ...rsvp, done: true, value: "yes" } as PendingItem)).toBe("Vas el domingo 8");
    expect(doneText({ ...rsvp, done: true, value: "maybe" } as PendingItem)).toBe("En duda para la J3");
    expect(doneText({ ...rsvp, done: true, value: "no" } as PendingItem)).toBe("No vas a la J3");
    expect(doneText({ ...caja, done: true } as PendingItem)).toBe("Pago avisado: el capitán lo apunta");
    expect(doneText({ ...turno, done: true } as PendingItem)).toBe("Turno hecho: el agua");
    expect(doneText({ ...porra, done: true, saved: { gf: 2, ga: 1 } } as PendingItem)).toBe("Porra: 2–1");
    expect(doneText({ ...mvp, done: true, cands: [{ id: "p1", name: "Erik", num: "9", min: 50, on: true }] } as PendingItem)).toBe("MVP: Erik");
    expect(canChange(rsvp) && canChange(porra) && !canChange(caja) && !canChange(turno)).toBe(true);
    expect(todoMeta(5)).toBe("5 cosas · las contestas aquí mismo");
    expect(todoMeta(1)).toBe("1 cosa · las contestas aquí mismo");
  });
});

describe("under the bar", () => {
  it("form: J1 a 4,7, J2 «No jugaste», and no trend with one match", () => {
    const f = formView([J1, J2], FIG);
    expect(f.chips.map((c) => [c.n, c.j, c.cls])).toEqual([
      ["4,7", "J1", "tc-nb tc-nb--s tc-nb--s5"],
      ["—", "J2", "tc-nb tc-nb--s tc-nb--no"],
    ]);
    expect(f.chips[1].aria).toBe("J2: no jugaste");
    expect(f.line).toBe("Con un partido aún no hay tendencia: tu J1 fue un 4,7 (baja). La J2 la viste desde fuera.");
  });
  it("form: a trend with many matches, nothing before the first", () => {
    const many = [6.2, 6.8, 7.4, 7.9, 8.1].map((n, i) => row(i + 1, { kind: "played", nota: n, notaText: String(n).replace(".", ","), band: "s7", bandWord: "Buena" }));
    expect(formView(many, { ...FIG, played: 5, average: 7.28 }).line).toBe("Subiendo: tus 3 últimas, 7,8 de media; la temporada, 7,3.");
    expect(formView([], { ...FIG, played: 0, average: null }).chips).toEqual([]);
  });
  it("the next milestone: the first goal first", () => {
    expect(milestoneView(REWARDS)).toEqual({ t: "Primer gol", pct: 0, line: "Te falta 1 gol · Premio: estela dorada en el nombre", aria: "Primer gol: 0 de 1" });
    expect(milestoneView({ earned: [], next: [] })).toBeNull();
  });
  it("the socio's porra", () => {
    expect(socioTrio({ predictions: 5, exact: 1, points: 9, rank: 3, of: 12 })).toEqual({ porraBig: "3.º de 12", porraLine: "5 pronósticos · 1 exacto esta temporada." });
    expect(socioTrio(null).porraBig).toBe("Sin pronósticos");
  });
});

describe("«De qué está hecho»", () => {
  it("MIN: the matches that built it, how it moves the rating, never points from rewards", () => {
    const v = attrSheetView("MIN", ROWS, "40", REWARDS);
    expect(v.title).toBe("Minutos: 40");
    expect(v.rows).toEqual([{ key: "m1", j: "J1 · Orduña", v: "40′", pct: 100, aria: "J1 contra Orduña: 40′" }]);
    expect(v.move).toContain("No dan puntos");
    expect(v.rule).toBe("Los premios marcan tu carta, nunca tu valoración.");
  });
  it("GOL feeds the first goal; ASI the Asistente medal; PJ says it was earned", () => {
    expect(attrSheetView("GOL", ROWS, "0", REWARDS).next).toBe("Te falta 1 gol para «Primer gol»: estela dorada en el nombre.");
    expect(attrSheetView("ASI", ROWS, "0", REWARDS).next).toBe("Te faltan 3 asistencias para «Asistente»: medalla en tu vitrina.");
    expect(attrSheetView("PJ", ROWS, "1", { ...REWARDS, next: [] }).next).toBe("Ya tienes «Debut»: tu primera carta.");
  });
  it("without a played match it says so", () => {
    const v = attrSheetView("GOL", ROWS.filter((r) => r.kind !== "played"), "—", REWARDS);
    expect(v.rows).toEqual([]);
    expect(v.empty).toBe("Aún nada: sale con tu primer partido.");
    expect(v.title).toBe("Goles");
  });
});
