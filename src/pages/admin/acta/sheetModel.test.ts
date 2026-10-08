import { describe, expect, it } from "vitest";
import { reviewActa } from "../data/adminLogic";
import {
  addOurGoal,
  addRivalGoal,
  changeSeason,
  fromMatch,
  goalRows,
  isSheet,
  lastOurGoal,
  okHttps,
  otherEvents,
  removeEvent,
  restoreSheet,
  reviewSheet,
  rivalInitialsOf,
  rivalRows,
  score,
  setAssist,
  setMinute,
  setScorer,
  sig,
  toPayload,
  upsertEvent,
  type MatchSheet,
} from "./sheetModel";

const NOW = Date.UTC(2026, 10, 2, 9, 0);
const KICKOFF = Date.UTC(2026, 10, 1, 9, 0);
const SEVEN = ["evans", "illescas", "tello", "eguzquiza", "huberoski", "erik", "adrian"];
const BENCH = ["kevin", "almachi", "andia", "fer", "brawan"];
const ROSTER = [...SEVEN, ...BENCH];
const names: Record<string, string> = { adrian: "ADRIÁN T.C.", erik: "ERIK", huberoski: "HUBEROSKI", kevin: "KEVIN", tello: "TELLO", eguzquiza: "EGUZQUIZA" };
const nameOf = (id: string | undefined) => (id ? (names[id] ?? id) : "—");

/** The J7 draft: 3–1, two goals named, one still without scorer, the rival goal at 18′. */
const j7 = () =>
  fromMatch({
    seasonId: "t1",
    rival: "FUSION 7",
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
    ],
  });
const review = (s: MatchSheet) => reviewActa(reviewSheet(s), ROSTER, NOW);

describe("the acta's sheet model", () => {
  it("opens the goals the stored score counts but the events don't name", () => {
    const s = j7();
    expect(score(s)).toEqual({ gf: 3, ga: 1 });
    const rows = goalRows(s);
    expect(rows.map((r) => [r.n, r.scorer, r.assist, r.open])).toEqual([
      [1, "adrian", "huberoski", false],
      [2, "adrian", "erik", false],
      [3, null, null, true],
    ]);
    expect(rows[2].id).toBe("open-g0");
    expect(rivalRows(s)).toEqual([{ id: "r1", n: 1, minute: 18, own: false, playerId: null }]);
    // the stored rival goals beyond the events open too (without minute)
    const legacy = fromMatch({ seasonId: "t1", rival: "X", date: KICKOFF, goalsFor: 0, goalsAgainst: 2, events: [] });
    expect(legacy.status).toBe("finished");
    expect(rivalRows(legacy).map((r) => [r.id, r.minute])).toEqual([
      ["open-r0", undefined],
      ["open-r1", undefined],
    ]);
  });

  it("normalises like the old editor: millis date, ids on every event, defaults", () => {
    const s = fromMatch({ seasonId: "t1", rival: "R", date: { seconds: 1_800_000_000 }, events: [{ id: "", type: "yellow_card", minute: 3, playerId: "erik" }] });
    expect(s.date).toBe(1_800_000_000_000);
    expect(s.events[0].id).toBe("legacy-0");
    expect(s.status).toBe("scheduled");
    expect(s).toMatchObject({ competition: "Liga", duration: 60, home: true, kit: "home", starters: [], report: "", gallery: [], meetingNote: "" });
    expect(fromMatch({ meetingNote: "Quedada 9:15" }, "otra").meetingNote).toBe("Quedada 9:15");
    expect(fromMatch({}, "Quedada privada").meetingNote).toBe("Quedada privada");
  });

  it("the score is always the goals written down", () => {
    let s = j7();
    const added = addOurGoal(s, "goal", "g4");
    s = added.sheet;
    expect(score(s)).toEqual({ gf: 4, ga: 1 });
    expect(lastOurGoal(s)?.id).toBe("g4");
    s = removeEvent(s, "g4");
    s = addRivalGoal(s, "r2").sheet;
    expect(score(s)).toEqual({ gf: 3, ga: 2 });
    // an own goal of ours counts for them; a rival own goal for us
    s = upsertEvent(s, { id: "og", type: "own_goal", minute: 40, playerId: "tello" });
    expect(score(s).ga).toBe(3);
    s = setScorer(s, "open-g0", "og");
    expect(goalRows(s)[2]).toMatchObject({ kind: "og", scorer: null, open: false });
    expect(score(s).gf).toBe(3);
  });

  it("scorer, then assist; a new scorer asks the assist again; og drops both", () => {
    let s = setMinute(j7(), "open-g0", "4a6");
    expect(goalRows(s)[2].minute).toBe(46);
    s = setScorer(s, "open-g0", "huberoski");
    expect(goalRows(s)[2]).toMatchObject({ scorer: "huberoski", assist: null, open: false, minute: 46 });
    s = setAssist(s, "open-g0", "erik");
    expect(goalRows(s)[2].assist).toBe("erik");
    s = setScorer(s, "open-g0", "erik");
    expect(goalRows(s)[2].assist).toBeNull();
    s = setAssist(s, "open-g0", "erik");
    expect(goalRows(s)[2].assist).toBeNull(); // nobody assists themselves
    s = setMinute(s, "g1", "");
    expect(goalRows(s)[0].minute).toBeUndefined();
  });

  it("other events, by minute; changing the season empties lineup and events", () => {
    let s = upsertEvent(j7(), { id: "c1", type: "substitution", minute: 30, playerId: "tello", inPlayerId: "kevin" });
    s = upsertEvent(s, { id: "y1", type: "yellow_card", minute: 22, playerId: "eguzquiza" });
    expect(otherEvents(s).map((e) => e.id)).toEqual(["y1", "c1"]);
    s = upsertEvent(s, { id: "y1", type: "yellow_card", minute: 23, playerId: "eguzquiza", note: "" });
    expect(otherEvents(s)[0]).toEqual({ id: "y1", type: "yellow_card", minute: 23, playerId: "eguzquiza" });
    const moved = changeSeason(s, "t2");
    expect(moved).toMatchObject({ seasonId: "t2", starters: [], bench: [], notCalled: [], events: [] });
    expect(score(moved)).toEqual({ gf: 0, ga: 0 });
  });

  it("the review counts an open goal as a missing scorer (not as a ledger error) and squares once named", () => {
    const r = review(j7());
    expect(r.cuadra).toBe(false);
    expect(r.missingScorers).toBe(1);
    expect(r.firstMissingGoal).toBe(3);
    expect(r.ledgerErrors).toEqual([]);
    expect(r.reasons).toEqual(["falta el goleador del gol 3"]);
    const done = setScorer(setMinute(j7(), "open-g0", "46"), "open-g0", "huberoski");
    const ok = review(done);
    expect(ok.cuadra).toBe(true);
    expect(ok.items.find((i) => i.key === "goles")?.title).toBe("Goles: 3 en el marcador, 3 con nombre");
  });

  it("a named goal without minute, or a rival goal without minute, doesn't square", () => {
    const noMin = setScorer(j7(), "open-g0", "huberoski");
    expect(review(noMin).ledgerErrors).toEqual(["Indica un minuto válido para cada evento."]);
    const rival = addRivalGoal(setScorer(setMinute(j7(), "open-g0", "46"), "open-g0", "huberoski"), "r2").sheet;
    const r = review(rival);
    expect(r.cuadra).toBe(false);
    expect(r.reasons[0]).toBe("goles de FUSION 7: 2 en el marcador, 1 apuntados");
  });

  it("a suplente who never came on can't score (the ledger says so)", () => {
    const s = setScorer(setMinute(j7(), "open-g0", "46"), "open-g0", "kevin");
    expect(review(s).ledgerErrors).toEqual(["Minuto 46: el jugador no está disponible en el campo."]);
    const subbed = upsertEvent(s, { id: "c1", type: "substitution", minute: 30, playerId: "tello", inPlayerId: "kevin" });
    expect(review(subbed).cuadra).toBe(true);
  });
});

describe("toPayload (what saveMatchSheet receives)", () => {
  it("a draft keeps the score and drops what the backend can't store yet", () => {
    const s = addRivalGoal(j7(), "r2").sheet;
    const p = toPayload(s, true, nameOf);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.sheet.goalsFor).toBe(3);
    expect(p.sheet.goalsAgainst).toBe(2);
    expect(p.sheet.events.map((e) => e.id)).toEqual(["g1", "g2", "r1"]);
    // reopening the saved draft gives the same rows back
    const again = fromMatch(p.sheet);
    expect(goalRows(again).map((r) => r.open)).toEqual([false, false, true]);
    expect(rivalRows(again)).toHaveLength(2);
  });

  it("a draft keeps an open goal's minute (as a goal without scorer)", () => {
    const p = toPayload(setMinute(j7(), "open-g0", "46"), true, nameOf);
    expect(p.ok && p.sheet.events.at(-1)).toEqual({ id: "open-g0", type: "goal", minute: 46 });
    if (!p.ok) return;
    const back = fromMatch(p.sheet);
    expect(goalRows(back)[2]).toMatchObject({ id: "open-g0", minute: 46, open: true });
    expect(score(back).gf).toBe(3);
  });

  it("refuses what the backend would refuse, in words", () => {
    expect(toPayload({ ...j7(), rival: " " }, true, nameOf)).toEqual({ ok: false, error: "Completa temporada, rival y fecha." });
    expect(toPayload({ ...j7(), photoUrl: "http://x.jpg" }, true, nameOf)).toMatchObject({ ok: false, error: "La foto del partido tiene que ser un enlace https://." });
    expect(toPayload({ ...j7(), gallery: ["https://a.jpg", "ftp://b"] }, true, nameOf)).toMatchObject({ ok: false });
    expect(toPayload({ ...j7(), rivalLogoUrl: "logo.png" }, true, nameOf)).toMatchObject({ ok: false, error: "El escudo del rival tiene que ser un enlace https://." });
    expect(toPayload({ ...j7(), duration: NaN }, true, nameOf)).toMatchObject({ ok: false, error: "La duración va de 1 a 150 minutos." });
    const noMin = setScorer(j7(), "open-g0", "huberoski");
    expect(toPayload(noMin, true, nameOf)).toEqual({ ok: false, error: "Pon el minuto del gol 3 (HUBEROSKI).", eventId: "open-g0" });
    expect(toPayload(j7(), false, nameOf)).toMatchObject({ ok: false, error: "Falta el goleador del gol 3." });
    const card = upsertEvent(j7(), { id: "y", type: "yellow_card", playerId: "erik" });
    expect(toPayload(setScorer(setMinute(card, "open-g0", "46"), "open-g0", "erik"), true, nameOf)).toMatchObject({ ok: false, error: "Pon el minuto de «Amarilla · ERIK»." });
  });

  it("publishes only the schema's fields, trimmed", () => {
    const s = setScorer(setMinute({ ...j7(), rival: " FUSION 7 ", venue: " Campo ", rivalInitials: "fu7" }, "open-g0", "46"), "open-g0", "huberoski");
    const p = toPayload({ ...s, id: "m7", voteClosesAt: 1 } as MatchSheet, false, nameOf);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.sheet).not.toHaveProperty("id");
    expect(p.sheet).not.toHaveProperty("voteClosesAt");
    expect(p.sheet).toMatchObject({ rival: "FUSION 7", venue: "Campo", rivalInitials: "FU7", goalsFor: 3, goalsAgainst: 1, version: 2 });
  });
});

describe("helpers", () => {
  it("sig ignores key order and undefined", () => {
    expect(sig({ b: 1, a: [{ y: 2, x: undefined }] })).toBe(sig({ a: [{ y: 2 }], b: 1 }));
    expect(sig({ d: NaN })).not.toBe(sig({ d: null }));
  });
  it("https links", () => {
    expect(okHttps("")).toBe(true);
    expect(okHttps("https://x.es/a.jpg")).toBe(true);
    expect(okHttps("http://x.es/a.jpg")).toBe(false);
    expect(okHttps("https://")).toBe(false);
  });
  it("initials: the written ones, else automatic", () => {
    expect(rivalInitialsOf({ rival: "Fusion 7", rivalInitials: "" })).toBe(rivalInitialsOf({ rival: "Fusion 7" }));
    expect(rivalInitialsOf({ rival: "Fusion 7", rivalInitials: "f7" })).toBe("F7");
  });
  it("recognises a stored sheet, and restores its date", () => {
    const stored: unknown = JSON.parse(JSON.stringify({ ...j7(), date: NaN }));
    expect(isSheet(stored)).toBe(true);
    expect(isSheet({ version: 2 })).toBe(false);
    if (isSheet(stored)) expect(Number.isNaN(restoreSheet(stored).date)).toBe(true);
  });
});
