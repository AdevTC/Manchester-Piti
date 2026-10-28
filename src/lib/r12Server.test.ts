// r12 · the server's pure rules for la Sala de control and la mesa (functions/src/matchExtrasLogic.ts and the
// additions to doorLogic, remindersLogic and pushLogic).
import { describe, expect, it } from "vitest";
import {
  actaPublishedAt,
  addGuestPlan,
  afterSeasonDeleted,
  baseRevision,
  citedIn,
  alreadyPromoted,
  draftFieldFollows,
  draftFollows,
  draftGuestFields,
  mentions,
  fold,
  MVP_REOPEN_MS,
  MVP_WINDOW_MS,
  mvpWindow,
  promoteInMatch,
  pruneVideoMarks,
  replaceRef,
  reportProblem,
  stillOpen,
  storedVideoMarks,
  videoMarksSchema,
} from "../../functions/src/matchExtrasLogic";
import { holderGone, outNotOnHisOwn, returningRole } from "../../functions/src/doorLogic";
import { captainNotice, remindNowKind, remindNowProblem } from "../../functions/src/remindersLogic";
import { cajaRejectedNotice, heldBefore, heldGoalNotice, noticesFor, THEIR_GOAL_HOLD_MS } from "../../functions/src/pushLogic";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 12);

describe("B-PAR-01 / B-ACTA-01 · the revisions of a match and its draft", () => {
  it("a match that is only a draft compares with the draft's revision (archiving moved it)", () => {
    expect(baseRevision({ exists: false }, { exists: true, revision: 2 })).toBe(2);
    expect(baseRevision({ exists: true, revision: 4 }, { exists: true, revision: 3 })).toBe(4);
    expect(baseRevision({ exists: false }, { exists: false })).toBe(0);
    expect(baseRevision({ exists: true }, { exists: false })).toBe(0);
  });
  it("a draft in step with the published match follows it; one behind stays behind", () => {
    expect(draftFollows(3, 3)).toBe(true);
    expect(draftFollows(undefined, undefined)).toBe(true);
    expect(draftFollows(4, 3)).toBe(false);
  });
});

describe("M-43 · las marcas del vídeo", () => {
  const events = [
    { id: "g1", type: "goal" },
    { id: "g2", type: "opponent_goal" },
    { id: "c1", type: "corner" },
  ];
  it("keep only the marks of goals still in the acta, whole seconds within 5 h", () => {
    expect(pruneVideoMarks({ g1: 120, g2: 900, c1: 30, gone: 10 }, events)).toEqual({ g1: 120, g2: 900 });
    expect(pruneVideoMarks({ g1: -1, g2: 18_001 }, events)).toEqual({});
    expect(pruneVideoMarks(undefined, events)).toEqual({});
  });
  it("the schema: at most 60, ids of plays, never a bad one", () => {
    expect(videoMarksSchema.safeParse({ "live-a_1": 5 }).success).toBe(true);
    expect(videoMarksSchema.safeParse({ "a/b": 5 }).success).toBe(false);
    expect(videoMarksSchema.safeParse({ g1: 1.5 }).success).toBe(false);
    expect(videoMarksSchema.safeParse(Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`g${i}`, i]))).success).toBe(false);
    expect(storedVideoMarks("x")).toBeUndefined();
    expect(storedVideoMarks({ g1: 3 })).toEqual({ g1: 3 });
  });
});

describe("M-11 · el MVP a mano", () => {
  const published = { status: "finished", voteClosesAt: NOW + 40 * HOUR };
  it("the publication: its stamp, else the MVP window's start, else now", () => {
    expect(actaPublishedAt({ actaPublishedAt: 5 }, NOW)).toBe(5);
    expect(actaPublishedAt({ voteClosesAt: NOW + 40 * HOUR }, NOW)).toBe(NOW + 40 * HOUR - MVP_WINDOW_MS);
    expect(actaPublishedAt(null, NOW)).toBe(NOW);
  });
  it("«Cerrar ya» closes it now; a closed one can't be closed again", () => {
    expect(mvpWindow("close", published, NOW)).toEqual({ voteClosesAt: NOW });
    expect(mvpWindow("close", { ...published, voteClosesAt: NOW - 1 }, NOW)).toEqual({ problem: "La votación ya está cerrada." });
  });
  it("«Reabrir 24 h» gives it 24 h from now, within the 7 days of the publication", () => {
    expect(mvpWindow("reopen", { ...published, voteClosesAt: NOW - HOUR }, NOW)).toEqual({ voteClosesAt: NOW + MVP_REOPEN_MS });
    // (an open vote is never shortened)
    expect(mvpWindow("reopen", published, NOW)).toEqual({ voteClosesAt: NOW + 40 * HOUR });
    expect(mvpWindow("reopen", { ...published, voteClosesAt: NOW + HOUR }, NOW)).toEqual({ voteClosesAt: NOW + MVP_REOPEN_MS });
    expect(mvpWindow("reopen", { status: "finished", voteClosesAt: NOW - 6 * 24 * HOUR, actaPublishedAt: NOW - 8 * 24 * HOUR }, NOW)).toEqual({ problem: "Ya no se puede reabrir: pasaron los 7 días del partido." });
  });
  it("nothing before the acta is published", () => {
    expect(mvpWindow("close", { status: "scheduled" }, NOW)).toHaveProperty("problem");
    expect(mvpWindow("reopen", { status: "finished", voteClosesAt: null }, NOW)).toHaveProperty("problem");
  });
});

describe("M-38 · la crónica corta del anotador", () => {
  const base = { isAdmin: false, report: "Remontada a lo City.", current: "", currentBy: undefined, mine: undefined, uid: "u1", publishedAt: NOW - HOUR, now: NOW };
  it("a scorer writes it over an empty one, and changes his own text", () => {
    expect(reportProblem(base)).toBeNull();
    expect(reportProblem({ ...base, current: "Lo mío", currentBy: "u1", mine: "Lo mío" })).toBeNull();
  });
  it("never over a crónica that is not exactly his (a captain rewrote it, even if reportBy still says him)", () => {
    expect(reportProblem({ ...base, current: "Del capitán", currentBy: "cap" })).toMatch(/capitán/);
    expect(reportProblem({ ...base, current: "Reescrita por el capitán", currentBy: "u1", mine: "Lo mío" })).toMatch(/capitán/);
    expect(reportProblem({ ...base, current: "Lo mío", currentBy: "u1", mine: undefined })).toMatch(/capitán/);
  });
  it("only within the 48 h after the publication, and at most 220 letters; a captain always", () => {
    expect(reportProblem({ ...base, publishedAt: NOW - 49 * HOUR })).toMatch(/plazo/);
    expect(reportProblem({ ...base, report: "x".repeat(221) })).toMatch(/220/);
    expect(reportProblem({ ...base, isAdmin: true, report: "x".repeat(5000), current: "Otro", currentBy: "u9", publishedAt: 0 })).toBeNull();
  });
});

describe("M-48 · un invitado desde la mesa", () => {
  const m = { guests: [{ id: "g1", name: "Rafa" }], starters: ["a"], bench: ["b"], present: ["a", "b"] };
  it("a new one takes the first free id and goes to the bench and the roll call", () => {
    expect(addGuestPlan(m, "  José  Luis ")).toEqual({
      guest: { id: "g2", name: "José Luis" },
      created: true,
      guests: [{ id: "g1", name: "Rafa" }, { id: "g2", name: "José Luis" }],
      bench: ["b", "guest:g2"],
      present: ["a", "b", "guest:g2"],
    });
  });
  it("the same name (case and accents aside) is the one already there", () => {
    const again = addGuestPlan({ ...m, bench: ["b", "guest:g1"] }, "rafá");
    expect(again).toMatchObject({ guest: { id: "g1" }, created: false, bench: ["b", "guest:g1"] });
    expect(fold("  Rafá ")).toBe("rafa");
  });
  it("at most four, and a name of 1–30 letters", () => {
    const full = { guests: ["g1", "g2", "g3", "g4"].map((id) => ({ id, name: id })) };
    expect(addGuestPlan(full, "Otro")).toEqual({ problem: "Como mucho 4 invitados por partido." });
    expect(addGuestPlan(m, " ")).toHaveProperty("problem");
    expect(addGuestPlan(m, "x".repeat(31))).toHaveProperty("problem");
  });
  it("la mesa changes a match still to be played or being played, not after the whistle", () => {
    expect(stillOpen({ status: "scheduled", clock: { phase: "second" } })).toBe(true);
    expect(stillOpen({ status: "scheduled", clock: { phase: "ended" } })).toBe(false);
    expect(stillOpen({ status: "scheduled", liveEndedAt: 1 })).toBe(false);
    expect(stillOpen({ status: "finished" })).toBe(false);
  });
});

describe("B-CLUB-05 · borrar una ficha", () => {
  const matches = [
    { id: "j1", label: "la J1", starters: ["a"], bench: [], notCalled: ["n"], events: [{ playerId: "x", assistPlayerId: "as" }], ledger: { l: {} } },
    { id: "j2", label: "la J2", events: [{ inPlayerId: "in" }, { receiverId: "r" }] },
  ];
  it("finds the first acta that cites it, in any field", () => {
    for (const [id, where] of [["a", "la J1"], ["n", "la J1"], ["as", "la J1"], ["l", "la J1"], ["in", "la J2"], ["r", "la J2"]]) expect(citedIn(id, matches)).toBe(where);
    expect(citedIn("nadie", matches)).toBeNull();
  });
});

describe("B-CLUB-01 · eliminar una temporada", () => {
  it("the season leaves his seasons; he stays archived only while all he has left is archived", () => {
    expect(afterSeasonDeleted(["t0"], "t0", new Set())).toEqual({ seasons: [], archived: false });
    expect(afterSeasonDeleted(["t0", "t1"], "t0", new Set())).toEqual({ seasons: ["t1"], archived: false });
    expect(afterSeasonDeleted(["t0", "tA"], "t0", new Set(["tA"]))).toEqual({ seasons: ["tA"], archived: true });
  });
});

describe("M-41 · un invitado pasa a su ficha", () => {
  const match = {
    guests: [{ id: "g1", name: "Rafa" }, { id: "g2", name: "Leo" }],
    starters: ["a", "guest:g1"],
    bench: ["guest:g2"],
    events: [{ id: "e1", type: "goal", playerId: "guest:g1", assistPlayerId: "a" }],
    analysis: { observations: [{ playerRef: "guest:g1", text: "guest:g1 no es esto" }], byPlayer: { "guest:g1": 2 } },
    present: ["a", "guest:g1"],
  };
  it("every reference to him becomes the ficha (lists, plays, analysis keys and values), off the guest list", () => {
    const out = promoteInMatch(match, "g1", "p9");
    expect(out).toMatchObject({
      guests: [{ id: "g2", name: "Leo" }],
      starters: ["a", "p9"],
      bench: ["guest:g2"],
      events: [{ id: "e1", type: "goal", playerId: "p9", assistPlayerId: "a" }],
      analysis: { observations: [{ playerRef: "p9", text: "guest:g1 no es esto" }], byPlayer: { p9: 2 } },
      present: ["a", "p9"],
    });
  });
  it("a guest who is not there any more", () => {
    expect(promoteInMatch(match, "g3", "p9")).toEqual({ problem: "Ese invitado ya no está en el partido." });
  });
  it("replaceRef leaves timestamps and other values alone", () => {
    const ts = { toMillis: () => 1, seconds: 0 };
    expect(replaceRef({ at: ts, n: 3, s: "guest:g1x" }, "guest:g1", "p")).toEqual({ at: ts, n: 3, s: "guest:g1x" });
  });
});

describe("M-13 · B-CLUB-02/03 · quitar el acceso", () => {
  it("a ficha linked to someone removed (or without a profile) is free", () => {
    expect(holderGone({ exists: true, uid: "u1", removedAt: { seconds: 1 }, removedBy: "cap" })).toBe(true);
    // (gone on his own, or removed before the stamp existed: his ficha stays his)
    expect(holderGone({ exists: true, uid: "u1", removedAt: { seconds: 1 }, removedBy: "u1" })).toBe(false);
    expect(holderGone({ exists: true, uid: "u1", removedAt: { seconds: 1 } })).toBe(false);
    expect(holderGone({ exists: false })).toBe(false);
    expect(holderGone({ exists: true })).toBe(false);
    expect(holderGone(null)).toBe(false);
  });
  it("the role is kept only by who clearly left on his own; a removal without the stamp comes back as a socio", () => {
    const at = { seconds: 1 };
    expect(outNotOnHisOwn({ exists: true, uid: "u1", removedAt: at, removedBy: "u1" })).toBe(false);
    expect(outNotOnHisOwn({ exists: true, uid: "u1", removedAt: at, removedBy: "cap" })).toBe(true);
    // B-CLUB-03 with old data: a captain removed before r12 (no stamp) never walks back in as one
    expect(outNotOnHisOwn({ exists: true, uid: "u1", removedAt: at })).toBe(true);
    expect(returningRole("admin", outNotOnHisOwn({ exists: true, uid: "u1", removedAt: at }))).toBe("user");
    // (but his ficha stays his: only a captain's stamped removal frees it)
    expect(holderGone({ exists: true, uid: "u1", removedAt: at })).toBe(false);
    expect(outNotOnHisOwn({ exists: true, uid: "u1" })).toBe(false);
  });
  it("whoever comes back after being removed comes back as a socio (the superadmin keeps his)", () => {
    expect(returningRole("admin", true)).toBe("user");
    expect(returningRole("admin", false)).toBe("admin");
    expect(returningRole("superadmin", true)).toBe("superadmin");
    expect(returningRole(undefined, true)).toBeUndefined();
  });
});

describe("M-07 · «Recordar ahora» y M-18 · el aviso a mano", () => {
  const m = { status: "scheduled", date: NOW + 30 * HOUR, starters: ["a"], bench: [] as string[] };
  it("only a match still to play, with a convocatoria and someone left to answer", () => {
    expect(remindNowProblem(m, 2, NOW)).toBeNull();
    expect(remindNowProblem({ ...m, date: NOW - 1 }, 2, NOW)).toMatch(/ya no se juega/);
    expect(remindNowProblem({ ...m, status: "postponed" }, 2, NOW)).toMatch(/ya no se juega/);
    expect(remindNowProblem({ ...m, starters: [] }, 2, NOW)).toMatch(/convocatoria/);
    expect(remindNowProblem(m, 0, NOW)).toMatch(/contestaron todos/);
  });
  it("the 24 h words inside the last day, the 48 h ones before", () => {
    expect(remindNowKind(NOW + 23 * HOUR, NOW)).toBe("24");
    expect(remindNowKind(NOW + 30 * HOUR, NOW)).toBe("48");
  });
  it("the captain's notice", () => {
    expect(captainNotice("Mañana cambiamos de campo", "/vestuario", NOW)).toEqual({ topic: "personal", title: "Aviso de la capitanía", body: "Mañana cambiamos de campo", tag: `manual-${NOW}`, url: "/vestuario" });
  });
});

describe("M-33 · el aviso del gol del rival espera a «Deshacer»", () => {
  const live = { rival: "Orduña fc", status: "scheduled", clock: { phase: "first" }, events: [] as { id: string; type: string; minute?: number; playerId?: string }[] };
  const theirs = { ...live, events: [{ id: "o1", type: "opponent_goal", minute: 12 }] };
  it("the rival's goal is held THEIR_GOAL_HOLD_MS; ours goes at once", () => {
    const [n] = noticesFor("j3", live, theirs, () => "", NOW);
    expect(n.holdFor).toEqual({ ms: THEIR_GOAL_HOLD_MS, eventId: "o1" });
    expect(THEIR_GOAL_HOLD_MS).toBeGreaterThanOrEqual(8000);
    const [ours] = noticesFor("j3", live, { ...live, events: [{ id: "g1", type: "goal", minute: 3, playerId: "p" }] }, () => "ERIK", NOW);
    expect(ours.holdFor).toBeUndefined();
  });
  it("after the wait: the notice with the score then; nothing if undone, deleted or the whistle went", () => {
    expect(heldGoalNotice("j3", theirs, "o1", () => "")).toMatchObject({ topic: "goals", title: "Gol de Orduña fc", log: "goal-j3-o1" });
    expect(heldGoalNotice("j3", live, "o1", () => "")).toBeNull();
    // the whistle during the wait: the goal was written before it, so it is told
    expect(heldGoalNotice("j3", { ...theirs, clock: { phase: "ended" } }, "o1", () => "")).toMatchObject({ title: "Gol de Orduña fc" });
    // the acta published meanwhile: «Final» told the score
    expect(heldGoalNotice("j3", { ...theirs, status: "finished" }, "o1", () => "")).toBeNull();
    expect(heldGoalNotice("j3", { ...theirs, archived: true }, "o1", () => "")).toBeNull();
    expect(heldGoalNotice("j3", undefined, "o1", () => "")).toBeNull();
  });
  it("undone within the wait: no «Gol anulado» either (it needs its goal's notice to have gone)", () => {
    const off = noticesFor("j3", theirs, live, () => "", NOW);
    expect(off).toHaveLength(1);
    expect(off[0].requires).toBe("goal-j3-o1");
  });
});

describe("M-20 · el motivo al rechazar un pago", () => {
  it("tells the member once, with the reason, only on pendiente → rechazado", () => {
    expect(cajaRejectedNotice("c1", { status: "pendiente" }, { status: "rechazado", amount: 2500, concept: "Cuota", reason: "No me ha llegado el Bizum" })).toEqual({
      topic: "personal",
      title: "Tu aviso de pago no se ha confirmado",
      body: "25,00 € · Cuota. «No me ha llegado el Bizum».",
      tag: "cajaclaim-c1",
      url: "/vestuario/caja",
      log: "cajaclaim-no-c1",
    });
    expect(cajaRejectedNotice("c1", { status: "pendiente" }, { status: "rechazado", amount: 2500 })?.body).toBe("25,00 €. Habla con la capitanía.");
    expect(cajaRejectedNotice("c1", { status: "pendiente" }, { status: "confirmado" })).toBeNull();
    expect(cajaRejectedNotice("c1", { status: "rechazado" }, { status: "rechazado", reason: "x" })).toBeNull();
  });
});

describe("r12 · revisión: el borrador encima, el invitado, la ficha", () => {
  it("a draft field follows the published one only when it still held the same value, or nothing", () => {
    expect(draftFieldFollows("Lo mismo", "Lo mismo")).toBe(true);
    expect(draftFieldFollows(undefined, "x")).toBe(true);
    expect(draftFieldFollows("", "x")).toBe(true);
    expect(draftFieldFollows({}, { g1: 3 })).toBe(true);
    expect(draftFieldFollows({ b: 1, a: 2 }, { a: 2, b: 1 })).toBe(true);
    expect(draftFieldFollows("Su crónica en el borrador", "La publicada")).toBe(false);
    expect(draftFieldFollows(60, 50)).toBe(false);
  });
  it("a new guest takes an id free on both copies; the draft gets only him, never its list replaced", () => {
    expect(addGuestPlan({ guests: [{ id: "g1", name: "Rafa" }] }, "Leo", ["g1", "g2"])).toMatchObject({ guest: { id: "g3", name: "Leo" }, created: true });
    const draft = { guests: [{ id: "g1", name: "Rafa" }, { id: "g2", name: "Toni" }], bench: ["b"] };
    expect(draftGuestFields(draft, { id: "g3", name: "Leo" })).toEqual({ guests: [...draft.guests, { id: "g3", name: "Leo" }], bench: ["b", "guest:g3"] });
    expect(draftGuestFields(draft, { id: "g2", name: "Otro" })).toBeNull();
    expect(draftGuestFields({ guests: [{ id: "g1", name: "Rafa" }], starters: ["guest:g1"] }, { id: "g1", name: "rafa" })).toEqual({ guests: [{ id: "g1", name: "Rafa" }] });
    expect(addGuestPlan({ guests: [{ id: "g1", name: "A" }] }, "B", ["g2", "g3", "g4"])).toHaveProperty("problem");
  });
  it("mentions: any string or key that is the id, anywhere", () => {
    expect(mentions({ lineup: { slots: [{ playerId: "p1" }] } }, "p1")).toBe(true);
    expect(mentions({ notas: { players: { p1: { nota: 6 } } } }, "p1")).toBe(true);
    expect(mentions({ s: "p10", n: 1 }, "p1")).toBe(false);
  });
  it("a promotion retried: the matches already done are recognised", () => {
    expect(alreadyPromoted({ guests: [], starters: ["p9"] }, "g1", "p9")).toBe(true);
    expect(alreadyPromoted({ guests: [{ id: "g1", name: "Rafa" }], starters: ["guest:g1"] }, "g1", "p9")).toBe(false);
    expect(alreadyPromoted({ guests: [], starters: ["a"] }, "g1", "p9")).toBe(false);
  });
  it("M-33: the rival goals still waiting before a goal told now, or before the whistle, each with its own score", () => {
    const m = {
      status: "scheduled",
      rival: "Orduña fc",
      events: [
        { id: "old", type: "opponent_goal", elapsedSeconds: 100 },
        { id: "o1", type: "opponent_goal", elapsedSeconds: 2900 },
        { id: "g1", type: "goal", elapsedSeconds: 2905, playerId: "p" },
        { id: "o2", type: "own_goal", elapsedSeconds: 2950 },
      ],
    };
    expect(heldBefore(m, "g1")).toEqual(["o1"]);
    expect(heldBefore(m, null)).toEqual(["o1", "o2"]);
    expect(heldGoalNotice("j3", m, "o1", () => "")?.body).toMatch(/Piti 0, Orduña fc 2/);
    expect(heldGoalNotice("j3", m, "o2", () => "ERIK")?.body).toMatch(/Piti 1, Orduña fc 3/);
  });
});
