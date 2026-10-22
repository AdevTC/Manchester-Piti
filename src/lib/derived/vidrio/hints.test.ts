import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../clubData";
import { upcomingBirthdays } from "../../home";
import { matchdayOf, type MatchdayModel } from "../matchday";
import { longSeasonFixture, madridMs } from "./fixtures";
import { kickoffHint, placeHints, type PlaceHintsInput } from "./hints";
import { projectTable } from "./table";

const NOW = madridMs(2026, 10, 18, 12);
const KO = madridMs(2026, 10, 18, 19);
const m = (extra: Partial<ClubMatch> = {}): ClubMatch => ({ id: "m", seasonId: "t1", rival: "Orduña fc", date: KO, status: "scheduled", ...extra });
const day = (phase: MatchdayModel["phase"], extra: Partial<PlaceHintsInput["day"]> = {}): PlaceHintsInput["day"] => ({ phase, match: m(), minute: null, score: null, kickoff: KO, ...extra });
const hoy = (d: PlaceHintsInput["day"], now = NOW) => placeHints({ day: d, now }).hoy;

describe("placeHints · tonight in the long season", () => {
  it("Hoy «2\u2060–\u20601, minuto 23», Temporada «4º si acaba así», Club «Huberoski cumple el 27», Tú", () => {
    const f = longSeasonFixture();
    const md = matchdayOf(f.matches, f.seasonId, f.now);
    const sim = projectTable(f.standings, md.score ? { rival: md.match?.rival ?? "", gf: md.score.gf, ga: md.score.ga } : null);
    const hints = placeHints({
      day: md,
      now: f.now,
      table: { position: sim.position, points: sim.points, projected: true },
      birthdays: upcomingBirthdays(f.squad, f.now, 3),
      squadSize: f.squad.length,
      pending: 2,
    });
    expect(hints).toEqual({ hoy: "2\u2060–\u20601, minuto 23", temporada: "4º si acaba así", club: "Huberoski cumple el 27", tu: "2 cosas pendientes" });
  });
});

describe("placeHints · Hoy, phase by phase", () => {
  it("live, the break and the whistle", () => {
    expect(hoy(day("directo2", { minute: 41, score: { gf: 3, ga: 1 } }))).toBe("3\u2060–\u20601, minuto 41");
    expect(hoy(day("descanso", { score: { gf: 2, ga: 1 } }))).toBe("2\u2060–\u20601, al descanso");
    expect(hoy(day("pitido"))).toBe("Pendiente del pitido");
  });

  it("before, after and the acta", () => {
    expect(hoy(day("antes"))).toBe("19:00, Orduña fc");
    expect(hoy(day("final", { score: { gf: 3, ga: 1 } }))).toBe("Final, 3\u2060–\u20601");
    expect(hoy(day("pendiente"))).toBe("Pendiente del acta");
    expect(hoy(day("acta", { score: { gf: 3, ga: 1 } }))).toBe("3\u2060–\u20601, acta lista");
    expect(hoy(day("despues", { score: { gf: 2, ga: 2 } }))).toBe("2\u2060–\u20602, acta lista");
    expect(placeHints({ day: day("despues", { score: { gf: 3, ga: 1 } }), now: NOW, mvp: ["Alcides"] }).hoy).toBe("3\u2060–\u20601, MVP Alcides");
    expect(placeHints({ day: day("despues", { score: { gf: 3, ga: 1 } }), now: NOW, mvp: ["Alcides", "Kevin"] }).hoy).toBe("3\u2060–\u20601, MVP compartido");
  });

  it("called off, the week and the pre-season", () => {
    expect(hoy(day("aplazado", { match: m({ status: "postponed" }) }))).toBe("Aplazado");
    expect(hoy(day("aplazado", { match: m({ status: "postponed", postponedTo: madridMs(2027, 1, 14, 19) }) }))).toBe("Aplazado al 14 ene");
    expect(hoy(day("aplazado", { match: m({ status: "cancelled" }) }))).toBe("Suspendido");
    const j2 = m({ date: madridMs(2026, 10, 25, 14) });
    expect(hoy(day("semana", { match: j2 }))).toBe("Dom 25, 14:00");
    expect(hoy(day("semana", { match: m({ date: undefined }) }))).toBe("Fecha por confirmar");
    expect(hoy(day("semana", { match: null }))).toBe("Sin partidos a la vista");
    expect(hoy(day("pretemporada", { match: null }))).toBe("Pretemporada");
  });

  it("kickoffHint: today, tomorrow, a weekday", () => {
    expect(kickoffHint(KO, NOW)).toBe("Hoy, 19:00");
    expect(kickoffHint(KO, madridMs(2026, 10, 17, 23, 59))).toBe("Mañana, 19:00");
    expect(kickoffHint(madridMs(2026, 11, 4, 21), NOW)).toBe("Mié 4, 21:00");
  });
});

describe("placeHints · Temporada, Club and Tú", () => {
  const base = { day: day("semana"), now: NOW };

  it("the table as it is, or the season's count without one", () => {
    expect(placeHints({ ...base, table: { position: 1, points: 1, projected: false } }).temporada).toBe("1º con 1 punto");
    expect(placeHints({ ...base, table: { position: 6, points: 26, projected: false } }).temporada).toBe("6º con 26 puntos");
    expect(placeHints({ ...base, table: null, season: { played: 3, total: 6 } }).temporada).toBe("3 de 6 jornadas");
    expect(placeHints({ ...base, season: { played: 0, total: 6 } }).temporada).toBe("Empieza la temporada");
    expect(placeHints(base).temporada).toBe("Sin calendario todavía");
  });

  it("before tonight's whistle: «6º, J17 de 26», or «Empieza esta noche» on the first night", () => {
    const antes = { day: day("antes"), now: NOW };
    expect(placeHints({ ...antes, table: { position: 6, points: 26, projected: false }, season: { played: 15, total: 26, jornada: 17 } }).temporada).toBe("6º, J17 de 26");
    expect(placeHints({ ...antes, season: { played: 0, total: 6, jornada: 1 } }).temporada).toBe("Empieza esta noche");
    expect(placeHints({ day: day("antes", { kickoff: madridMs(2026, 10, 18, 12) }), now: NOW, season: { played: 0, total: 6 } }).temporada).toBe("Empieza hoy");
  });

  it("a birthday today, tomorrow or within a month; else the squad", () => {
    const b = (days: number) => [{ name: "Huberoski", days, label: "27 ene" }];
    expect(placeHints({ ...base, birthdays: b(0) }).club).toBe("Huberoski cumple hoy");
    expect(placeHints({ ...base, birthdays: b(1) }).club).toBe("Huberoski cumple mañana");
    expect(placeHints({ ...base, birthdays: b(31), squadSize: 16 }).club).toBe("16 en la plantilla");
    expect(placeHints(base).club).toBe("El club");
  });

  it("Tú only for a jugador", () => {
    expect(placeHints({ ...base, pending: 1 }).tu).toBe("1 cosa pendiente");
    expect(placeHints({ ...base, pending: 0 }).tu).toBe("Todo al día");
    expect(placeHints({ ...base, pending: null }).tu).toBeNull();
    expect(placeHints(base).tu).toBeNull();
  });
});
