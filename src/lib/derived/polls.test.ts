import { describe, expect, it } from "vitest";
import {
  POLL_CLOSE_MARGIN_MS,
  POLL_KEEP_MS,
  canManagePoll,
  closesText,
  isPollOpen,
  isPollVisible,
  joinEs,
  myChoiceText,
  openPollsBy,
  outcomeText,
  parsePoll,
  parsePollVote,
  pollEndedAt,
  pollFields,
  pollFormProblem,
  pollOutcome,
  pollTally,
  validChoice,
  visiblePolls,
  voteFields,
  type Poll,
  type PollForm,
} from "./polls";

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 16, 10);
const poll = (o: Partial<Poll> = {}): Poll => ({
  id: "p1",
  question: "¿Cena el viernes?",
  options: [
    { id: "o1", label: "Sí" },
    { id: "o2", label: "No" },
    { id: "o3", label: "Igual" },
  ],
  multi: false,
  authorUid: "u1",
  authorName: "erik",
  createdAt: NOW - D,
  closesAt: NOW + 2 * D,
  closedAt: null,
  ...o,
});
const vote = (optionIds: string[], uid = "u") => ({ uid, optionIds, name: uid, playerId: null });

describe("open, closed and the 7-day window", () => {
  it("open until closesAt, closed from it on", () => {
    expect(isPollOpen(poll(), NOW)).toBe(true);
    expect(isPollOpen(poll({ closesAt: NOW }), NOW)).toBe(false);
    expect(isPollOpen(poll({ closesAt: NOW - 1 }), NOW)).toBe(false);
  });
  it("closedAt closes it early, whatever closesAt says", () => {
    const p = poll({ closedAt: NOW - H });
    expect(isPollOpen(p, NOW)).toBe(false);
    expect(pollEndedAt(p)).toBe(NOW - H);
    expect(pollEndedAt(poll({ closesAt: NOW - 2 * H, closedAt: NOW }))).toBe(NOW - 2 * H);
  });
  it("visible while open and 7 days after it ended, not later", () => {
    expect(isPollVisible(poll({ closesAt: NOW + 10 * D }), NOW)).toBe(true);
    expect(isPollVisible(poll({ closesAt: NOW - POLL_KEEP_MS + 1 }), NOW)).toBe(true);
    expect(isPollVisible(poll({ closesAt: NOW - POLL_KEEP_MS }), NOW)).toBe(false);
    expect(isPollVisible(poll({ closesAt: NOW + D, closedAt: NOW - 8 * D }), NOW)).toBe(false);
  });
  it("the list: open first (newest first), then closed (latest closed first), the old ones dropped", () => {
    const list = visiblePolls(
      [
        poll({ id: "old", closesAt: NOW - 9 * D }),
        poll({ id: "c1", closesAt: NOW - 3 * D }),
        poll({ id: "c2", closedAt: NOW - H }),
        poll({ id: "a", createdAt: NOW - 3 * D }),
        poll({ id: "b", createdAt: NOW - H }),
      ],
      NOW,
    );
    expect(list.map((p) => p.id)).toEqual(["b", "a", "c2", "c1"]);
  });
  it("counts an author's open polls only", () => {
    const polls = [poll({ id: "1" }), poll({ id: "2", closedAt: NOW - 1 }), poll({ id: "3", authorUid: "u2" }), poll({ id: "4" })];
    expect(openPollsBy(polls, "u1", NOW)).toBe(2);
  });
});

describe("«Cierra en …»", () => {
  it("days, hours, minutes, «Cerrada»", () => {
    expect(closesText(poll({ closesAt: NOW + 2 * D }), NOW)).toBe("Cierra en 2 días");
    expect(closesText(poll({ closesAt: NOW + 3 * D + POLL_CLOSE_MARGIN_MS }), NOW)).toBe("Cierra en 3 días");
    expect(closesText(poll({ closesAt: NOW + D }), NOW)).toBe("Cierra en 1 día");
    expect(closesText(poll({ closesAt: NOW + 5 * H }), NOW)).toBe("Cierra en 5 horas");
    expect(closesText(poll({ closesAt: NOW + H }), NOW)).toBe("Cierra en 1 hora");
    expect(closesText(poll({ closesAt: NOW + 23.8 * H }), NOW)).toBe("Cierra en 1 día");
    expect(closesText(poll({ closesAt: NOW + 20 * 60_000 }), NOW)).toBe("Cierra en 20 min");
    expect(closesText(poll({ closesAt: NOW + 1000 }), NOW)).toBe("Cierra en 1 min");
    expect(closesText(poll({ closedAt: NOW - 1 }), NOW)).toBe("Cerrada");
  });
});

describe("tallies, winners and ties", () => {
  it("one answer each: counts, voters and percentages", () => {
    const t = pollTally(poll(), [vote(["o1"]), vote(["o1"]), vote(["o2"]), vote(["o2", "o1"])]);
    expect(t.voters).toBe(4);
    // a single-answer poll counts only the first id
    expect(t.rows.map((r) => [r.id, r.count, r.pct])).toEqual([
      ["o1", 2, 50],
      ["o2", 2, 50],
      ["o3", 0, 0],
    ]);
  });
  it("several answers: each id once, percentages of the people who voted (they may add up past 100)", () => {
    const p = poll({ multi: true });
    const t = pollTally(p, [vote(["o1", "o2"]), vote(["o1", "o1"]), vote(["o3", "zz"])]);
    expect(t.voters).toBe(3);
    expect(t.rows.map((r) => r.count)).toEqual([2, 1, 1]);
    expect(t.rows.map((r) => r.pct)).toEqual([67, 33, 33]);
  });
  it("unknown ids don't count, nor a vote left without any", () => {
    const t = pollTally(poll(), [vote(["zz"]), vote([])]);
    expect(t.voters).toBe(0);
    expect(t.rows.every((r) => r.pct === 0)).toBe(true);
  });
  it("winner, tie, nobody", () => {
    const p = poll();
    const win = pollOutcome(pollTally(p, [vote(["o1"]), vote(["o1"]), vote(["o2"])]));
    expect(win).toEqual({ kind: "winner", ids: ["o1"] });
    expect(outcomeText(p, win)).toBe("Gana Sí");
    const tie = pollOutcome(pollTally(p, [vote(["o1"]), vote(["o2"])]));
    expect(tie).toEqual({ kind: "tie", ids: ["o1", "o2"] });
    expect(outcomeText(p, tie)).toBe("Empate entre Sí y No");
    const three = pollOutcome(pollTally(p, [vote(["o1"]), vote(["o2"]), vote(["o3"])]));
    expect(outcomeText(p, three)).toBe("Empate entre Sí, No e Igual");
    expect(outcomeText(p, pollOutcome(pollTally(p, [])))).toBe("Nadie votó");
  });
  it("«y» turns «e» before an i sound", () => {
    expect(joinEs(["Azul", "Iglesias"])).toBe("Azul e Iglesias");
    expect(joinEs(["Azul", "hilo"])).toBe("Azul e hilo");
    expect(joinEs(["Azul", "hielo"])).toBe("Azul y hielo");
    expect(joinEs(["Azul"])).toBe("Azul");
  });
  it("«Tú: X»", () => {
    expect(myChoiceText(poll(), vote(["o2"]))).toBe("Tú: No");
    expect(myChoiceText(poll({ multi: true }), vote(["o3", "o1"]))).toBe("Tú: Sí e Igual");
    expect(myChoiceText(poll(), undefined)).toBe("");
  });
});

describe("the form", () => {
  const form = (o: Partial<PollForm> = {}): PollForm => ({ question: "¿Cena el viernes?", options: ["Sí", "No"], multi: false, duration: "3d", ...o });
  it("says what is wrong", () => {
    expect(pollFormProblem(form(), 0)).toBeNull();
    expect(pollFormProblem(form({ question: "   " }), 0)).toBe("Escribe la pregunta.");
    expect(pollFormProblem(form({ question: "x".repeat(121) }), 0)).toBe("La pregunta, como mucho 120 caracteres.");
    expect(pollFormProblem(form({ question: "x".repeat(120) }), 0)).toBeNull();
    expect(pollFormProblem(form({ options: ["Sí", "  "] }), 0)).toBe("Pon al menos 2 opciones.");
    expect(pollFormProblem(form({ options: ["1", "2", "3", "4", "5", "6", "7"] }), 0)).toBe("Como mucho 6 opciones.");
    expect(pollFormProblem(form({ options: ["1", "2", "3", "4", "5", "6"] }), 0)).toBeNull();
    expect(pollFormProblem(form({ options: ["Sí", "y".repeat(41)] }), 0)).toBe("Cada opción, como mucho 40 caracteres.");
    expect(pollFormProblem(form({ options: ["Sí", " sí "] }), 0)).toBe("Hay dos opciones iguales.");
  });
  it("3 open polls of yours: no more", () => {
    expect(pollFormProblem(form(), 2)).toBeNull();
    expect(pollFormProblem(form(), 3)).toBe("Ya tienes 3 encuestas abiertas. Cierra una para abrir otra.");
  });
  it("the doc's fields: trimmed, blanks out, ids o1…, closesAt after the chosen time", () => {
    const f = pollFields({ uid: "u1", name: "erik" }, form({ question: "  ¿Torneo?  ", options: [" A ", "", "B"], multi: true, duration: "1h" }), NOW);
    expect(f).toEqual({
      question: "¿Torneo?",
      options: [
        { id: "o1", label: "A" },
        { id: "o2", label: "B" },
      ],
      multi: true,
      authorUid: "u1",
      authorName: "erik",
      closesAt: NOW + H + POLL_CLOSE_MARGIN_MS,
    });
    expect(pollFields({ uid: "u1", name: "erik" }, form({ duration: "1w" }), NOW).closesAt).toBe(NOW + 7 * D + POLL_CLOSE_MARGIN_MS);
  });
  it("the vote's fields: one id unless multi, only the poll's", () => {
    const me = { name: "erik", playerId: "erik" };
    expect(voteFields(me, poll(), ["o2", "o1"])).toEqual({ optionIds: ["o2"], name: "erik", playerId: "erik" });
    expect(voteFields({ ...me, playerId: null }, poll({ multi: true }), ["o2", "zz", "o1", "o2"])).toEqual({ optionIds: ["o2", "o1"], name: "erik", playerId: null });
    expect(validChoice(poll(), [])).toEqual([]);
  });
  it("the author or a captain manage it", () => {
    expect(canManagePoll(poll(), "u1", false)).toBe(true);
    expect(canManagePoll(poll(), "u2", false)).toBe(false);
    expect(canManagePoll(poll(), "u2", true)).toBe(true);
    expect(canManagePoll(poll({ authorUid: "" }), "", false)).toBe(false);
  });
});

describe("reading the docs", () => {
  const ts = (ms: number) => ({ toMillis: () => ms });
  it("a poll, its timestamps and a pending server time", () => {
    const p = parsePoll("p1", { question: "¿Q?", options: [{ id: "o1", label: "A" }, { id: "o2", label: "B" }, { id: 3 }], multi: true, authorUid: "u1", authorName: "erik", createdAt: ts(1), closesAt: ts(5) }, NOW);
    expect(p).toEqual({ id: "p1", question: "¿Q?", options: [{ id: "o1", label: "A" }, { id: "o2", label: "B" }], multi: true, authorUid: "u1", authorName: "erik", createdAt: 1, closesAt: 5, closedAt: null });
    // this device's own writes, before the server stamps them
    const fresh = parsePoll("p2", { question: "¿Q?", options: [{ id: "o1", label: "A" }, { id: "o2", label: "B" }], closesAt: ts(NOW + D), createdAt: null, closedAt: null }, NOW);
    expect(fresh?.createdAt).toBe(NOW);
    expect(fresh?.closedAt).toBe(NOW);
  });
  it("not a poll: null", () => {
    expect(parsePoll("x", undefined, NOW)).toBeNull();
    expect(parsePoll("x", { question: "¿Q?", options: [{ id: "o1", label: "A" }], closesAt: ts(1) }, NOW)).toBeNull();
    expect(parsePoll("x", { question: "¿Q?", options: [{ id: "o1", label: "A" }, { id: "o2", label: "B" }] }, NOW)).toBeNull();
  });
  it("a vote", () => {
    expect(parsePollVote("u1", { optionIds: ["o1", 2], name: "erik", playerId: "erik" })).toEqual({ uid: "u1", optionIds: ["o1"], name: "erik", playerId: "erik" });
    expect(parsePollVote("u1", { optionIds: [] })).toBeNull();
    expect(parsePollVote("u1", { optionIds: ["o1"], playerId: null })).toEqual({ uid: "u1", optionIds: ["o1"], name: "Miembro", playerId: null });
  });
});
