import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import type { ClubMatch } from "../../../lib/clubData";
import {
  buildOverview,
  contentGaps,
  convocatoriaState,
  doneLines,
  lastActaMatch,
  matchGroup,
  matchState,
  mergeMatches,
  mvpNote,
  nextMatch,
  reviewActa,
  rsvpCounts,
  shortDate,
  clockTime,
  type OverviewInput,
} from "./adminLogic";

// Monday 2 Nov 2026, 10:00 in Madrid.
const NOW = Date.UTC(2026, 10, 2, 9, 0);
const at = (d: number, h: number) => Date.UTC(2026, 10, d, h - 1, 0); // Madrid = UTC+1 in November
const ROSTER = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
const STARTERS = ROSTER.slice(0, 7);
const goal = (id: string, minute: number, playerId: string, assistPlayerId?: string): MatchEvent => ({ id, type: "goal", minute, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });

const published: ClubMatch[] = [
  { id: "m8", seasonId: "t1", rival: "MAD SKY", date: at(8, 12), status: "scheduled", home: false, starters: [], bench: [], notCalled: [] },
  { id: "m7", seasonId: "t1", rival: "FUSION 7", date: at(1, 10), status: "scheduled", home: true },
  { id: "m6", seasonId: "t1", rival: "Emirates", date: at(25 - 31, 10), status: "finished", goalsFor: 4, goalsAgainst: 1, voteClosesAt: at(27 - 31, 10) },
];
const draft7 = {
  id: "m7",
  seasonId: "t1",
  rival: "FUSION 7",
  date: at(1, 10),
  status: "finished" as const,
  duration: 50,
  home: true,
  goalsFor: 3,
  goalsAgainst: 1,
  starters: STARTERS,
  bench: ["p8", "p9"],
  notCalled: [],
  events: [goal("g1", 9, "p6", "p5"), goal("g2", 31, "p6", "p7"), { id: "r1", type: "opponent_goal" as const, minute: 18 }],
  updatedAt: at(1, 13),
};

describe("dates in club time", () => {
  it("formats day and time in Madrid", () => {
    expect(shortDate(at(1, 10))).toBe("dom 1 nov");
    expect(clockTime(at(8, 12))).toBe("12:00");
  });
});

describe("mergeMatches", () => {
  it("merges drafts over published matches and numbers jornadas per season by date", () => {
    const list = mergeMatches(published, [draft7]);
    expect(list.map((m) => [m.id, m.jornada])).toEqual([
      ["m6", 1],
      ["m7", 2],
      ["m8", 3],
    ]);
    const m7 = list.find((m) => m.id === "m7")!;
    expect(m7.draft).toBe(true);
    expect(m7.published).toBe(true);
    expect(m7.goalsFor).toBe(3);
    expect(m7.draftSavedAt).toBe(at(1, 13));
    expect("updatedAt" in m7).toBe(false);
  });
  it("keeps a draft of a brand-new match as unpublished", () => {
    const list = mergeMatches([], [{ id: "new", seasonId: "t1", rival: "X", date: at(20, 10) }]);
    expect(list[0]).toMatchObject({ id: "new", draft: true, published: false, jornada: 1 });
  });
});

describe("match states", () => {
  const list = mergeMatches(published, []);
  const next = nextMatch(list, NOW);
  it("finds the next fixture and the acta that matters", () => {
    expect(next?.id).toBe("m8");
    expect(lastActaMatch(list, NOW)?.id).toBe("m7"); // played, still unpublished
  });
  it("classifies each match", () => {
    const st = Object.fromEntries(list.map((m) => [m.id, matchState(m, NOW, next?.id)]));
    expect(st).toEqual({ m6: "published", m7: "acta", m8: "next" });
    expect(matchGroup("acta")).toBe("hacer");
    expect(matchGroup("published")).toBe("publicados");
    expect(matchGroup("scheduled")).toBe("jugar");
  });
  it("a draft is a draft whatever its phase", () => {
    const merged = mergeMatches(published, [draft7]);
    expect(matchState(merged.find((m) => m.id === "m7")!, NOW, "m8")).toBe("draft");
  });
  it("falls back to the last published match when nothing is pending", () => {
    const done = mergeMatches([{ ...published[2] }], []);
    expect(lastActaMatch(done, NOW)?.id).toBe("m6");
  });
});

describe("reviewActa («¿Cuadra?»)", () => {
  it("asks for the missing scorer of the third goal", () => {
    const r = reviewActa(draft7, ROSTER, NOW);
    expect(r.missingScorers).toBe(1);
    expect(r.firstMissingGoal).toBe(3);
    expect(r.reasons[0]).toBe("falta el goleador del gol 3");
    expect(r.why).toBe("Para publicar: falta el goleador del gol 3.");
    expect(r.steps.map((s) => [s.key, s.tone, s.summary])).toEqual([
      ["encuentro", "ok", "dom 1 nov"],
      ["convocatoria", "ok", "7 + 2"],
      ["acta", "warn", "falta 1"],
      ["publicar", "", "pendiente"],
    ]);
  });
  it("squares once the goal has its scorer", () => {
    const full = { ...draft7, events: [...draft7.events, goal("g3", 46, "p3")] };
    const r = reviewActa(full, ROSTER, NOW);
    expect(r.cuadra).toBe(true);
    expect(r.items.find((i) => i.key === "goles")).toMatchObject({ tone: "ok", title: "Goles: 3 en el marcador, 3 con nombre" });
    expect(r.assisted).toBe(2);
    expect(r.ours).toBe(3);
    expect(r.why).toBe("Al publicar se actualiza la web y se abre el MVP (48 h).");
    expect(r.steps[2]).toMatchObject({ tone: "ok", summary: "3–1" });
  });
  it("flags the convocatoria: too many starters, or players left unassigned", () => {
    const eight = reviewActa({ ...draft7, starters: [...STARTERS, "p8"], bench: ["p9"] }, ROSTER, NOW);
    expect(eight.items.find((i) => i.key === "convocatoria")?.title).toBe("Hay más de siete titulares");
    const loose = reviewActa({ ...draft7, bench: ["p8"] }, ROSTER, NOW);
    expect(loose.unassigned).toBe(1);
    expect(loose.items.find((i) => i.key === "convocatoria")?.title).toBe("Hay 1 jugador sin asignar");
  });
  it("asks to mark a played match as finished", () => {
    const r = reviewActa(published[1], ROSTER, NOW);
    expect(r.items[0]).toMatchObject({ key: "encuentro", tone: "warn", title: "Márcalo como finalizado" });
    expect(r.cuadra).toBe(false);
  });
  it("does not ask for an acta before the match", () => {
    const r = reviewActa(published[0], ROSTER, NOW);
    expect(r.finished).toBe(false);
    expect(r.items.some((i) => i.key === "goles")).toBe(false);
    expect(r.steps[2]).toMatchObject({ tone: "", summary: "sin jugar" });
  });
  it("reads a published, clean match as done", () => {
    const full = { ...draft7, events: [...draft7.events, goal("g3", 46, "p3")] };
    const r = reviewActa(full, ROSTER, NOW, true);
    expect(r.steps[3]).toMatchObject({ tone: "ok", mark: "✓", summary: "publicada" });
    expect(r.why).toBe("Calendario, perfiles y estadísticas al día.");
  });
});

describe("convocatoria and RSVP", () => {
  it("counts the unassigned and says it", () => {
    const c = convocatoriaState({ starters: ["p1", "p2"], bench: ["p3"], notCalled: [] }, ROSTER, true);
    expect(c).toMatchObject({ unassigned: 6, ready: false, published: false, tone: "warn", mark: "!", text: "6 sin asignar en la convocatoria" });
  });
  it("is published when ready and live", () => {
    const c = convocatoriaState({ starters: STARTERS, bench: ["p8"], notCalled: ["p9"] }, ROSTER, true);
    expect(c).toMatchObject({ ready: true, published: true, tone: "pub", text: "Convocatoria publicada" });
    expect(convocatoriaState({ starters: STARTERS, bench: ["p8"], notCalled: ["p9"] }, ROSTER, false).text).toBe("Convocatoria lista para publicar");
  });
  it("counts answers once per player", () => {
    const r = rsvpCounts(
      [
        { response: "yes", playerId: "p1" },
        { response: "maybe", playerId: "p2" },
        { response: "no", playerId: "p3" },
        { response: "yes", playerId: null },
      ],
      ROSTER,
    );
    expect(r).toEqual({ yes: 2, maybe: 1, no: 1, none: 6 });
  });
});

describe("contentGaps", () => {
  it("lists what the club page still lacks", () => {
    const g = contentGaps({ crestStory: "", email: "", instagram: "", photoUrl: "https://x/y.jpg" }, [
      { name: "ERIK", bio: "Delantero" },
      { name: "BRAWAN" },
      { name: "KEVIN", bio: " " },
    ]);
    expect(g.map((x) => x.key)).toEqual(["historias", "escudo", "contacto"]);
    expect(g[0]).toMatchObject({ title: "Historias de jugadores: 1 de 3", detail: "Faltan BRAWAN y KEVIN" });
  });
  it("is empty when everything is filled in", () => {
    expect(contentGaps({ crestStory: "x", email: "a@b.c", photoUrl: "https://x" }, [{ name: "A", bio: "b" }])).toEqual([]);
  });
});

describe("mvpNote", () => {
  it("says when the open vote closes", () => {
    expect(mvpNote({ openUntil: at(3, 12), actaPending: false, previous: null })).toBe("votación abierta · cierra el mar 3 nov a las 12:00. Se abrió sola al publicar.");
  });
  it("explains the vote and recalls the last winner while the acta is pending", () => {
    expect(mvpNote({ openUntil: null, actaPending: true, previous: { jornada: 6, names: ["ERIK"], votes: 9 } })).toBe("la votación se abre sola al publicar el acta y dura 48 h. J6: ganó ERIK con 9 votos.");
    expect(mvpNote({ openUntil: null, actaPending: false, previous: { jornada: 6, names: ["ERIK", "EVANS"], votes: 4 } })).toBe("J6: empate entre ERIK y EVANS con 4 votos.");
  });
});

describe("buildOverview (Hoy: Por hacer, «N hechas», the rail counters)", () => {
  const list = mergeMatches(published, [draft7]);
  const m7 = list.find((m) => m.id === "m7")!;
  const m8 = list.find((m) => m.id === "m8")!;
  const base: OverviewInput = {
    actas: [{ match: m7, review: reviewActa(m7, ROSTER, NOW) }],
    heroId: m8.id,
    claims: [{ playerName: "KEVIN" }, { playerName: "FER" }],
    contentGaps: [{ key: "escudo", title: "Historia del escudo", detail: "Sin escribir" }],
    contentDrafts: [{ key: "momentos", title: "Momentos del club" }],
    done: ["Acta J1 publicada · Emirates 4–1"],
  };
  it("lists only what is pending, with its action", () => {
    const o = buildOverview(base);
    expect(o.pending.map((t) => t.title)).toEqual(["Acta J2 · falta el goleador del gol 3", "2 fichas piden paso", "Momentos del club · sin publicar", "Historia del escudo · por completar"]);
    expect(o.pending[0]).toMatchObject({ detail: "FUSION 7 · 3–1", ved: "V", action: { label: "Completar", target: { section: "partidos", matchId: "m7", tab: "acta" } } });
    expect(o.pending[1]).toMatchObject({ detail: "KEVIN y FER quieren su camiseta", ved: null, action: { label: "Revisar", target: { section: "fichas" } } });
    expect(o.pending[2].action).toEqual({ label: "Publicar", target: { section: "contenido", seccion: "momentos" } });
    expect(o.pending[3].action).toEqual({ label: "Completar", target: { section: "contenido", seccion: "escudo" } });
    expect(o.done).toEqual(["Acta J1 publicada · Emirates 4–1"]);
  });
  it("leaves the hero's own acta out of «Por hacer» (Hoy shows it) but counts it in Partidos", () => {
    const o = buildOverview({ ...base, heroId: m7.id });
    expect(o.pending.some((t) => t.key === "acta-m7")).toBe(false);
    expect(o.counters.partidos).toEqual({ n: 1, label: "1 por hacer" });
  });
  it("counts exceptions only: Hoy = pending, Partidos = played unpublished, Fichas, Contenido", () => {
    const c = buildOverview(base).counters;
    expect(c.hoy).toEqual({ n: 4, label: "4 por hacer" });
    expect(c.fichas).toEqual({ n: 2, label: "2 por hacer" });
    expect(c.contenido).toEqual({ n: 2, label: "2 por hacer" });
    const none = buildOverview({ ...base, actas: [], claims: [], contentGaps: [], contentDrafts: [] });
    expect(none.pending).toEqual([]);
    expect(none.counters.hoy).toEqual({ n: 0, label: "" });
  });
  it("one ficha reads in the singular", () => {
    expect(buildOverview({ ...base, claims: [{ playerName: "KEVIN" }] }).pending[1]).toMatchObject({ title: "1 ficha pide paso", detail: "KEVIN quiere su camiseta" });
  });
});

describe("doneLines («N hechas»)", () => {
  const list = mergeMatches(published, [draft7]);
  it("the notice sent, the last acta published and the MVP closed", () => {
    const m8 = list.find((m) => m.id === "m8")!;
    const m7 = list.find((m) => m.id === "m7")!;
    expect(doneLines({ lastPublished: { match: m7, goalsFor: 4, goalsAgainst: 1 }, mvp: { jornada: 6, names: ["ERIK"] }, notified: m8 })).toEqual([
      "Aviso de la J3 enviado · RSVP abierta",
      "Acta J2 publicada · FUSION 7 4–1",
      "MVP J6 cerrado · ganó ERIK",
    ]);
    expect(doneLines({ lastPublished: null, mvp: { jornada: null, names: ["ERIK", "EVANS"] }, notified: null })).toEqual(["MVP del último partido cerrado · empate entre ERIK y EVANS"]);
  });
});
