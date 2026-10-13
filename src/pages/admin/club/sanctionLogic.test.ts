import { describe, expect, it } from "vitest";
import type { PlayerDoc } from "../../../lib/schemas";
import type { AdminMatch } from "../data/adminLogic";
import { checkSanction, liftedDoc, liftWrite, sanctionedDoc, sanctionForm, sanctionStatus, sanctionToast, sanctionWrite, seasonSuspensions, untilLabel, upcomingFor } from "./sanctionLogic";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const match = (id: string, jornada: number, d: number, status: AdminMatch["status"], o: Partial<AdminMatch> = {}): AdminMatch => ({
  id,
  seasonId: "t1",
  rival: `Rival ${jornada}`,
  date: NOW + d * DAY,
  status,
  jornada,
  draft: false,
  published: true,
  ...o,
});
const CAL: AdminMatch[] = [
  match("j1", 1, -14, "finished", { events: [{ id: "r", type: "red_card", minute: 30, playerId: "rojo" }] }),
  match("j2", 2, -7, "finished"),
  match("j3", 3, -1, "finished", { events: [{ id: "r2", type: "red_card", minute: 12, playerId: "expulsado" }] }),
  match("j4", 4, 6, "scheduled", { rival: "MAD SKY" }),
  match("j5", 5, 13, "cancelled"),
  match("j6", 6, 20, "scheduled"),
  match("jx", 9, 8, "scheduled", { seasonId: "t2" }),
  match("jd", 7, 27, "scheduled", { published: false }),
];
const doc = (id: string, o: Partial<PlayerDoc> = {}): PlayerDoc => ({ id, shirtName: id.toUpperCase(), seasons: ["t1"], ...o });

describe("sanciones en la plantilla", () => {
  it("who is out in the season: the last acta's red card and a sanction by hand (not other seasons, not drafts)", () => {
    const s = seasonSuspensions(CAL, "t1", [doc("rojo"), doc("expulsado"), doc("fede", { sanction: { games: 2, from: NOW - 3 * DAY, reason: "Federación" } })]);
    expect([...s.keys()].sort()).toEqual(["expulsado", "fede"]);
    expect(s.get("expulsado")).toEqual({ left: 1, source: "acta" });
    // j3 was played after it was set: one of two served
    expect(s.get("fede")).toEqual({ left: 1, source: "manual", reason: "Federación" });
    // lifted after the red: nobody
    expect(seasonSuspensions(CAL, "t1", [doc("expulsado", { sanctionClearedAt: NOW })]).size).toBe(0);
  });

  it("«hasta la J…» offers the season's published matches still to play, in order", () => {
    const up = upcomingFor(CAL, "t1", NOW);
    expect(up.map((m) => m.id)).toEqual(["j4", "j6"]);
    expect(untilLabel(up[0])).toMatch(/^J4 · MAD SKY · \S+ 8 nov$/);
    expect(sanctionForm(up)).toEqual({ mode: "games", games: "1", untilId: "j4", reason: "" });
    expect(sanctionForm([]).untilId).toBe("");
  });

  it("checks the form: 1 to 10 matches, a match of the list, a reason up to 80", () => {
    const up = upcomingFor(CAL, "t1", NOW);
    const f = sanctionForm(up);
    expect(checkSanction({ ...f, games: "2", reason: "  Federación " }, up)).toEqual({ ok: true, choice: { games: 2, untilMatchId: null, reason: "Federación" } });
    expect(checkSanction(f, up)).toEqual({ ok: true, choice: { games: 1, untilMatchId: null, reason: null } });
    for (const games of ["0", "11", "1.5", "", "dos"]) expect(checkSanction({ ...f, games }, up)).toEqual({ ok: false, error: "Entre 1 y 10 partidos." });
    expect(checkSanction({ ...f, reason: "x".repeat(81) }, up)).toEqual({ ok: false, error: "El motivo, como mucho 80 letras." });
    // until the J6: the J4 and the J6 (two matches to play)
    expect(checkSanction({ ...f, mode: "until", untilId: "j6" }, up)).toEqual({ ok: true, choice: { games: 2, untilMatchId: "j6", reason: null } });
    expect(checkSanction({ ...f, mode: "until", untilId: "jx" }, up)).toEqual({ ok: false, error: "Elige hasta qué partido." });
  });

  it("the write (nulls for what is not set), the doc shown meanwhile and the lift", () => {
    const w = sanctionWrite({ games: 2, untilMatchId: null, reason: "Federación" }, NOW, "a1");
    expect(w).toEqual({ games: 2, from: NOW, untilMatchId: null, reason: "Federación", by: "a1" });
    expect(sanctionedDoc(doc("p"), w).sanction).toEqual({ games: 2, from: NOW, by: "a1", reason: "Federación" });
    expect(liftWrite(NOW)).toEqual({ sanction: null, sanctionClearedAt: NOW });
    const lifted = liftedDoc(doc("p", { sanction: { games: 1, from: 1 } }), NOW);
    expect(lifted.sanction).toBeUndefined();
    expect(lifted.sanctionClearedAt).toBe(NOW);
  });

  it("speaks: the toast and the ficha's line", () => {
    expect(sanctionToast("ERIK", { games: 2, untilMatchId: null, reason: null }, CAL)).toBe("ERIK, sancionado 2 partidos");
    expect(sanctionToast("ERIK", { games: 1, untilMatchId: null, reason: "Federación" }, CAL)).toBe("ERIK, sancionado 1 partido · Federación");
    expect(sanctionToast("ERIK", { games: 2, untilMatchId: "j6", reason: null }, CAL)).toBe("ERIK, sancionado hasta la J6");
    expect(sanctionStatus({ left: 2, source: "manual", untilMatchId: "j6", reason: "Federación" }, CAL)).toBe("Sancionado · quedan 2 partidos (hasta la J6) · Federación");
    expect(sanctionStatus({ left: 1, source: "acta" }, CAL)).toBe("Sancionado · queda 1 partido · por expulsión");
    expect(sanctionStatus({ left: 3, source: "manual" }, CAL)).toBe("Sancionado · quedan 3 partidos");
  });
});
