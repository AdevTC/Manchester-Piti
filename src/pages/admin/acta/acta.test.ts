import { describe, expect, it } from "vitest";
import { assign, calledUp, copyLineup, lineupCounts, lineupProblem, lineupReady, previousLineup, restNotCalled, roleOf, type Lineup } from "./convocatoria";
import { dateInput, joinDate, madridTime, proposeDate, splitDate } from "./dates";
import { clearDraft, draftKey, readDraft, recoverable, writeDraft } from "./localDraft";
import { minutesTable } from "./minutes";
import { mvpStatus, publishConsequences, scorerChips } from "./publish";
import { buildResumen } from "./resumen";
import { reviewMatch } from "./review";
import { fromMatch, setMinute, setScorer, sig, upsertEvent, type MatchSheet } from "./sheetModel";

const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const BENCH = ["kevin", "almachi", "andia", "fer", "brawan"];
const ROSTER = [...SEVEN, ...BENCH];
const NAMES: Record<string, string> = { adrian: "ADRIÁN T.C.", erik: "ERIK", huberoski: "HUBEROSKI", kevin: "KEVIN", tello: "TELLO", eguzquiza: "EGUZQUIZA", evans: "EVANS", almachi: "ALMACHI" };
const nameOf = (id: string) => NAMES[id] ?? id.toUpperCase();
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const KICKOFF = Date.UTC(2026, 10, 1, 9, 0);
const empty: Lineup = { starters: [], bench: [], notCalled: [] };

/** The J7 acta, complete: 3–1, two changes. */
function j7(): MatchSheet {
  let s = fromMatch({
    seasonId: "t1",
    rival: "FUSION 7",
    competition: "Liga",
    date: KICKOFF,
    status: "finished",
    duration: 50,
    home: true,
    goalsFor: 3,
    goalsAgainst: 1,
    starters: SEVEN,
    bench: BENCH,
    notCalled: [],
    events: [
      { id: "g1", type: "goal", minute: 9, playerId: "adrian", assistPlayerId: "huberoski" },
      { id: "g2", type: "goal", minute: 31, playerId: "adrian", assistPlayerId: "erik" },
      { id: "r1", type: "opponent_goal", minute: 18 },
      { id: "c1", type: "substitution", minute: 30, playerId: "tello", inPlayerId: "kevin" },
      { id: "c2", type: "substitution", minute: 38, playerId: "eguzquiza", inPlayerId: "almachi" },
    ],
  });
  s = setScorer(setMinute(s, "open-g0", "46"), "open-g0", "huberoski");
  return s;
}

describe("convocatoria rules", () => {
  it("assigns one role per player, and refuses an eighth titular", () => {
    let l = empty;
    for (const id of SEVEN) {
      const r = assign(l, id, "T");
      if (!r.ok) throw new Error(r.error);
      l = r.lineup;
    }
    expect(roleOf(l, "erik")).toBe("T");
    expect(assign(l, "kevin", "T", "KEVIN")).toEqual({ ok: false, error: "Ya hay siete titulares: pasa uno a suplente antes de subir a KEVIN." });
    const moved = assign(l, "erik", "S");
    expect(moved.ok && roleOf(moved.lineup, "erik")).toBe("S");
    expect(moved.ok && moved.lineup.starters).toHaveLength(6);
    // re-pressing a titular stays allowed
    expect(assign(l, "erik", "T").ok).toBe(true);
  });
  it("counts, readiness and why not", () => {
    const c = lineupCounts({ starters: SEVEN, bench: ["kevin"], notCalled: [] }, ROSTER);
    expect(c).toEqual({ starters: 7, bench: 1, notCalled: 0, unassigned: 4 });
    expect(lineupReady(c)).toBe(false);
    expect(lineupProblem(c)).toBe("Faltan 4 jugadores por asignar: titular, suplente o no convocado.");
    const done = restNotCalled({ starters: SEVEN, bench: ["kevin"], notCalled: [] }, ROSTER);
    expect(done.notCalled).toEqual(["almachi", "andia", "fer", "brawan"]);
    expect(lineupReady(lineupCounts(done, ROSTER))).toBe(true);
    expect(lineupProblem(lineupCounts({ starters: [], bench: [], notCalled: ROSTER }, ROSTER))).toBe("Elige entre uno y siete titulares.");
  });
  it("copies another convocatoria for this season's players only", () => {
    const from = { starters: [...SEVEN, "old"], bench: ["kevin", "gone"], notCalled: ["brawan"] };
    expect(copyLineup(from, ROSTER)).toEqual({ starters: SEVEN, bench: ["kevin"], notCalled: ["brawan"] });
  });
  it("finds the previous match of the season with a convocatoria", () => {
    const ms = [
      { id: "a", seasonId: "t1", date: 1, starters: ["x"] },
      { id: "b", seasonId: "t1", date: 2, starters: [] },
      { id: "c", seasonId: "t0", date: 3, starters: ["x"] },
      { id: "d", seasonId: "t1", date: 5, starters: ["x"] },
    ];
    expect(previousLineup(ms, { id: "e", seasonId: "t1", date: 4 })?.id).toBe("a");
    expect(previousLineup(ms, { id: "a", seasonId: "t1", date: 1 })).toBeUndefined();
  });
  it("lists titulares first, then suplentes, in the squad's order", () => {
    expect(calledUp({ starters: ["erik", "evans"], bench: ["kevin", "almachi"], notCalled: ["fer"] }, ROSTER)).toEqual([
      { id: "evans", role: "T" },
      { id: "erik", role: "T" },
      { id: "kevin", role: "S" },
      { id: "almachi", role: "S" },
    ]);
  });
});

describe("minutes and participation", () => {
  it("previews the ledger: minutes, entries, exits and goals", () => {
    const t = minutesTable(j7(), nameOf);
    expect(t.errors).toEqual([]);
    const by = Object.fromEntries(t.rows.map((r) => [r.id, r]));
    expect(by.evans).toMatchObject({ minutes: 50, detail: "inicial" });
    expect(by.adrian).toMatchObject({ minutes: 50, detail: "inicial · 2 goles" });
    expect(by.tello).toMatchObject({ minutes: 30, detail: "inicial · sale 30′" });
    expect(by.kevin).toMatchObject({ minutes: 20, detail: "suplente · entra 30′" });
    expect(by.almachi).toMatchObject({ minutes: 12, detail: "suplente · entra 38′" });
    expect(by.fer).toMatchObject({ minutes: 0, played: false, detail: "suplente · no jugó" });
    expect(by.huberoski.detail).toBe("inicial · 1 gol · 1 asistencia");
  });
});

describe("«Preparar resumen con los datos del acta»", () => {
  it("writes the result, the scorers with their minutes and the assists", () => {
    expect(buildResumen(j7(), nameOf)).toBe(
      "El Piti ganó 3–1 a FUSION 7 en casa (Liga, dom 1 nov). ADRIÁN T.C. marcó 2 (9′ y 31′); HUBEROSKI marcó en el 46′. Asistencias de HUBEROSKI y ERIK.",
    );
  });
  it("draws and own goals; the previa before the match", () => {
    const s = fromMatch({ seasonId: "t1", rival: "MAD SKY", date: KICKOFF, status: "finished", home: false, competition: "Copa", goalsFor: 1, goalsAgainst: 1, events: [{ id: "o", type: "opponent_own_goal", minute: 12 }, { id: "r", type: "opponent_goal", minute: 20 }] });
    expect(buildResumen(s, nameOf)).toBe("El Piti empató 1–1 con MAD SKY fuera (Copa, dom 1 nov). MAD SKY se marcó uno en propia (12′).");
    const next = fromMatch({ seasonId: "t1", rival: "MAD SKY", date: Date.UTC(2026, 10, 8, 11, 0), status: "scheduled", home: false });
    expect(buildResumen(next, nameOf)).toBe("Previa: el Piti visita a MAD SKY el dom 8 nov a las 12:00 (Liga).");
  });
});

describe("club time", () => {
  it("round-trips Madrid wall-clock times across DST", () => {
    expect(dateInput(KICKOFF)).toBe("2026-11-01T10:00");
    expect(madridTime("2026-11-01T10:00")).toBe(KICKOFF);
    expect(madridTime(dateInput(Date.UTC(2026, 6, 5, 16, 30)))).toBe(Date.UTC(2026, 6, 5, 16, 30));
    expect(madridTime("2026-03-29T02:30")).toBeNaN(); // that hour doesn't exist in Madrid
    expect(madridTime("")).toBeNaN();
    expect(splitDate(KICKOFF)).toEqual({ date: "2026-11-01", time: "10:00" });
    expect(joinDate("2026-11-01", "10:00")).toBe(KICKOFF);
    expect(joinDate("", "10:00")).toBeNaN();
  });
  it("proposes the next match a week after the last one, or next Sunday at 11:00", () => {
    expect(proposeDate(KICKOFF, NOW)).toBe(KICKOFF + 7 * 24 * 3600_000);
    expect(proposeDate(KICKOFF - 21 * 24 * 3600_000, NOW)).toBe(KICKOFF + 7 * 24 * 3600_000);
    expect(dateInput(proposeDate(undefined, NOW))).toBe("2026-11-08T11:00");
  });
});

describe("local draft recovery", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage;
  };
  const isStr = (v: unknown): v is string => typeof v === "string";
  it("stores, reads, offers only when it started from the current version, and clears", () => {
    const s = store();
    const key = draftKey("acta", "m7");
    expect(key).toBe("mp-admin:acta:m7");
    writeDraft(key, { at: 5, base: sig("v1"), value: "v1 + edits" }, s);
    const got = readDraft(key, isStr, s);
    expect(got).toEqual({ at: 5, base: sig("v1"), value: "v1 + edits" });
    expect(recoverable(got, sig("v1"), sig)).toEqual(got);
    expect(recoverable(got, sig("v2"), sig)).toBeNull(); // someone saved since
    expect(recoverable({ at: 1, base: sig("v1"), value: "v1" }, sig("v1"), sig)).toBeNull(); // nothing new
    s.setItem(key, "{broken");
    expect(readDraft(key, isStr, s)).toBeNull();
    s.setItem(key, JSON.stringify({ at: 1, base: "x", value: 3 }));
    expect(readDraft(key, isStr, s)).toBeNull();
    clearDraft(key, s);
    expect(s.getItem(key)).toBeNull();
    expect(readDraft(key, isStr, null)).toBeNull();
  });
});

describe("publishing, in words", () => {
  it("scorer chips with minute, kind and assist", () => {
    let s = upsertEvent(j7(), { id: "p", type: "goal_penalty", minute: 49, playerId: "erik" });
    s = upsertEvent(s, { id: "o", type: "opponent_own_goal", minute: 50 });
    expect(scorerChips(s, nameOf)).toEqual(["ADRIÁN T.C. 9′ (HUBEROSKI)", "ADRIÁN T.C. 31′ (ERIK)", "HUBEROSKI 46′", "ERIK 49′ de penalti", "Autogol de FUSION 7 50′"]);
  });
  it("what happens: web, minutes, the MVP window", () => {
    const first = publishConsequences({ finished: true, starters: 7, bench: 5, firstTime: true, now: NOW });
    expect(first.map((c) => c.tone)).toEqual(["o", "o", "g", ""]);
    expect(first[0].text).toBe("Convocatoria: 7 titulares y 5 suplentes · minutos calculados");
    expect(first[2].text).toBe("La votación del MVP se abre ahora y cierra en 48 h (mié 4 nov, 10:00)");
    const fix = publishConsequences({ finished: true, starters: 7, bench: 5, voteClosesAt: NOW + 3600_000, firstTime: false, now: NOW });
    expect(fix[2].text).toBe("La votación del MVP sigue abierta hasta el lun 2 nov, 11:00");
    const sched = publishConsequences({ finished: false, starters: 0, bench: 0, firstTime: true, now: NOW });
    expect(sched[0].text).toBe("Sale en el calendario de la web con su fecha, hora y campo");
    expect(sched[1].text).toBe("Sin convocatoria todavía: se puede hacer después");
  });
  it("the MVP line: opens at publish, closes 48 h later, has a winner", () => {
    const base = { finished: true, published: false, winners: [], votes: 0, total: 0 };
    expect(mvpStatus(base, NOW)).toBe("la votación se abre sola al publicar el acta y dura 48 h.");
    expect(mvpStatus({ ...base, finished: false }, NOW)).toMatch(/^la votación se abre sola cuando se publique/);
    expect(mvpStatus({ ...base, published: true, voteClosesAt: NOW + 3600_000 }, NOW)).toBe("votación abierta · cierra el lun 2 nov a las 11:00. Se abrió sola al publicar.");
    expect(mvpStatus({ ...base, published: true, voteClosesAt: NOW - 1, winners: ["ERIK"], votes: 9, total: 12 }, NOW)).toBe("votación cerrada · ganó ERIK con 9 votos.");
    expect(mvpStatus({ ...base, published: true, voteClosesAt: NOW - 1, winners: ["ERIK", "KEVIN"], votes: 4, total: 8 }, NOW)).toBe("votación cerrada · empate entre ERIK y KEVIN con 4 votos.");
    expect(mvpStatus({ ...base, published: true, voteClosesAt: NOW - 1 }, NOW)).toBe("votación cerrada el lun 2 nov · nadie votó.");
  });
});

describe("the review of the acta being written", () => {
  const nameOfU = (id: string | undefined) => (id ? nameOf(id) : "—");
  it("names an event without minute instead of a missing scorer", () => {
    const s = setMinute(j7(), "open-g0", "");
    const r = reviewMatch(s, ROSTER, NOW, false, nameOfU);
    expect(r.cuadra).toBe(false);
    expect(r.missingScorers).toBe(0);
    expect(r.reasons).toEqual(["falta el minuto del gol 3"]);
    expect(r.why).toBe("Para publicar: falta el minuto del gol 3.");
    expect(r.steps.find((x) => x.key === "acta")).toMatchObject({ tone: "warn", mark: "!" });
    expect(r.items.map((i) => i.key)).toEqual(["encuentro", "convocatoria", "goles", "eventos", "asistencias"]);
    const two = upsertEvent(s, { id: "y", type: "yellow_card", playerId: "erik" });
    expect(reviewMatch(two, ROSTER, NOW, false, nameOfU).reasons[0]).toBe("faltan 2 minutos por apuntar");
    const card = upsertEvent(j7(), { id: "y", type: "yellow_card", playerId: "erik" });
    expect(reviewMatch(card, ROSTER, NOW, false, nameOfU).reasons[0]).toBe("falta el minuto de «Amarilla · ERIK»");
  });
  it("is the plain review when every minute is there", () => {
    expect(reviewMatch(j7(), ROSTER, NOW, false, nameOfU).cuadra).toBe(true);
  });
});
