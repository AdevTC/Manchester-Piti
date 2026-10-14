import { describe, expect, it } from "vitest";
import type { MatchLike } from "../../lib/playerStats";
import type { Participation } from "../../../functions/src/matchEngine";
import { SUSPENSION_MATCHES, bajaOf, manualLeft, suspendedSet, suspensions, type Sanction, type SuspensionMatch } from "./chemistry";

/** A ledger row: played (or not) and how many reds. */
const row = (o: Partial<Participation> = {}): Participation =>
  ({ played: true, redCards: 0, doubleYellows: 0, dismissed: false, ...o }) as Participation;

describe("suspendedSet", () => {
  it("a red card (event) in the last match: out of the next one", () => {
    const matches: MatchLike[] = [
      { status: "finished", events: [{ type: "goal", playerId: "a" }, { type: "red_card", playerId: "b" }] },
      { status: "finished", events: [{ type: "assist", playerId: "a" }] },
    ];
    const susp = suspendedSet(matches);
    expect(susp.has("b")).toBe(true);
    expect(susp.has("a")).toBe(false);
  });

  it("served after the team's next match, even when the player had no event in it (the ledger says he played)", () => {
    // J3: red card. J4–J8: he plays quietly (ledger only, no events). Most recent first.
    const j3: MatchLike = { status: "finished", ledger: { b: row({ redCards: 1, dismissed: true }) }, events: [{ type: "red_card", playerId: "b" }] };
    const quiet = (): MatchLike => ({ status: "finished", ledger: { b: row() }, events: [] });
    const season = [quiet(), quiet(), quiet(), quiet(), quiet(), j3];
    expect(suspendedSet(season).has("b")).toBe(false);
    // and just one team match after the red is enough, whether he was in it or not
    expect(suspendedSet([{ status: "finished", ledger: {}, events: [] }, j3]).has("b")).toBe(false);
  });

  it("the ledger alone flags a sending-off (second yellow), and scheduled or cancelled matches do not serve it", () => {
    const sent: MatchLike = { status: "finished", ledger: { c: row({ doubleYellows: 1 }) } };
    const later: MatchLike[] = [{ status: "scheduled" }, { status: "cancelled" }];
    expect(suspendedSet([...later, sent]).has("c")).toBe(true);
    expect(suspendedSet([{ status: "finished" }, ...later, sent]).has("c")).toBe(false);
  });

  it("a longer ban counts the team's matches since the red", () => {
    const red: MatchLike = { status: "finished", events: [{ type: "red_card", playerId: "d" }] };
    const next: MatchLike = { status: "finished", events: [] };
    expect(SUSPENSION_MATCHES).toBe(1);
    expect(suspendedSet([next, red], 2).has("d")).toBe(true);
    expect(suspendedSet([next, next, red], 2).has("d")).toBe(false);
  });
});

describe("suspensions (acta + sanciones a mano)", () => {
  const DAY = 86_400_000;
  const T0 = Date.UTC(2026, 9, 1, 10);
  /** A team match `d` days after T0 (newest first in the lists below). */
  const m = (id: string, d: number, status: string, o: Partial<SuspensionMatch> = {}): SuspensionMatch => ({ id, date: T0 + d * DAY, status, ...o });
  const red = (id: string, d: number, who: string) => m(id, d, "finished", { events: [{ type: "red_card", playerId: who }] });

  it("the acta alone: one match left, source «acta», the same set as suspendedSet", () => {
    const list = [red("j1", 0, "b")];
    expect(suspensions(list).get("b")).toEqual({ left: 1, source: "acta" });
    expect([...suspendedSet(list)]).toEqual(["b"]);
    // a longer ban: the latest red has all its games left, an older one fewer
    expect(suspensions([m("j2", 7, "finished"), red("j1", 0, "d")], [], 3).get("d")).toEqual({ left: 2, source: "acta" });
  });

  it("«Levantar la sanción» clears a red card in a match dated at or before it, not a later one", () => {
    const list = [red("j1", 0, "b")];
    expect(suspensions(list, [{ id: "b", sanctionClearedAt: T0 }]).has("b")).toBe(false);
    expect(suspensions(list, [{ id: "b", sanctionClearedAt: T0 + DAY }]).has("b")).toBe(false);
    expect(suspensions(list, [{ id: "b", sanctionClearedAt: T0 - DAY }]).get("b")).toEqual({ left: 1, source: "acta" });
    expect(suspendedSet(list, 1, [{ id: "b", sanctionClearedAt: T0 }]).has("b")).toBe(false);
    // only his own: someone else's lift doesn't clear him
    expect(suspensions(list, [{ id: "x", sanctionClearedAt: T0 + DAY }]).has("b")).toBe(true);
  });

  it("a manual sanction counts the team's finished matches strictly after it was set", () => {
    const s = { games: 2, from: T0, reason: "Federación", by: "a1" };
    const p = [{ id: "c", sanction: s }];
    expect(suspensions([], p).get("c")).toEqual({ left: 2, source: "manual", reason: "Federación" });
    // a match finished before it was set (or at the very same moment) serves nothing
    expect(suspensions([m("j0", 0, "finished"), m("jm", -3, "finished")], p).get("c")?.left).toBe(2);
    // scheduled, cancelled and postponed matches serve nothing either
    expect(suspensions([m("j3", 9, "scheduled"), m("j2", 5, "cancelled"), m("j1", 2, "postponed")], p).get("c")?.left).toBe(2);
    expect(suspensions([m("j1", 2, "finished")], p).get("c")?.left).toBe(1);
    expect(suspensions([m("j2", 5, "finished"), m("j1", 2, "finished")], p).has("c")).toBe(false);
  });

  it("«hasta la J…»: out until that match is played, counting the matches to play up to it", () => {
    const s = { games: 3, from: T0, untilMatchId: "j3", reason: null, by: "a1" };
    const p = [{ id: "e", sanction: s }];
    const cal = [m("j4", 21, "scheduled"), m("j3", 14, "scheduled"), m("j2", 7, "scheduled"), m("j1", 3, "cancelled")];
    expect(suspensions(cal, p).get("e")).toEqual({ left: 2, source: "manual", untilMatchId: "j3" });
    const after2 = [m("j4", 21, "scheduled"), m("j3", 14, "scheduled"), m("j2", 7, "finished")];
    expect(suspensions(after2, p).get("e")?.left).toBe(1);
    expect(suspensions([m("j4", 21, "scheduled"), m("j3", 14, "finished"), m("j2", 7, "finished")], p).has("e")).toBe(false);
    // the match is not there (another season) or was cancelled: the count decides
    expect(suspensions([m("j2", 7, "finished")], p).get("e")?.left).toBe(2);
    expect(suspensions([m("j3", 14, "cancelled"), m("j2", 7, "finished")], p).get("e")?.left).toBe(2);
    expect(manualLeft(s, [m("j3", 14, "cancelled"), m("j2", 7, "finished"), m("j1", 3, "finished"), m("j0", 2, "finished")])).toBe(0);
  });

  it("acta and manual together: the longer one wins and the manual reason shows", () => {
    const list = [red("j1", 0, "f")];
    expect(suspensions(list, [{ id: "f", sanction: { games: 3, from: T0 + DAY, reason: " Roja en Copa " } }]).get("f")).toEqual({ left: 3, source: "manual", reason: "Roja en Copa" });
    // the manual one has fewer left than the acta's: the acta's count stands
    expect(suspensions([red("j2", 7, "f"), m("j1", 3, "finished")], [{ id: "f", sanction: { games: 1, from: T0 + 8 * DAY } }], 2).get("f")).toEqual({ left: 2, source: "manual" });
  });

  it("a broken sanction (no numbers) or a served one is ignored", () => {
    const bad = { games: Number.NaN, from: T0 } as Sanction;
    expect(suspensions([], [{ id: "g", sanction: bad }]).size).toBe(0);
    expect(suspensions([], [{ id: "g", sanction: null }]).size).toBe(0);
    expect(manualLeft({ games: 1, from: T0 }, [m("j1", 1, "finished")])).toBe(0);
  });
});

describe("bajaOf: why a player can't play (the pizarra and Convocar, one rule)", () => {
  const susp = new Set(["s"]);
  it("inactive, injured, suspended — in that order; nobody else", () => {
    expect(bajaOf({ id: "x", active: false, injured: true }, susp)).toBe("Inactivo");
    expect(bajaOf({ id: "s", injured: true }, susp)).toBe("Lesionado");
    expect(bajaOf({ id: "s", active: true }, susp)).toBe("Sancionado");
    expect(bajaOf({ id: "y", active: true, injured: false }, susp)).toBeUndefined();
    // (active unknown: an old ficha counts as active)
    expect(bajaOf({ id: "y" }, new Map())).toBeUndefined();
  });
});
