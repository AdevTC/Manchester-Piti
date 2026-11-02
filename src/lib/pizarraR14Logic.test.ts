// r14 · the server's pure rules (functions/src/pizarraR14Logic.ts): the official seven's version, the board's
// history and the fan view (nothing private ever reaches it).
import { describe, expect, it } from "vitest";
import { boardSevenKey, fanBoardOf, fanShirt, fanTokenOf, historyKind, historyPlan, HISTORY_MAX, reactionCurrent, SEVEN_KEY_MAX, sevenStamp, snapshotOf } from "../../functions/src/pizarraR14Logic";

const slots = (ids: (string | null)[]) => ids.map((playerId) => ({ playerId }));
const seven = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];

describe("sevenKey always fits its rule (revisión)", () => {
  it("normal ids as is; ids past the rules' cap hashed, stable and distinct", () => {
    expect(boardSevenKey({ slots: slots(seven) })).toBe([...seven].sort().join(","));
    const long = (c: string) => slots(Array.from({ length: 7 }, (_, i) => c.repeat(200) + i));
    const k = boardSevenKey({ slots: long("a") });
    expect(k.length).toBeLessThanOrEqual(SEVEN_KEY_MAX);
    expect(k).toMatch(/^h:/);
    expect(boardSevenKey({ slots: long("a") })).toBe(k);
    expect(boardSevenKey({ slots: long("b") })).not.toBe(k);
  });
});

describe("sevenStamp (PZ-D01)", () => {
  it("publishing bumps the version; the same seven again does nothing", () => {
    const pub = sevenStamp({ isOfficial: false, slots: slots(seven) }, { isOfficial: true, slots: slots(seven), matchId: "j3" });
    expect(pub).toEqual({ sevenKey: [...seven].sort().join(","), sevenRev: 1, bumped: true });
    const stamped = { isOfficial: true, matchId: "j3", slots: slots(seven), sevenKey: pub!.sevenKey, sevenRev: 1 };
    expect(sevenStamp({ ...stamped, sevenKey: undefined, sevenRev: undefined }, stamped)).toBeNull();
    // a place swap is the same seven
    expect(sevenStamp(stamped, { ...stamped, slots: slots([...seven].reverse()) })).toBeNull();
  });
  it("someone new in the seven bumps it", () => {
    const stamped = { isOfficial: true, matchId: "j3", slots: slots(seven), sevenKey: [...seven].sort().join(","), sevenRev: 4 };
    const next = sevenStamp(stamped, { ...stamped, slots: slots([...seven.slice(0, 6), "kevin"]) });
    expect(next).toMatchObject({ sevenRev: 5, bumped: true });
  });
  it("an official from before r14 only gets its key while its seven stays", () => {
    const old = { isOfficial: true, matchId: "j3", slots: slots(seven) };
    expect(sevenStamp(old, { ...old })).toEqual({ sevenKey: [...seven].sort().join(","), sevenRev: 0, bumped: false });
    expect(sevenStamp(old, { ...old, slots: slots([...seven.slice(0, 6), "kevin"]) })).toMatchObject({ sevenRev: 1, bumped: true });
  });
  it("official of another match = published again; not official = nothing", () => {
    const b = { isOfficial: true, matchId: "j3", slots: slots(seven), sevenKey: "k", sevenRev: 2 };
    expect(sevenStamp(b, { ...b, matchId: "j4" })).toMatchObject({ sevenRev: 3, bumped: true });
    expect(sevenStamp(b, { ...b, isOfficial: false })).toBeNull();
    expect(reactionCurrent({ rev: 2 }, { sevenRev: 2 })).toBe(true);
    expect(reactionCurrent({}, { sevenRev: 2 })).toBe(false);
    expect(reactionCurrent({}, {})).toBe(true);
  });
});

describe("la historia (PZ-D21T)", () => {
  const b = { formation: "2-3-1", slots: slots(seven) };
  it("snapshots on create, publish, sistema and someone coming in — not on a swap or a tactic", () => {
    expect(historyKind(undefined, b)).toBe("nuevo");
    expect(historyKind(b, { ...b, isOfficial: true })).toBe("publica");
    expect(historyKind(b, { ...b, formation: "3-2-1" })).toBe("sistema");
    expect(historyKind(b, { ...b, slots: slots([...seven.slice(0, 6), "kevin"]) })).toBe("entra");
    expect(historyKind(b, { ...b, slots: slots([...seven].reverse()) })).toBeNull();
    expect(historyKind(b, undefined)).toBeNull();
  });
  it("a burst of the same change is one snapshot; never more than 20", () => {
    const now = 1_000_000;
    expect(historyPlan([{ id: "a", kind: "entra", at: now - 60_000 }], "entra", now)).toEqual({ replace: "a", drop: [] });
    expect(historyPlan([{ id: "a", kind: "entra", at: now - 3_600_000 }], "entra", now).replace).toBeNull();
    expect(historyPlan([{ id: "a", kind: "publica", at: now }], "publica", now).replace).toBeNull();
    const full = Array.from({ length: HISTORY_MAX }, (_, i) => ({ id: "h" + i, kind: "sistema", at: now - i * 3_600_000 }));
    expect(historyPlan(full, "entra", now).drop).toEqual(["h19"]);
    const s = snapshotOf({ ...b, slots: slots([...seven.slice(0, 6), "kevin"]) }, "entra", b, now);
    expect(s.entra).toEqual(["kevin"]);
    expect(s.slots).toHaveLength(7);
    expect(s.slots[0].code).toBe("POR");
  });
});

describe("la vista de la afición (PZ-D21F)", () => {
  const players = new Map([
    ["evans", { firstName: "Evans", lastName: "Mensah Quaye", seasonDetails: { s1: { shirtName: "EVANS", number: 1 } } }],
    ["erik", { firstName: "Erik", lastName: "García López", shirtName: "ERIK" }],
    ["fer", { firstName: "Fernando José", lastName: "Ruiz" }],
  ]);
  it("only shirt names (or the first name) and dorsales; no notes, notas, owners or reactions", () => {
    const fan = fanBoardOf(
      {
        seasonId: "s1",
        matchId: "j3",
        isOfficial: true,
        ownerUid: "jordi",
        name: "Mi tablero secreto",
        formation: "2-3-1",
        slots: [{ playerId: "evans" }, { playerId: "fer" }, { playerId: "erik" }, { playerId: "guest:g1" }, { playerId: null }, { playerId: null }, { playerId: null }],
        roles: { captainId: "erik" },
        rival: { formation: "2-3-1", players: [{ num: 7, note: "Lesionado de la rodilla, a por él" }], visible: true },
        plan: { claves: ["Presión alta"], notes: "Nota privada del capitán" },
      },
      { players, guests: [{ id: "g1", name: "Rafa Gómez" }], match: { rival: "Red Demons", date: 5, venue: "CDM", home: true }, jornada: 3, now: 9 },
    );
    expect(fan.title).toBe("J3 · Red Demons");
    expect(fan.seven.map((p) => p.shirt)).toEqual(["EVANS", "Fernando", "ERIK", "Rafa"]);
    expect(fan.seven[0].num).toBe(1);
    expect(fan.seven[2].captain).toBe(true);
    expect(fan.rival).toEqual({ system: "2-3-1", nums: [7] });
    expect(fan.claves).toEqual(["Presión alta"]);
    const text = JSON.stringify(fan);
    for (const secret of ["Mensah", "García", "Ruiz", "Gómez", "Lesionado", "Nota privada", "secreto", "jordi"]) expect(text).not.toContain(secret);
  });
  it("a hidden rival is not shown; the season's board has no match", () => {
    const fan = fanBoardOf({ seasonId: "s1", matchId: null, slots: [], rival: { formation: "2-3-1", players: [], visible: false } }, { players: new Map(), now: 1 });
    expect(fan.rival).toBeNull();
    expect(fan.match).toBeNull();
    expect(fan.title).toBe("El siete de la temporada");
    expect(fanShirt(undefined, "s1")).toBe("Jugador");
  });
  it("tokens are 24 url-safe characters", () => {
    const t = fanTokenOf(new Uint8Array(24).map((_, i) => i * 37));
    expect(t).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});

