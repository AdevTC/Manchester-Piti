import { describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../../functions/src/matchEngine";
import { notasDoc, parseStoredNotas, storedNotasOf, type StoredNotas } from "../../../functions/src/rating/frozen";
import type { ClubMatch } from "../clubData";
import type { Standings } from "../standings";
import { MODEL_VERSION } from "./constants";
import { frozenNotas, matchNotas, seasonRatings } from "./season";

// «La nota congelada» (docs/medias.md): each acta's notas are rated when it is published, with the season up to it.

const row = (minutes: number, extra: Partial<Participation> = {}): Participation => ({ ...emptyParticipation(), played: true, minutes, ...extra });
let n = 0;
const match = (ledger: Record<string, Participation>, extra: Partial<ClubMatch> = {}): ClubMatch => ({ id: `f${++n}`, seasonId: "s", rival: "Rival", status: "finished", date: n * 86_400_000, duration: 50, goalsFor: 0, goalsAgainst: 0, events: [], ledger, ...extra });
const stored = (players: StoredNotas["players"], rival = 1, model = MODEL_VERSION): StoredNotas => ({ model, rival, players });

describe("the stored notas", () => {
  it("read back what the acta stores, dropping a malformed player and refusing a malformed doc", () => {
    const doc = notasDoc(stored({ a: { nota: 7.4321, minutes: 50, weight: 1, narrated: true } }, 1.0456), 123);
    expect(doc).toEqual({ model: MODEL_VERSION, rival: 1.046, at: 123, players: { a: { nota: 7.432, minutes: 50, weight: 1, narrated: true } } });
    expect(parseStoredNotas({ ...doc, players: { ...doc.players, "b/c": { nota: 5, minutes: 50, weight: 1, narrated: true }, d: { nota: 12, minutes: 50, weight: 1, narrated: true } } })?.players).toEqual(doc.players);
    expect(parseStoredNotas(null)).toBeNull();
    expect(parseStoredNotas({ model: MODEL_VERSION, rival: "x", players: {} })).toBeNull();
  });
  it("another model's notas are rated again", () => {
    expect(storedNotasOf({ notas: stored({}, 1, "piti-media-v0") })).toBeNull();
    expect(storedNotasOf({ notas: stored({}) })?.model).toBe(MODEL_VERSION);
  });
});

describe("congelada: a match keeps the nota of its day", () => {
  it("a later match never moves an earlier one's notas (rated with the season up to it)", () => {
    const j1 = match({ a: row(50, { goals: 1 }), b: row(50), c: row(50) });
    const alone = seasonRatings([j1]).noteOf(j1.id, "a")!.nota;
    const j2 = match({ a: row(50), b: row(50, { goals: 2 }), c: row(50) });
    const both = seasonRatings([j1, j2]);
    expect(both.noteOf(j1.id, "a")!.nota).toBe(alone);
    // and the later one is rated with both
    expect(both.noteOf(j2.id, "b")!.nota).toBe(frozenNotas(j2, [j1, j2], []).players.b.nota);
  });

  it("the stored notas win: GLOBAL is their mean, whatever the acta's values say now", () => {
    const j1 = match({ a: row(50), b: row(50) }, { notas: stored({ a: { nota: 9, minutes: 50, weight: 1, narrated: true }, b: { nota: 5, minutes: 50, weight: 1, narrated: true } }) });
    const r = seasonRatings([j1]);
    expect(r.noteOf(j1.id, "a")!.nota).toBe(9);
    expect(r.players.get("a")!.value).toBe(Math.round((10 * (9 + 3 * 6.5)) / 4));
  });

  it("the rival factor: this match's from the table (or the one a correction keeps), the earlier ones' frozen", () => {
    const table: Standings = {
      id: "s",
      competition: "Liga",
      jornada: 2,
      updatedAt: 0,
      updatedBy: "",
      rows: [
        { team: "Piti", pj: 2, g: 1, e: 0, p: 1, gf: 3, gc: 3, pts: 3, isUs: true },
        { team: "Fuertes", pj: 2, g: 2, e: 0, p: 0, gf: 6, gc: 1, pts: 6, isUs: false },
        { team: "Flojos", pj: 2, g: 0, e: 0, p: 2, gf: 1, gc: 6, pts: 0, isUs: false },
      ],
    };
    const j1 = match({ a: row(50, { goals: 1 }), b: row(50) }, { rival: "Flojos", notas: stored({}, 0.9) });
    const j2 = match({ a: row(50, { goals: 1 }), b: row(50) }, { rival: "Fuertes" });
    const fresh = frozenNotas(j2, [j1, j2], [table]);
    expect(fresh.rival).toBeGreaterThan(1);
    expect(frozenNotas(j2, [j1, j2], [table], 1.01).rival).toBe(1.01);
    // a later match is not part of an earlier one's season
    expect(Object.keys(frozenNotas(j1, [j1, j2], [table]).players).sort()).toEqual(["a", "b"]);
  });
});

describe("matchNotas: what a page that only shows notas reads", () => {
  it("reads the frozen notas without rating the season, and rates it when an acta has none", () => {
    const frozen = match({ a: row(50), b: row(50) }, { notas: stored({ a: { nota: 8.8, minutes: 50, weight: 1, narrated: true } }) });
    expect(matchNotas([frozen])(frozen.id, "a")?.nota).toBe(8.8);
    expect(matchNotas([frozen])(frozen.id, "b")).toBeNull();
    const open = match({ a: row(50, { goals: 1 }), b: row(50) });
    expect(matchNotas([frozen, open])(open.id, "a")?.nota).toBe(seasonRatings([frozen, open]).noteOf(open.id, "a")?.nota);
  });
});
