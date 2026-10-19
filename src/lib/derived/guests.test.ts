import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent, MatchSheet } from "../clubData";
import type { PlayerDoc } from "../schemas";
import { calculateLedger } from "../../../functions/src/matchEngine";
import { positionsPlayed, withPositions } from "../../../functions/src/positionsPlayed";
import { scorePrediction } from "../../../functions/src/predictions";
import { liveProblem, liveSequenceProblem } from "../../../functions/src/liveLogic";
import { convocatoriaProblem } from "../../../functions/src/convocatoriaLogic";
import { noticesFor } from "../../../functions/src/pushLogic";
import type { PosCode } from "../positions";
import { analysePlayer, chronological, goalLinks, playerGame } from "../clubAnalytics";
import { clubPositions, playerPositions } from "../positionStats";
import { extraTrophies } from "../club";
import { bestPartner, seasonSummary } from "../vestuario";
import { achievements } from "./achievements";
import { matchCostPlayers } from "./caja";
import { mvpCandidates } from "./memberWindows";
import { minutesOf, totalMinutes } from "./minutesOf";
import { rivalDossier } from "./rival";
import { goalMoment } from "./island";
import { chapters } from "../ficha";
import { posterContext } from "../matchPoster";
import { MAX_GUESTS, guestLabel, guestOf, guestRef, guestsProblem, isGuestId, withoutGuests, type MatchGuest } from "./guests";
import { guestRefsProblem, guestRemovalProblem } from "../../../functions/src/guests";
import { analyseActions } from "../../../functions/src/matchAnalysis";
import { shooterName, technicalAnalysis } from "../technicalAnalysis";
import { evoluciones } from "./card";

const GUESTS: MatchGuest[] = [{ id: "g1", name: "Rafa" }];
const RAFA = guestRef("g1");

describe("el contrato de invitados", () => {
  it("references, finds and names a guest", () => {
    expect(RAFA).toBe("guest:g1");
    expect(isGuestId(RAFA)).toBe(true);
    expect(isGuestId("ana")).toBe(false);
    expect(isGuestId(undefined)).toBe(false);
    expect(guestOf({ guests: GUESTS }, RAFA)).toEqual({ id: "g1", name: "Rafa" });
    expect(guestOf({ guests: GUESTS }, "guest:g2")).toBeNull();
    expect(guestOf({}, "g1")).toBeNull();
    expect(guestLabel({ guests: GUESTS }, RAFA)).toBe("Rafa (invitado)");
    expect(guestLabel({}, RAFA)).toBe("Invitado");
  });

  it("validates the guest list: at most four, unique g1–g4 ids, names of 1–30", () => {
    expect(guestsProblem(undefined)).toBeNull();
    expect(guestsProblem(GUESTS)).toBeNull();
    expect(guestsProblem([1, 2, 3, 4, 5].map((n) => ({ id: `g${n}`, name: "X" })))).toMatch(`${MAX_GUESTS} invitados`);
    expect(guestsProblem([{ id: "g1", name: "A" }, { id: "g1", name: "B" }])).toMatch(/referencia/);
    expect(guestsProblem([{ id: "g9", name: "A" }])).toMatch(/referencia/);
    expect(guestsProblem([{ id: "g1", name: "  " }])).toMatch(/nombre/);
    expect(guestsProblem([{ id: "g1", name: "x".repeat(31) }])).toMatch(/nombre/);
  });
});

// ---- the fixture acta: seven members, Hugo on the bench, Rafa (guest) on the bench
const MEMBERS = ["ana", "bea", "cris", "dani", "eva", "fer", "gus"];
const ALL = [...MEMBERS, "hugo"];
const MAIN: Record<string, PosCode | null> = { ana: "DC", bea: "MC", cris: "DFC", dani: "POR", eva: "LI", fer: "LD", gus: "MCO", hugo: "DC" };
const base = (events: MatchEvent[]): MatchSheet => ({
  version: 2, seasonId: "t1", rival: "Rival FC", competition: "Liga", date: 10 * 86_400_000, duration: 50, venue: "", home: true,
  status: "finished", starters: MEMBERS, bench: ["hugo", RAFA], notCalled: [], guests: GUESTS, events, goalsFor: 2, goalsAgainst: 1, report: "",
});
const shared: MatchEvent[] = [
  { id: "s1", type: "substitution", minute: 20, playerId: "gus", inPlayerId: RAFA },
  { id: "y1", type: "yellow_card", minute: 35, playerId: RAFA },
  { id: "o1", type: "opponent_goal", minute: 40 },
  { id: "s2", type: "substitution", minute: 45, playerId: RAFA, inPlayerId: "hugo" },
];
// A: Rafa scores (Bea assists) and assists Ana's goal.
const WITH_GUEST = base([
  ...shared,
  { id: "a", type: "goal", minute: 25, playerId: RAFA, assistPlayerId: "bea", assistReviewed: true },
  { id: "b", type: "goal", minute: 30, playerId: "ana", assistPlayerId: RAFA, assistReviewed: true },
]);
// B: the same acta with Rafa's goal unattributed, Ana's goal unassisted, and Bea's assist counted.
const UNATTRIBUTED = base([
  ...shared,
  { id: "a", type: "goal", minute: 25 },
  { id: "x", type: "assist", minute: 25, playerId: "bea" },
  { id: "b", type: "goal", minute: 30, playerId: "ana", assistReviewed: true },
]);

/** What saveMatchSheet stores: positions over the full ledger, then the member rows only. */
function published(id: string, sheet: MatchSheet): ClubMatch {
  const full = calculateLedger(sheet, true, { allowUnattributedGoals: true });
  expect(full.errors).toEqual([]);
  withPositions(full.players, positionsPlayed(full.players, sheet.events, { board: null, main: MAIN }));
  return { ...sheet, id, ledger: withoutGuests(full.players), goalsFor: full.goalsFor, goalsAgainst: full.goalsAgainst };
}
const OTHER: ClubMatch = { ...published("j0", base([{ id: "g0", type: "goal", minute: 5, playerId: "bea", assistPlayerId: "ana", assistReviewed: true }, { id: "o0", type: "opponent_goal", minute: 6 }, { id: "o2", type: "opponent_goal", minute: 7 }])), date: 3 * 86_400_000, guests: undefined, bench: ["hugo"], events: [{ id: "g0", type: "goal", minute: 5, playerId: "bea", assistPlayerId: "ana", assistReviewed: true }, { id: "o0", type: "opponent_goal", minute: 6 }, { id: "o2", type: "opponent_goal", minute: 7 }], goalsFor: 1, goalsAgainst: 2 };
OTHER.ledger = withoutGuests(calculateLedger(OTHER as MatchSheet, false).players);
const A = [OTHER, published("j1", WITH_GUEST)];
const B = [OTHER, published("j1", UNATTRIBUTED)];
const DOCS = ALL.map((id, i) => ({ id, shirtName: id.toUpperCase(), number: i + 1, seasons: ["t1"], active: true })) as unknown as PlayerDoc[];
const NOW = 100 * 86_400_000;
/** Everything but the match objects themselves (their events differ by construction) and Bea's technical
 *  shot-assist, which comes with her assist (also inside the ledgers some results carry; checked apart). */
const numbers = (x: unknown) =>
  JSON.parse(JSON.stringify(x, (k, v: unknown) => (["match", "games", "last", "events", "shotAssists"].includes(k) ? undefined : v)));

describe("invitados: el gol cuenta para el equipo y ninguna cifra de un socio cambia", () => {
  it("the engine counts the guest's goal for the team and refuses a guest that isn't on the list", () => {
    const l = calculateLedger(WITH_GUEST, true);
    expect(l.errors).toEqual([]);
    expect([l.goalsFor, l.goalsAgainst]).toEqual([2, 1]);
    expect(l.players.bea.assists).toBe(1);
    expect(l.players.ana.goals).toBe(1);
    expect(l.players.ana.assists).toBe(0);
    expect(calculateLedger({ ...WITH_GUEST, guests: [] }, true).errors.join(" ")).toMatch(/invitado/);
    expect(calculateLedger({ ...WITH_GUEST, guests: undefined }, true).errors.join(" ")).toMatch(/invitado/);
    expect(calculateLedger({ ...WITH_GUEST, bench: ["hugo"], notCalled: [RAFA] }, false).errors.join(" ")).toMatch(/invitado/);
  });

  it("the stored ledger has no guest row, and the team totals are the same", () => {
    expect(Object.keys(A[1].ledger!).some(isGuestId)).toBe(false);
    expect([A[1].goalsFor, A[1].goalsAgainst]).toEqual([B[1].goalsFor, B[1].goalsAgainst]);
  });

  it("every member number is equal to the unattributed acta's (stats, minutes, positions, medals, socio, rival, caja, MVP)", () => {
    const ga = chronological(A), gb = chronological(B);
    for (const doc of DOCS) {
      const id = doc.id;
      expect(numbers(analysePlayer(doc, ga)), id).toEqual(numbers(analysePlayer(doc, gb)));
      expect(numbers(playerGame(id, A[1])), id).toEqual(numbers(playerGame(id, B[1])));
      expect(minutesOf(A[1], id), id).toBe(minutesOf(B[1], id));
      expect(totalMinutes(A, id), id).toBe(totalMinutes(B, id));
      expect(numbers(playerPositions(id, A)), id).toEqual(numbers(playerPositions(id, B)));
      expect(numbers(achievements(id, A, { mvpResults: new Map(), now: NOW })), id).toEqual(numbers(achievements(id, B, { mvpResults: new Map(), now: NOW })));
      expect(numbers(achievements(id, [A[1]], { mvpResults: new Map(), now: NOW })), id).toEqual(numbers(achievements(id, [B[1]], { mvpResults: new Map(), now: NOW })));
      // the evoluciones (the Dúo above all: a guest is nobody's «socio»), over the career and the one acta
      expect(evoluciones(id, A, new Map(), [{ id: "t1", name: "T1" }], NOW), id).toEqual(evoluciones(id, B, new Map(), [{ id: "t1", name: "T1" }], NOW));
      expect(evoluciones(id, [A[1]], new Map(), [{ id: "t1", name: "T1" }], NOW), id).toEqual(evoluciones(id, [B[1]], new Map(), [{ id: "t1", name: "T1" }], NOW));
      // the technical analysis: each member's row is the same (Bea's shot-assist to Rafa's goal aside)
      expect(numbers(technicalAnalysis(A).players[id] ?? null), id).toEqual(numbers(technicalAnalysis(B).players[id] ?? null));
      expect(bestPartner(id, A, ALL), id).toEqual(bestPartner(id, B, ALL));
      expect(numbers(seasonSummary(id, "t1", A, new Map(), NOW)), id).toEqual(numbers(seasonSummary(id, "t1", B, new Map(), NOW)));
    }
    expect(numbers(clubPositions(A))).toEqual(numbers(clubPositions(B)));
    expect(numbers(rivalDossier(A, "Rival FC"))).toEqual(numbers(rivalDossier(B, "Rival FC")));
    expect(extraTrophies(A, (x) => x)).toEqual(extraTrophies(B, (x) => x));
    expect(matchCostPlayers(A[1], () => 0)).toEqual(matchCostPlayers(B[1], () => 0));
    expect(mvpCandidates(A[1].ledger, {}, (x) => x)).toEqual(mvpCandidates(B[1].ledger, {}, (x) => x));
    expect(mvpCandidates({ ...A[1].ledger, [RAFA]: { played: true } }, {}, (x) => x)).not.toContain(RAFA);
    expect(goalLinks(A).some((l) => isGuestId(l.from) || isGuestId(l.to))).toBe(false);
    // Bea keeps the assist to Rafa's goal: the unattributed acta needed it written down
    expect(analysePlayer(DOCS[1], ga).assists).toBe(1);
    expect(A[1].ledger!.bea.assists).toBe(1);
    expect(A[1].ledger!.bea.shotAssists).toBe((B[1].ledger!.bea.shotAssists ?? 0) + 1);
  });

  it("minutes and positions never name a guest", () => {
    expect(minutesOf(A[1], RAFA)).toBe(0);
    expect(playerPositions(RAFA, A).lines).toEqual([]);
    expect(clubPositions(A).every((l) => !isGuestId(l.owner?.id ?? ""))).toBe(true);
  });

  it("the porra: a guest's goal scores no scorer or action, a member's assist to it counts", () => {
    const result = { goalsFor: 2, goalsAgainst: 1 };
    const pick = { ...result, goals: [{ playerId: "ana", assistPlayerId: null }, { playerId: "cris", assistPlayerId: "bea" }] };
    const a = scorePrediction(pick, result, WITH_GUEST.events);
    const b = scorePrediction(pick, result, UNATTRIBUTED.events);
    expect(a.scorers).toBe(b.scorers);
    expect(a.actions).toBe(b.actions);
    expect(a.assists).toBe(b.assists + 1);
  });
});

describe("invitados en los callables y los avisos", () => {
  it("liveEvent: a guest on the list can score; one off the list is refused", () => {
    const m = { status: "scheduled", date: 0, duration: 50, starters: MEMBERS, bench: ["hugo", RAFA], guests: GUESTS };
    expect(liveProblem(m, { type: "goal", minute: 3, playerId: RAFA, assistPlayerId: "ana" }, 60_000)).toBeNull();
    expect(liveProblem(m, { type: "goal", minute: 3, playerId: "guest:g2" }, 60_000)).toMatch(/invitado/);
    expect(liveSequenceProblem(m, [{ id: "s", type: "substitution", minute: 1, playerId: "gus", inPlayerId: RAFA }, { id: "g", type: "goal", minute: 2, playerId: RAFA }])).toBeNull();
    expect(liveSequenceProblem({ ...m, guests: [] }, [{ id: "s", type: "substitution", minute: 1, playerId: "gus", inPlayerId: RAFA }])).toMatch(/invitado/);
  });

  it("setConvocatoria: a guest on the list can be called, one off it can't", () => {
    expect(convocatoriaProblem({ starters: MEMBERS, bench: [RAFA] }, { roster: ALL, guests: GUESTS })).toBeNull();
    expect(convocatoriaProblem({ starters: MEMBERS, bench: [RAFA] }, { roster: ALL })).toMatch(/invitado/);
  });

  it("the goal notice names the guest", () => {
    const before = { status: "scheduled", events: [], guests: GUESTS, rival: "Rival FC" };
    const after = { ...before, events: [{ id: "a", type: "goal", minute: 3, playerId: RAFA }] };
    const [goal] = noticesFor("m1", before, after, () => "Socio", 0).filter((n) => n.topic === "goals");
    expect(goal.title).toBe("¡Gol de Rafa (invitado)!");
    expect(goal.body).toBe("Minuto 3. Piti 1, Rival FC 0.");
  });
});

describe("las frases nombran al invitado", () => {
  const member = (id: string) => id.toUpperCase();
  it("the crónica: «Rafa (invitado)» scores and assists, never a raw ref nor «Jugador»", () => {
    const text = chapters(WITH_GUEST.events, member, "Rival FC", { gf: 2, ga: 1 }, GUESTS).map((c) => `${c.title} ${c.text}`).join(" ");
    expect(text).toMatch(/Rafa \(invitado\)/);
    expect(text).toMatch(/asistencia de Rafa \(invitado\)/);
    expect(text).not.toMatch(/guest:|Jugador/);
  });
  it("the island and the poster name him too", () => {
    const m = { ...WITH_GUEST, events: WITH_GUEST.events };
    expect(goalMoment(m, "a", member)?.said).toMatch(/Rafa \(invitado\)/);
    expect(posterContext(m, { players: [], seasonName: null }).nameOf(RAFA)).toBe("Rafa (invitado)");
  });
});

describe("invitados: el análisis técnico solo los cuenta para el equipo", () => {
  const events = [
    { id: "p1", type: "pass", outcome: "complete" as const, playerId: "ana", receiverId: RAFA },
    { id: "p2", type: "pass", outcome: "complete" as const, playerId: RAFA, receiverId: "bea" },
    { id: "s1", type: "shot", outcome: "on_target" as const, playerId: RAFA },
    { id: "g1", type: "goal", playerId: "ana", assistPlayerId: RAFA },
  ];
  it("no per-player row, link or shot-assist for a guest; the team totals keep his actions", () => {
    const a = analyseActions(events);
    expect(Object.keys(a.players).some(isGuestId)).toBe(false);
    expect(a.links.some((l) => isGuestId(l.from) || isGuestId(l.to))).toBe(false);
    expect(a.teams.us.passes).toBe(2);
    expect(a.teams.us.passesReceived).toBe(2);
    expect(a.teams.us.shots).toBe(2);
    expect(a.teams.us.shotAssists).toBe(1);
    expect(a.players.ana.passes).toBe(1);
    expect(a.players.bea.passesReceived).toBe(1);
    expect(technicalAnalysis(A).players[RAFA]).toBeUndefined();
  });
  it("the shot map names a guest's shot «Rafa (invitado)» from its match", () => {
    const match = { id: "j1", guests: GUESTS } as ClubMatch;
    const shot = { id: "j1__s1", type: "shot", playerId: RAFA };
    expect(shooterName(shot, (id) => (id === "j1__s1" ? match : undefined), () => "Jugador")).toBe("Rafa (invitado)");
    expect(shooterName(shot, () => undefined, () => "Jugador")).toBe("Invitado");
    expect(shooterName({ id: "x", type: "shot", playerId: "ana" }, () => undefined, (id) => id.toUpperCase())).toBe("ANA");
  });
});

describe("invitados en el servidor: la lista y sus referencias", () => {
  it("a guest the acta names can't leave the list (published or draft events); one it doesn't name can", () => {
    const named = [{ id: "e", type: "goal", playerId: "ana", assistPlayerId: RAFA }];
    expect(guestRemovalProblem(GUESTS, [], named)).toBe("Rafa sale en el acta: quita antes sus jugadas.");
    expect(guestRemovalProblem(GUESTS, [], [], [{ receiverId: RAFA }])).toMatch(/sale en el acta/);
    expect(guestRemovalProblem(GUESTS, [{ id: "g1", name: "Rafael" }], named)).toBeNull();
    expect(guestRemovalProblem(GUESTS, [], [{ playerId: "ana" }], undefined)).toBeNull();
  });
  it("every guest reference on the list, a draft's too", () => {
    expect(guestRefsProblem({ guests: GUESTS, starters: [RAFA], events: [{ playerId: RAFA }] })).toBeNull();
    expect(guestRefsProblem({ guests: GUESTS, bench: ["guest:g2"] })).toMatch(/invitado/);
    expect(guestRefsProblem({ guests: GUESTS, events: [{ receiverId: "guest:g3" }] })).toMatch(/invitado/);
    expect(guestRefsProblem({ guests: GUESTS, notCalled: [RAFA] })).toMatch(/invitado/);
  });
});
