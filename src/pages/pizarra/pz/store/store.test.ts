// @vitest-environment jsdom
// r14 «La pizarra»: the store's logic (the prototype's PI-store.js behaviour over the app's Lineup).
import { describe, expect, it, vi } from "vitest";
import { fakeBoard, fakeWorld, makeTestStore, ME_CAPTAIN, ME_PLAYER } from "./testkit";
import { guestOf, pizarraSeason } from "./world";
import { registerSheet } from "./registry";
import { rivalSpotNear } from "./view";
import type { Lineup } from "../../formations";

const lastCommit = (host: ReturnType<typeof makeTestStore>["host"]): Lineup => host.commit.mock.calls.at(-1)?.[0] as Lineup;
const ids = (L: Lineup) => L.slots.map((s) => s.playerId);

describe("the seven", () => {
  it("places a player in an empty slot, saves through the session and toasts with Deshacer", () => {
    const { P, host } = makeTestStore();
    P.act.place("alcides", 6);
    expect(ids(lastCommit(host))[6]).toBe("alcides");
    expect(P.state.toast?.text).toBe("ALCIDES al DC");
    expect(P.state.toast?.undo).toBeTruthy();
    expect(P.sel.status().full).toBe(true);
    // the seven became complete: the light sweeps once
    expect(P.state.flash).toBeGreaterThan(0);
  });

  it("undo restores only the seven, redo puts it back", () => {
    const { P, host } = makeTestStore();
    P.act.place("alcides", 6);
    P.act.undo();
    expect(ids(lastCommit(host))[6]).toBeNull();
    expect(P.state.toast?.text).toBe("Deshecho: ALCIDES al DC");
    P.act.redo();
    expect(ids(lastCommit(host))[6]).toBe("alcides");
  });

  it("swaps two slots and sends one to the bench", () => {
    const { P, host } = makeTestStore();
    P.act.swap(1, 2);
    expect(ids(lastCommit(host)).slice(1, 3)).toEqual(["erik", "fer"]);
    P.act.remove(1);
    expect(ids(lastCommit(host))[1]).toBeNull();
    expect(P.state.toast?.text).toBe("ERIK al banquillo");
  });

  it("a player who can't come is not placed (No va)", () => {
    const { P, host } = makeTestStore();
    P.act.place("josito", 6);
    expect(host.commit).not.toHaveBeenCalled();
    expect(P.state.toast?.text).toMatch(/JOSITO: .*No se puede colocar/);
  });

  it("a new sistema keeps the players by slot order", () => {
    const { P, host } = makeTestStore();
    P.act.setSistema("2-3-1");
    const L = lastCommit(host);
    expect(L.formation).toBe("2-3-1");
    expect(ids(L)).toEqual(["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", null]);
    expect(L.slots.map((s) => s.position)).toEqual(["POR", "DFC", "DFC", "MI", "MC", "MD", "DC"]);
  });

  it("the 2ª parte is created as a copy of the titular and edited apart", () => {
    const { P, host } = makeTestStore();
    P.act.setVersion("segunda");
    expect(P.state.version).toBe("segunda");
    const L = lastCommit(host);
    expect(L.variants?.[0]?.id).toBe("v2");
    expect(P.sel.ver()?.exists).toBe(true);
    P.act.place("kevin", 6);
    const L2 = lastCommit(host);
    expect(L2.variants?.[0]?.slots[6]?.playerId).toBe("kevin");
    expect(L2.slots[6]?.playerId).toBeNull();
  });

  it("a read-only board answers with «Solo lectura» and Duplicar", () => {
    const { P, host } = makeTestStore({ me: ME_PLAYER, world: fakeWorld({ boards: [fakeBoard({ isOfficial: true })] }) });
    P.act.place("alcides", 6);
    expect(host.commit).not.toHaveBeenCalled();
    expect(P.state.toast?.text).toMatch(/solo lectura/i);
    expect(P.state.toast?.action?.t).toBe("Duplicar");
  });
});

describe("who can come", () => {
  it("an absence over the match's day wins over the answer, with its why", () => {
    const { P } = makeTestStore({ world: fakeWorld({ absences: [{ pid: "kevin", from: "2026-11-07", to: "2026-11-12", note: "Boda en Sevilla" }] }) });
    const r = P.sel.rsvp("kevin");
    expect(r).toMatchObject({ v: "ausente", can: false });
    expect(r.why).toBe("Ausente · hasta el 12 nov · boda en sevilla");
    // an absence on other days says nothing
    const h2 = makeTestStore({ world: fakeWorld({ absences: [{ pid: "kevin", from: "2026-11-10", to: "2026-11-12", note: "" }] }) });
    expect(h2.P.sel.rsvp("kevin").v).toBe("yes");
  });
  it("the match's guests are players of the pool (Invitado) and candidates", () => {
    const { P } = makeTestStore({ world: fakeWorld({ guests: [guestOf({ id: "g-rafa", name: "Rafa" })] }) });
    expect(P.sel.player("g-rafa")).toMatchObject({ shirt: "RAFA", guest: true });
    expect(P.sel.rsvp("g-rafa")).toMatchObject({ v: "guest", can: true });
    expect(P.sel.candidates(6).some((c) => c.pid === "g-rafa")).toBe(true);
  });
  it("candidates say where he has played (minutes per puesto)", () => {
    const w = fakeWorld();
    w.squad = w.squad.map((p) => (p.id === "kevin" ? { ...p, playedAt: { DC: 44 } } : p));
    const { P } = makeTestStore({ world: w });
    expect(P.sel.candidates(6).find((c) => c.pid === "kevin")?.why).toMatch(/^Ha jugado de DC 44′/);
  });
});

describe("busy: what holds the app's update reload", () => {
  it("idle → not busy; a pending save, a sheet, a drawing, the charla or a 12 s undo window → busy", () => {
    const h = makeTestStore();
    expect(h.P.sel.busy()).toBe(false);
    h.attach({ saveStatus: "saving" });
    expect(h.P.sel.busy()).toBe(true);
    h.attach({ saveStatus: "offline" });
    expect(h.P.sel.busy()).toBe(true);
    h.attach({ saveStatus: "saved" });
    h.P.act.openSheet("sistema");
    expect(h.P.sel.busy()).toBe(true);
    h.P.act.closeSheet();
    h.P.act.setDrawing(true);
    expect(h.P.sel.busy()).toBe(true);
    h.P.act.setDrawing(false);
    h.P.setRoute({ place: "charla", sub: "", q: {} });
    expect(h.P.sel.busy()).toBe(true);
    h.P.setRoute({ place: "siete", sub: "", q: {} });
    expect(h.P.sel.busy()).toBe(false);
    h.P.act.deleteBoard("b1");
    expect(h.P.sel.busy()).toBe(true);
  });
  it("the undo window closes after 12 s", () => {
    vi.useFakeTimers();
    try {
      const h = makeTestStore();
      h.P.holdFor(12500);
      expect(h.P.sel.busy()).toBe(true);
      vi.advanceTimersByTime(13000);
      expect(h.P.sel.busy()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("publish: undo and redo stay on THAT board", () => {
  const full = ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"];
  const world = () => fakeWorld({ boards: [fakeBoard({ id: "A", name: "Tablero A", ids: full }), fakeBoard({ id: "B", name: "Tablero B", ids: full })], official: { boardId: "Z", matchId: "j3" } });
  it("publishes the board on screen by id; after opening another, redo refuses (it never publishes the other)", async () => {
    const h = makeTestStore({ world: world(), boardId: "A" });
    await h.P.act.publish();
    expect(h.host.publish).toHaveBeenLastCalledWith({ convocatoria: true, boardId: "A", matchId: "j3" });
    h.attach({ boardId: "B" });
    h.P.act.undo();
    expect(h.host.unpublish).toHaveBeenCalledWith("A");
    h.P.act.redo();
    expect(h.host.publish).toHaveBeenCalledTimes(1);
    expect(h.P.state.toast?.text).toBe("Para volver a publicar «Tablero A», ábrelo primero");
    // still there to redo once A is open again
    expect(h.P.sel.canRedo()).toBe(true);
    h.attach({ boardId: "A" });
    h.P.act.redo();
    expect(h.host.publish).toHaveBeenLastCalledWith({ convocatoria: false, boardId: "A", matchId: "j3" });
  });
  it("says that the official it replaced is not put back by Deshacer", async () => {
    const w = world();
    w.boards.push(fakeBoard({ id: "Z", name: "El de antes", isOfficial: true }));
    const h = makeTestStore({ world: w, boardId: "A" });
    await h.P.act.publish();
    expect(h.P.state.toast?.text).toMatch(/«El de antes» deja de ser el oficial \(Deshacer no lo vuelve a publicar\)/);
  });
});

describe("history entries, copies, members, sheet texts", () => {
  it("every entry has an id and a scope; undoEntry undoes that one wherever it is", () => {
    const { P, host } = makeTestStore();
    const hid = P.act.deleteBoard("b1");
    expect(typeof hid).toBe("number");
    expect(P.sel.histTop()).toMatchObject({ id: hid, scope: "boards" });
    P.act.place("alcides", 6);
    expect(P.sel.histTop()?.scope).toBe("siete");
    const undoDelete = host.remove.mock.results[0]?.value as () => void;
    expect(P.act.undoEntry(hid as number)).toBe(true);
    expect(typeof undoDelete).toBe("function");
    // the siete entry is still the top one
    expect(P.sel.histTop()?.label).toBe("ALCIDES al DC");
    expect(P.act.undoEntry(9999)).toBe(false);
  });
  it("pushUndo returns its id", () => {
    const { P } = makeTestStore();
    const id = P.pushUndo("Etiqueta", () => undefined, () => undefined, { toast: false, scope: "tableros" });
    expect(P.sel.histTop()).toEqual({ id, scope: "tableros", label: "Etiqueta" });
  });
  it("duplicate: the copy's id comes back and undo deletes the copy", async () => {
    const { P, host } = makeTestStore();
    P.act.duplicate();
    await new Promise((r) => setTimeout(r, 0));
    expect(host.duplicate).toHaveBeenCalledWith(null);
    expect(P.sel.histTop()).toMatchObject({ label: "Copia creada", scope: "boards" });
    P.act.undo();
    expect(host.remove).toHaveBeenCalledWith("b-copia");
  });
  it("members without a ficha who answered are counted apart", () => {
    const { P } = makeTestStore({ world: fakeWorld({ members: [{ uid: "u-marta", name: "Marta", v: "yes" }] }) });
    expect(P.sel.counts().members).toEqual([{ uid: "u-marta", who: "Marta", v: "yes" }]);
  });
  it("a sheet's title can read the store", () => {
    registerSheet("t-prueba", { title: (args, P) => `${String(args.n)} · ${P.sel.board()?.name ?? ""}` });
    const { P } = makeTestStore();
    P.act.openSheet("t-prueba", { n: 3 });
    expect(P.sel.sheetMeta()?.title).toBe("3 · J3 · Red Demons");
  });
  it("?alto= opens the phone sheet at that height", () => {
    const { P } = makeTestStore({ layout: "phone" });
    P.setRoute({ place: "siete", sub: "", q: { alto: "full" } });
    expect(P.state.sheetH).toBe("full");
  });
});

describe("other fields of the board", () => {
  it("saveBoard writes through the session and its undo restores only those fields", () => {
    const { P, host } = makeTestStore();
    P.act.saveBoard({ tags: ["Liga"] }, "Etiqueta «Liga»");
    expect(lastCommit(host).tags).toEqual(["Liga"]);
    P.act.place("alcides", 6);
    P.act.undo();
    P.act.undo();
    const L = lastCommit(host);
    expect(L.tags).toBeUndefined();
    expect(ids(L)[6]).toBeNull();
  });
  it("a read-only board is not written", () => {
    const { P, host } = makeTestStore({ me: ME_PLAYER, world: fakeWorld({ boards: [fakeBoard({ isOfficial: true })] }) });
    expect(P.act.saveBoard({ tags: ["x"] }, "x")).toBe(false);
    expect(host.commit).not.toHaveBeenCalled();
  });
});

describe("taps", () => {
  it("tap-tap: a shirt in the hand, then a slot swaps; the same shirt again opens the ficha", () => {
    const { P, host } = makeTestStore();
    P.act.tapSlot(1);
    expect(P.state.sel).toEqual({ pid: "fer", from: "campo", slot: 1 });
    P.act.tapSlot(2);
    expect(ids(lastCommit(host)).slice(1, 3)).toEqual(["erik", "fer"]);
    P.act.tapSlot(4);
    P.act.tapSlot(4);
    expect(P.state.sheet?.name).toBe("ficha");
    expect(P.state.sheet?.args.pid).toBe("adrian");
  });

  it("an empty slot opens the Candidatos sheet (?hoja=candidatos&hueco=6)", () => {
    const { P, host } = makeTestStore();
    P.act.tapSlot(6);
    expect(P.state.sheet?.name).toBe("candidatos");
    expect(P.state.slotPick).toBe(6);
    expect(host.navigate.mock.calls.at(-1)?.[0]).toBe("/pizarra/siete?hoja=candidatos&hueco=6&season=t1");
    // a bench tap with the slot picked places him
    P.act.tapBench("kevin");
    expect(ids(lastCommit(host))[6]).toBe("kevin");
  });

  it("drops: on a slot, on another player, on the bench", () => {
    const { P, host } = makeTestStore();
    P.act.dropOn({ pid: "kevin", from: "banquillo", slot: null }, "slot:6");
    expect(ids(lastCommit(host))[6]).toBe("kevin");
    P.act.dropOn({ pid: "fer", from: "campo", slot: 1 }, "player:erik");
    expect(ids(lastCommit(host)).slice(1, 3)).toEqual(["erik", "fer"]);
    P.act.dropOn({ pid: "erik", from: "campo", slot: 1 }, "bench");
    expect(ids(lastCommit(host))[1]).toBeNull();
  });
});

describe("selectors", () => {
  it("the headline says the state", () => {
    expect(makeTestStore().P.sel.headline().t).toBe("Te falta un DC");
    const full = makeTestStore({ world: fakeWorld({ boards: [fakeBoard({ ids: ["evans", "fer", "erik", "jordi", "adrian", "eguzquiza", "alcides"] })] }) });
    expect(full.P.sel.headline().t).toBe("Listo para publicar");
    const erik = makeTestStore({ me: ME_PLAYER, world: fakeWorld({ boards: [fakeBoard({ isOfficial: true })] }) });
    expect(erik.P.sel.headline().t).toBe("Tu sitio: DFC");
  });

  it("candidates rank who fits the slot first and leave the placed and the absent last", () => {
    const { P } = makeTestStore();
    const c = P.sel.candidates(6);
    expect(c[0].pid).toBe("alcides");
    expect(c.at(-1)?.on).toBe(true);
    expect(c.find((x) => x.pid === "josito")?.can).toBe(false);
  });

  it("the save line follows the session", () => {
    const h = makeTestStore();
    expect(h.P.sel.saveLine().t).toMatch(/^Guardado \d\d:\d\d$/);
    h.attach({ saveStatus: "offline" });
    expect(h.P.sel.saveLine().t).toBe("Sin conexión · guardado en este móvil");
    h.attach({ estado: "cargando" });
    expect(h.P.sel.saveLine().t).toBe("Cargando…");
  });

  it("a rival disc never lands on one of our shirts", () => {
    const q = rivalSpotNear(25, 46, [{ x: 25, y: 46, pid: "adrian" }]);
    expect(q).not.toEqual({ x: 25, y: 46 });
    expect(Math.abs(q.x - 25) >= 11 || Math.abs(q.y - 46) * 1.4 >= 13).toBe(true);
  });
});

describe("routes and the stage", () => {
  it("a route change resets the stage to the place's defaults", () => {
    const { P } = makeTestStore();
    P.setRoute({ place: "partido", sub: "", q: {} });
    expect(P.sel.stage()).toMatchObject({ source: "ahora", camera: "grada" });
    P.act.setStage({ caption: "Hola" });
    expect(P.sel.view().caption).toBe("Hola");
    P.setRoute({ place: "tableros", sub: "", q: {} });
    expect(P.sel.view().none).toBe(true);
  });

  it("ahora: the marks go on the slots once (not again as extra marks)", () => {
    const { P } = makeTestStore();
    const v = P.sel.view({ source: "ahora", marks: { erik: [{ k: "amarilla", t: "Amarilla 17′" }] } });
    expect(v.slots.find((s) => s.pid === "erik")?.marks).toHaveLength(1);
    expect(v.marksExtra).toBeNull();
  });

  it("the address opens a sheet (?hoja=ficha&jugador=erik) and the layer (?capa=quimica)", () => {
    const { P } = makeTestStore();
    P.setRoute({ place: "siete", sub: "", q: { hoja: "ficha", jugador: "erik", capa: "quimica" } });
    expect(P.state.sheet?.name).toBe("ficha");
    expect(P.state.sheet?.args.pid).toBe("erik");
    expect(P.state.layer).toBe("quimica");
    expect(P.sel.view().links.length).toBeGreaterThan(0);
  });

  it("nav keeps the board and the season", () => {
    const { P, host } = makeTestStore();
    P.act.go("/pizarra/plan");
    expect(host.navigate).toHaveBeenLastCalledWith("/pizarra/plan?tablero=b1&season=t1", undefined);
  });

  it("slices are undoable", () => {
    const { P } = makeTestStore();
    const s = P.slice<{ fase: string }>("plan-test", { fase: "con" });
    s.set({ fase: "sin" }, { label: "Fase: sin balón" });
    expect(s.get().fase).toBe("sin");
    P.act.undo();
    expect(s.get().fase).toBe("con");
  });

  it("subscribers hear every change once per tick", async () => {
    const { P } = makeTestStore();
    const fn = vi.fn();
    P.subscribe(fn);
    P.act.setLayer("media");
    P.act.setLayer("nota");
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("the season", () => {
  const seasons = [{ id: "t0" }, { id: "t1" }];
  it("keeps the asked season, else the current one («all» shows no boards)", () => {
    expect(pizarraSeason("t0", seasons, undefined, [])).toBe("t0");
    expect(pizarraSeason("all", seasons, undefined, [])).toBe("t1");
    expect(pizarraSeason(undefined, seasons, undefined, [])).toBe("t1");
    expect(pizarraSeason("gone", seasons, undefined, [])).toBe("t1");
  });
  it("the testkit's address follows navigate (route.sub too)", () => {
    const { P } = makeTestStore();
    P.act.go("/pizarra/plan/rival");
    expect(P.state.route).toMatchObject({ place: "plan", sub: "rival" });
  });
  it("me of a captain edits any board", () => {
    const { P } = makeTestStore({ me: ME_CAPTAIN, world: fakeWorld({ boards: [fakeBoard({ isOfficial: true, ownerUid: "other" })] }) });
    expect(P.sel.canEdit()).toBe(true);
  });
});
