import { describe, expect, it } from "vitest";
import {
  handoverTurns,
  jobIdFor,
  jobShort,
  jobTask,
  matchDayText,
  parseRota,
  parseRotaTurns,
  turnDone,
  doneKeyOf,
  rotaErrors,
  rotaHistory,
  rotaMatch,
  rotaNotice,
  rotaPlayed,
  turnsFor,
  turnsLine,
  type RotaAbsence,
  type RotaAnswer,
  type Rota,
  type RotaMatch,
  type RotaTurnsDoc,
} from "./rota";

const DAY = 86_400_000;
// Saturdays at 10:00 Madrid (UTC+2 in October)
const sat = (n: number) => Date.UTC(2026, 9, 3 + 7 * n, 8, 0);
const LATER = sat(20);
const m = (id: string, n: number, extra: Partial<RotaMatch> = {}): RotaMatch => ({ id, date: sat(n), home: true, status: "scheduled", seasonId: "s1", ...extra });
const ROTA: Rota = {
  jobs: [
    { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order: ["hugo", "dani", "leo"] },
    { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order: ["dani", "leo"] },
  ],
};
type Docs = Record<string, RotaTurnsDoc | undefined>;
const frozen = (turns: Record<string, string | { playerId: string; swappedFrom?: string }>): RotaTurnsDoc => ({
  frozen: true,
  turns: Object.fromEntries(Object.entries(turns).map(([k, v]) => [k, typeof v === "string" ? { playerId: v } : v])),
});
interface Opts {
  rota?: Rota;
  docs?: Docs;
  now?: number;
  answers?: RotaAnswer[];
  absences?: RotaAbsence[];
}
/** The turns of `match` with `matches` as the season, as the web and the backend run it. */
const turnsOf = (match: RotaMatch, matches: RotaMatch[], o: Opts = {}) => {
  const rota = o.rota ?? ROTA;
  const docs = o.docs ?? {};
  const history = rotaHistory(match, matches, docs, rota, o.now ?? LATER);
  return turnsFor(match, rota, history, o.answers ?? [], o.absences ?? [], docs[match.id]);
};
const who = (match: RotaMatch, matches: RotaMatch[], o: Opts = {}) => Object.fromEntries(turnsOf(match, matches, o).map((t) => [t.job.id, t.playerId]));
const X = m("x", 10);

describe("turnsFor: the one longest without it", () => {
  it("rotates through the order, one per played match, and comes round again", () => {
    const played = [m("a", 0), m("b", 1), m("c", 2)];
    expect(who(X, []).lavar).toBe("hugo");
    expect(who(X, played.slice(0, 1)).lavar).toBe("dani");
    expect(who(X, played.slice(0, 2)).lavar).toBe("leo");
    expect(who(X, played).lavar).toBe("hugo");
  });

  it("is deterministic: the order the matches come in doesn't matter, only their dates", () => {
    const played = [m("c", 2), m("a", 0), m("b", 1)];
    expect(who(X, played)).toEqual(who(X, [...played].reverse()));
  });

  it("counts only the season's played matches before this one (not cancelled, postponed, other seasons or later)", () => {
    const played = [m("a", 0), m("p", 1, { status: "postponed" }), m("c", 1, { status: "cancelled" }), m("o", 1, { seasonId: "s0" }), m("later", 12)];
    expect(who(X, played).lavar).toBe("dani");
  });

  it("late acta: the turn moves once the date has passed, without waiting for «finished»", () => {
    const a = m("a", 0); // still «scheduled»: nobody published the acta
    expect(rotaPlayed(a, sat(0) - 60_000)).toBe(false);
    expect(who(X, [a], { now: sat(0) - 60_000 }).lavar).toBe("hugo");
    expect(rotaPlayed(a, sat(0) + 60_000)).toBe(true);
    expect(who(X, [a], { now: sat(0) + 60_000 }).lavar).toBe("dani");
  });

  it("the frozen history is what counts («Lo hizo otro» included)", () => {
    const played = [m("a", 0)];
    expect(who(X, played, { docs: { a: frozen({ lavar: "leo" }) } }).lavar).toBe("hugo");
    // Dani did it for Hugo: Hugo is still owed nothing, Dani has had it → Hugo, then Leo
    expect(who(X, played, { docs: { a: frozen({ lavar: { playerId: "dani", swappedFrom: "hugo" } }) } }).lavar).toBe("hugo");
    expect(who(X, [m("a", 0), m("b", 1)], { docs: { a: frozen({ lavar: "dani" }), b: frozen({ lavar: "hugo" }) } }).lavar).toBe("leo");
  });

  it("inserting, removing or reordering members never reshuffles the past; a newcomer comes up soon but fairly", () => {
    const played = [m("a", 0), m("b", 1)];
    const docs: Docs = { a: frozen({ lavar: "hugo" }), b: frozen({ lavar: "dani" }) };
    const withOrder = (order: string[]): Rota => ({ jobs: [{ ...ROTA.jobs[0], order }] });
    expect(who(X, played, { docs, rota: withOrder(["hugo", "dani", "leo"]) }).lavar).toBe("leo");
    // removed: still Leo's
    expect(who(X, played, { docs, rota: withOrder(["hugo", "leo"]) }).lavar).toBe("leo");
    expect(who(X, played, { docs, rota: withOrder(["dani", "leo"]) }).lavar).toBe("leo");
    // reordered: still Leo's (he has never done it)
    expect(who(X, played, { docs, rota: withOrder(["leo", "hugo", "dani"]) }).lavar).toBe("leo");
    expect(who(X, played, { docs, rota: withOrder(["dani", "hugo", "leo"]) }).lavar).toBe("leo");
    // a newcomer at the end waits for Leo (both never: the order breaks the tie), then it's his
    const nico = withOrder(["hugo", "dani", "leo", "nico"]);
    expect(who(X, played, { docs, rota: nico }).lavar).toBe("leo");
    expect(who(X, [...played, m("c", 2)], { docs: { ...docs, c: frozen({ lavar: "leo" }) }, rota: nico }).lavar).toBe("nico");
    // and before the others when he is put first: he has never done it
    expect(who(X, played, { docs, rota: withOrder(["nico", "hugo", "dani", "leo"]) }).lavar).toBe("nico");
  });

  it("skips a «No puedo»; he isn't punished: next time he is the most overdue", () => {
    const x = m("x", 1);
    const t = turnsOf(x, [m("a", 0)], { docs: { a: frozen({ lavar: "hugo" }) }, answers: [{ playerId: "dani", response: "no" }] })[0];
    expect(t.playerId).toBe("leo");
    expect(t.skipped).toEqual(["dani"]);
    const docs: Docs = { a: frozen({ lavar: "hugo" }), x: frozen({ lavar: "leo" }) };
    expect(who(m("y", 2), [m("a", 0), x], { docs }).lavar).toBe("dani");
  });

  it("a «Duda» or a «Voy» is no skip", () => {
    expect(who(m("x", 1), [m("a", 0)], { answers: [{ playerId: "dani", response: "maybe" }] }).lavar).toBe("dani");
  });

  it("skips a member whose absence covers the match's Madrid day", () => {
    const x = m("x", 1);
    expect(who(x, [m("a", 0)], { absences: [{ playerId: "dani", from: "2026-10-08", to: "2026-10-12" }] }).lavar).toBe("leo");
    // an absence of another day, or of someone else, changes nothing
    expect(who(x, [m("a", 0)], { absences: [{ playerId: "dani", from: "2026-10-11", to: "2026-10-12" }] }).lavar).toBe("dani");
    expect(who(x, [m("a", 0)], { absences: [{ playerId: null, from: "2026-10-01", to: "2026-10-30" }] }).lavar).toBe("dani");
  });

  it("nobody when everyone in the order is out", () => {
    const t = turnsOf(m("x", 0), [], { answers: ["hugo", "dani", "leo"].map((p) => ({ playerId: p, response: "no" })) })[0];
    expect(t.playerId).toBeNull();
    expect(t.skipped).toEqual(["hugo", "dani", "leo"]);
  });

  it("the car (awayOnly) has no turn at home and counts only away matches", () => {
    const played = [m("a", 0, { home: false }), m("b", 1, { home: true }), m("c", 2, { home: true })];
    expect(who(m("x", 3, { home: true }), played).coche).toBeUndefined();
    expect(who(m("x", 3, { home: false }), played).coche).toBe("leo");
    expect(turnsOf(m("x", 3, { home: true }), played).map((t) => t.job.id)).toEqual(["lavar"]);
  });

  it("a captain's pin overrides this match; the history then counts who really does it", () => {
    const x = m("x", 1);
    const docs: Docs = { a: frozen({ lavar: "hugo" }), x: { frozen: false, turns: { lavar: { playerId: "leo", swappedFrom: "dani" } } } };
    const t = turnsOf(x, [m("a", 0)], { docs })[0];
    expect(t).toMatchObject({ playerId: "leo", computed: "dani", pinned: true, swappedFrom: "dani", frozen: false });
    // x played (not frozen yet: its pin counts) → Dani has gone longest without it
    expect(who(m("y", 2), [m("a", 0), x], { docs }).lavar).toBe("dani");
  });

  it("a frozen match shows its turns as they are", () => {
    const docs: Docs = { x: frozen({ lavar: { playerId: "leo", swappedFrom: "hugo" } }) };
    const t = turnsOf(m("x", 1), [m("a", 0)], { docs, answers: [{ playerId: "leo", response: "no" }] })[0];
    expect(t).toMatchObject({ playerId: "leo", computed: "hugo", pinned: true, swappedFrom: "hugo", frozen: true });
  });

  it("no double jobs: with the same order everywhere, each job goes to someone else", () => {
    const order = ["hugo", "dani", "leo"];
    const rota: Rota = {
      jobs: [
        { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false, order },
        { id: "balones", name: "Balones y petos", icon: "ball", awayOnly: false, order },
        { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true, order },
      ],
    };
    const first = who(m("a", 0, { home: false }), [], { rota });
    expect(first).toEqual({ lavar: "hugo", balones: "dani", coche: "leo" });
    const second = who(m("b", 1, { home: false }), [m("a", 0, { home: false })], { rota });
    expect(new Set(Object.values(second)).size).toBe(3);
    expect(second.lavar).toBe("dani");
    // a pinned member is taken too
    const pinned = who(m("a", 0, { home: false }), [], { rota, docs: { a: { frozen: false, turns: { coche: { playerId: "dani" } } } } });
    expect(pinned).toEqual({ lavar: "hugo", balones: "leo", coche: "dani" });
    // …unless nobody else can
    const two = who(m("a", 0, { home: false }), [], { rota, answers: [{ playerId: "leo", response: "no" }, { playerId: "dani", response: "no" }] });
    expect(two).toEqual({ lavar: "hugo", balones: "hugo", coche: "hugo" });
  });

  it("ignores a malformed pin; an empty order or no rota: nobody / nothing", () => {
    const t = turnsFor(m("x", 0), ROTA, [], [], [], { frozen: false, turns: { lavar: { playerId: "" } } })[0];
    expect(t.pinned).toBe(false);
    expect(t.playerId).toBe("hugo");
    expect(turnsFor(m("x", 0), { jobs: [{ id: "j", name: "J", icon: "bag", awayOnly: false, order: [] }] }, [], [], [], null)[0].playerId).toBeNull();
    expect(turnsFor(m("x", 0), null, [], [], [], null)).toEqual([]);
  });
});

describe("rotaHistory", () => {
  it("oldest first; frozen entries as they are, the rest computed with their pins", () => {
    const docs: Docs = { a: frozen({ lavar: "leo" }), b: { frozen: false, turns: { lavar: { playerId: "leo" } } } };
    const h = rotaHistory(X, [m("b", 1), m("c", 2), m("a", 0)], docs, ROTA, LATER);
    expect(h).toEqual([
      { id: "a", turns: { lavar: "leo" } },
      { id: "b", turns: { lavar: "leo" } },
      { id: "c", turns: { lavar: "hugo" } },
    ]);
  });
  it("an undated target sees every played match", () => {
    expect(rotaHistory({ id: "x", date: null, seasonId: "s1" }, [m("b", 0), m("a", 0), m("c", -1)], {}, ROTA, LATER).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("words", () => {
  const nameOf = (id: string) => ({ hugo: "Hugo", dani: "Dani", leo: "Leo" })[id] ?? id;
  const turns = turnsOf(m("x", 1, { home: false }), [m("a", 0, { home: false })]);
  it("«Te toca…» with the job's task when it's mine", () => {
    expect(turnsLine(turns, nameOf, "dani")).toEqual({ mine: true, text: "Te toca: lavar la equipación" });
    expect(turnsLine(turns, nameOf, "leo")).toEqual({ mine: true, text: "Te toca: poner el coche" });
  });
  it("lists who does what otherwise", () => {
    expect(turnsLine(turns, nameOf, "hugo")).toEqual({ mine: false, text: "Lava: Dani · Coche: Leo" });
    expect(turnsLine([], nameOf, "hugo")).toBeNull();
  });
  it("a renamed default job speaks with its own name", () => {
    const renamed = { id: "coche", name: "Llevar la nevera" };
    expect(jobShort(renamed)).toBe("Llevar la nevera");
    expect(jobTask(renamed)).toBe("llevar la nevera");
    expect(jobShort({ id: "lavar", name: "Lavar la equipación" })).toBe("Lava");
    expect(rotaNotice("m1", { id: "lavar", name: "Lavar los petos" }, "p1", { date: sat(1) }, sat(1) - 2 * DAY).title).toBe("Te toca lavar los petos en el partido del sábado");
  });
});

describe("rotaNotice", () => {
  it("«Te toca lavar la equipación tras el partido del sábado», once per match, job and member", () => {
    const n = rotaNotice("m1", { id: "lavar", name: "Lavar la equipación" }, "p1", { date: sat(1), rival: "Rayo" }, sat(1) - 2 * DAY);
    expect(n.title).toBe("Te toca lavar la equipación tras el partido del sábado");
    expect(n.body).toBe("Contra Rayo. Si no puedes, marca «No puedo» y pasa al siguiente.");
    expect(n.body).not.toMatch(/capitán/);
    expect(n).toMatchObject({ topic: "personal", tag: "rota-m1-lavar", log: "rota-m1-lavar-p1", url: "/partidos/m1/vestuario" });
  });
  it("other jobs say «en el partido», a far match its day number", () => {
    expect(rotaNotice("m1", { id: "balones", name: "Balones y petos" }, "p1", { date: sat(1) }, sat(1) - 2 * DAY).title).toBe("Te toca llevar los balones y petos en el partido del sábado");
    expect(matchDayText(sat(1), sat(1) - 10 * DAY)).toBe("del sábado 10");
    expect(matchDayText(null, 0)).toBe("del próximo partido");
  });
});

describe("parse and validate", () => {
  it("parseRota drops bad jobs and cleans orders", () => {
    expect(parseRota({ jobs: [{ id: "a", name: "A", icon: "zzz", order: ["x", "x", 3, ""] }, { id: "", name: "B" }, { id: "frozen", name: "C" }] })).toEqual({
      jobs: [{ id: "a", name: "A", icon: "shirt", awayOnly: false, order: ["x"] }],
    });
    expect(parseRota(null)).toBeNull();
  });
  it("parseRotaTurns keeps the freeze flag and the well-formed entries", () => {
    expect(parseRotaTurns({ seasonId: "s1", frozen: true, lavar: { playerId: "p", swappedFrom: "q", at: 1 }, x: { playerId: 3 }, y: null, "Mal Id": { playerId: "p" } })).toEqual({
      frozen: true,
      turns: { lavar: { playerId: "p", swappedFrom: "q" } },
    });
    expect(parseRotaTurns(undefined)).toEqual({ frozen: false, turns: {} });
  });
  it("rotaErrors says what the rules would refuse", () => {
    const job = { id: "a", name: "A", icon: "shirt" as const, awayOnly: false, order: [] };
    expect(rotaErrors({ jobs: [job] })).toEqual([]);
    expect(rotaErrors({ jobs: Array.from({ length: 7 }, (_, i) => ({ ...job, id: `j${i}` })) })).toContain("Como mucho 6 turnos.");
    expect(rotaErrors({ jobs: [{ ...job, name: "x".repeat(31) }] })[0]).toMatch(/30 letras/);
    expect(rotaErrors({ jobs: [{ ...job, name: " " }] })[0]).toMatch(/nombre/);
    expect(rotaErrors({ jobs: [job, job] })[0]).toMatch(/identificador/);
    expect(rotaErrors({ jobs: [{ ...job, id: "frozen" }] })[0]).toMatch(/identificador/);
    expect(rotaErrors({ jobs: [{ ...job, order: Array.from({ length: 41 }, (_, i) => `p${i}`) }] })[0]).toMatch(/40 jugadores/);
  });
  it("jobIdFor slugs and keeps ids unique (never the reserved «frozen»)", () => {
    expect(jobIdFor("Lavar la equipación", [])).toBe("lavar-la-equipacion");
    expect(jobIdFor("Agua", ["agua"])).toBe("agua-2");
    expect(jobIdFor("¡¡", [])).toBe("turno");
    expect(jobIdFor("Frozen", [])).toBe("frozen-2");
  });
  it("rotaMatch reads a club match", () => {
    expect(rotaMatch({ id: "a", date: sat(0), home: false, status: "scheduled", seasonId: "s1" })).toEqual({ id: "a", date: sat(0), home: false, status: "scheduled", seasonId: "s1" });
    expect(rotaMatch({ id: "a", date: undefined }).date).toBeNull();
  });
});

describe("handoverTurns: the one whose turn it was can't", () => {
  const Y = m("y", 10, { home: false });
  const no = (playerId: string): RotaAnswer => ({ playerId, response: "no" });
  const handover = (playerId: string, o: { answers?: RotaAnswer[]; absences?: RotaAbsence[]; doc?: RotaTurnsDoc } = {}) =>
    handoverTurns(Y, ROTA, [], o.answers ?? [no(playerId)], o.absences ?? [], o.doc, playerId).map((t) => [t.job.id, t.playerId]);

  it("passes his turn to the next one, and any turn whose member moved up to cover it", () => {
    // with everyone in: Lava Hugo, Coche Dani. Hugo can't: Dani washes, so Leo drives.
    expect(handover("hugo")).toEqual([
      ["lavar", "dani"],
      ["coche", "leo"],
    ]);
    expect(handover("dani")).toEqual([["coche", "leo"]]);
  });

  it("an absence that covers the day counts like his «No puedo»", () => {
    expect(handover("hugo", { answers: [], absences: [{ playerId: "hugo", from: "2026-01-01", to: "2026-12-31" }] })).toEqual([
      ["lavar", "dani"],
      ["coche", "leo"],
    ]);
  });

  it("nothing when he held no turn, or he is in after all (back to «Voy»)", () => {
    expect(handover("leo")).toEqual([]);
    expect(handover("hugo", { answers: [{ playerId: "hugo", response: "yes" }] })).toEqual([]);
  });

  it("never a pinned job, nor a frozen match", () => {
    const pinned = (turns: RotaTurnsDoc["turns"]): RotaTurnsDoc => ({ frozen: false, turns });
    expect(handover("hugo", { doc: pinned({ lavar: { playerId: "hugo" } }) })).toEqual([]);
    // the car is the captain's (Leo's): only the wash moves
    expect(handover("hugo", { doc: pinned({ coche: { playerId: "leo" } }) })).toEqual([["lavar", "dani"]]);
    expect(handover("hugo", { doc: frozen({ lavar: "hugo", coche: "dani" }) })).toEqual([]);
  });
});

describe("turnos «Hecho»", () => {
  it("reads the doc-level done map (ms or a Timestamp), never as a job", () => {
    const doc = parseRotaTurns({ seasonId: "s", frozen: true, lavar: { playerId: "hugo" }, done: { u1: 5, u2: { toMillis: () => 7 }, u3: "x" } });
    expect(doc.done).toEqual({ u1: 5, u2: 7 });
    expect(Object.keys(doc.turns)).toEqual(["lavar"]);
    expect(turnDone(doc, "u1")).toBe(true);
    expect(turnDone(doc, "u3")).toBe(false);
    expect(turnDone(parseRotaTurns({}), "u1")).toBe(false);
    expect(parseRotaTurns({}).done).toBeUndefined();
  });
  it("a captain's mark for a player without an account: `p:<playerId>` (r12, the Sala's «Después»)", () => {
    const doc = parseRotaTurns({ seasonId: "s", lavar: { playerId: "hugo" }, done: { "p:hugo": 9 } });
    expect(doc.done).toEqual({ "p:hugo": 9 });
    expect(turnDone(doc, undefined, "hugo")).toBe(true);
    expect(turnDone(doc, "u-hugo", "hugo")).toBe(true);
    expect(turnDone(doc, "u-hugo")).toBe(false);
    expect(turnDone(doc, null, "dani")).toBe(false);
    expect(doneKeyOf("u-hugo", "hugo")).toBe("u-hugo");
    expect(doneKeyOf(null, "hugo")).toBe("p:hugo");
  });
  it("«done» is a reserved job id", () => {
    expect(jobIdFor("done", [])).toBe("done-2");
  });
});
