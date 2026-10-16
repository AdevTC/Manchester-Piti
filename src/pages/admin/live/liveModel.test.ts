import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { liveLog, liveSides, pickerView, type PickerContext, type Step } from "./liveModel";

const NAMES: Record<string, [string, string]> = { evans: ["1", "EVANS"], erik: ["9", "ERIK"], adrian: ["10", "ADRIÁN T.C."], tello: ["20", "TELLO"], kevin: ["11", "KEVIN"], almachi: ["21", "ALMACHI"] };
const ctx: PickerContext = { minute: 31, rival: "MAD SKY", field: ["evans", "tello", "erik", "adrian"], bench: ["kevin", "almachi"], player: (id) => ({ num: NAMES[id][0], name: NAMES[id][1] }) };
const isEvent = (s: Step): s is Extract<Step, { event: unknown }> => "event" in s;

describe("En juego · the picker", () => {
  it.each(["oca", "cor"] as const)("%s asks for the team, then an optional player of ours", (k) => {
    const type = k === "oca" ? "chance" : "corner";
    const side = pickerView({ k, st: 1 }, ctx);
    expect(side.extras[1].next).toMatchObject({ event: { type: `opponent_${type}`, minute: 31 } });
    const ours = pickerView({ k, st: 2 }, ctx);
    expect(ours.options.map((o) => o.id)).toEqual(ctx.field);
    expect(ours.options[0].next).toMatchObject({ event: { type, minute: 31, playerId: "evans" } });
    expect(ours.extras[0].next).toMatchObject({ event: { type, minute: 31 } });
    expect(ours.bench).toBeNull();
  });
  it("GOL: ¿Quién marcó? (on the pitch first, then the banquillo) → ¿Quién le dio el pase?", () => {
    const v = pickerView({ k: "gol", st: 1 }, ctx);
    expect(v.step).toBe("GOL · 31′ · paso 1 de 2");
    expect(v.question).toBe("¿Quién marcó?");
    expect(v.options.map((o) => o.name)).toEqual(["EVANS", "TELLO", "ERIK", "ADRIÁN T.C."]);
    expect(v.bench).toBeNull(); // a scorer must be on the pitch; register the substitution first
    expect(v.extras.map((x) => x.label)).toEqual(["Autogol de MAD SKY", "Lo completo luego"]);
    const erik = v.options[2].next;
    expect(erik).toEqual({ state: { k: "gol", st: 2, scorer: "erik" } });
    const v2 = pickerView({ k: "gol", st: 2, scorer: "erik" }, ctx);
    expect(v2.step).toBe("GOL de ERIK · paso 2 de 2");
    expect(v2.options.map((o) => o.name)).not.toContain("ERIK");
    expect(v2.options[2].next).toEqual({ event: { type: "goal", assistReviewed: true, minute: 31, playerId: "erik", assistPlayerId: "adrian" }, flash: "ERIK · 31′ · pase de ADRIÁN T.C." });
    expect(v2.extras[0]).toMatchObject({ label: "Sin asistencia", next: { event: { type: "goal", assistReviewed: true, minute: 31, playerId: "erik" }, flash: "ERIK · 31′" } });
  });
  it("autogol and «Lo completo luego» write at once", () => {
    const [og, later] = pickerView({ k: "gol", st: 1 }, ctx).extras;
    expect(og.next).toEqual({ event: { type: "opponent_own_goal", minute: 31 }, flash: "Autogol de MAD SKY · 31′" });
    expect(isEvent(later.next) && later.next.event).toEqual({ type: "goal", minute: 31 });
  });
  it("Tarjeta: which card → whom; Cambio: who leaves → who comes in", () => {
    const t = pickerView({ k: "tar", st: 1 }, ctx);
    expect(t.options).toEqual([]);
    expect(t.extras.map((x) => x.label)).toEqual(["Amarilla", "Segunda amarilla", "Roja directa"]);
    const t2 = pickerView({ k: "tar", st: 2, card: "yellow_card" }, ctx);
    expect(t2.options[1].next).toEqual({ event: { type: "yellow_card", minute: 31, playerId: "tello" }, caption: "Amarilla a TELLO · 31′" });
    const c = pickerView({ k: "cam", st: 1 }, ctx);
    expect(c.options[1].next).toEqual({ state: { k: "cam", st: 2, out: "tello" } });
    const c2 = pickerView({ k: "cam", st: 2, out: "tello" }, ctx);
    expect(c2.label).toBe("Banquillo");
    expect(c2.options[0].next).toEqual({ event: { type: "substitution", minute: 31, playerId: "tello", inPlayerId: "kevin" }, caption: "Cambio: entra KEVIN, sale TELLO" });
  });
});

// Characterisation: the exact events the wizard wrote before it read the shared catalogue
// (src/lib/liveActions.ts). toStrictEqual, so an `undefined` key would show up as a difference.
describe("En juego · the payload of every pad", () => {
  const ev = (s: Step) => (isEvent(s) ? s.event : null);
  it("ocasión / córner", () => {
    for (const [k, type] of [["oca", "chance"], ["cor", "corner"]] as const) {
      expect(ev(pickerView({ k, st: 1 }, ctx).extras[1].next)).toStrictEqual({ type: `opponent_${type}`, minute: 31 });
      expect(ev(pickerView({ k, st: 2 }, ctx).options[2].next)).toStrictEqual({ type, minute: 31, playerId: "erik" });
      expect(ev(pickerView({ k, st: 2 }, ctx).extras[0].next)).toStrictEqual({ type, minute: 31 });
    }
  });
  it("gol, autogol, lo completo luego", () => {
    const [og, later] = pickerView({ k: "gol", st: 1 }, ctx).extras;
    expect(ev(og.next)).toStrictEqual({ type: "opponent_own_goal", minute: 31 });
    expect(ev(later.next)).toStrictEqual({ type: "goal", minute: 31 });
    const v2 = pickerView({ k: "gol", st: 2, scorer: "erik" }, ctx);
    expect(ev(v2.options[2].next)).toStrictEqual({ type: "goal", minute: 31, assistReviewed: true, playerId: "erik", assistPlayerId: "adrian" });
    expect(ev(v2.extras[0].next)).toStrictEqual({ type: "goal", minute: 31, assistReviewed: true, playerId: "erik" });
  });
  it("tarjetas (on the pitch and on the bench) and cambio", () => {
    for (const card of ["yellow_card", "double_yellow", "red_card"] as const) {
      const v = pickerView({ k: "tar", st: 2, card }, ctx);
      expect(ev(v.options[0].next)).toStrictEqual({ type: card, minute: 31, playerId: "evans" });
      expect(ev((v.bench ?? [])[0].next)).toStrictEqual({ type: card, minute: 31, playerId: "kevin" });
    }
    expect(ev(pickerView({ k: "cam", st: 2, out: "tello" }, ctx).options[1].next)).toStrictEqual({ type: "substitution", minute: 31, playerId: "tello", inPlayerId: "almachi" });
  });
});

describe("En juego · what the banda had and the wizard lacked", () => {
  it("Penalti o palo: which play → whom (on the pitch)", () => {
    const v = pickerView({ k: "mas", st: 1 }, ctx);
    expect(v.step).toBe("PENALTI O PALO · 31′ · paso 1 de 2");
    expect(v.question).toBe("¿Qué ha pasado?");
    expect(v.extras.map((x) => [x.label, x.next])).toEqual([
      ["Penalti parado", { state: { k: "mas", st: 2, type: "penalty_saved" } }],
      ["Al palo", { state: { k: "mas", st: 2, type: "woodwork" } }],
      ["Penalti fallado", { state: { k: "mas", st: 2, type: "penalty_missed" } }],
    ]);
    const saved = pickerView({ k: "mas", st: 2, type: "penalty_saved" }, ctx);
    expect([saved.step, saved.question, saved.label, saved.bench]).toEqual(["Penalti parado · paso 2 de 2", "¿Quién lo paró?", "En el campo", null]);
    for (const type of ["woodwork", "penalty_missed"] as const) expect(pickerView({ k: "mas", st: 2, type }, ctx).question).toBe("¿Quién lo tiró?");
    expect(saved.options.map((o) => o.id)).toEqual(ctx.field);
    expect(saved.options[0]).toMatchObject({ aria: "Penalti parado por EVANS", next: { event: { type: "penalty_saved", minute: 31, playerId: "evans" }, caption: "Penalti parado por EVANS · 31′" } });
    expect(pickerView({ k: "mas", st: 2, type: "woodwork" }, ctx).options[2].aria).toBe("Al palo: ERIK");
    for (const type of ["woodwork", "penalty_missed"] as const) {
      const next = pickerView({ k: "mas", st: 2, type }, ctx).options[2].next;
      expect(isEvent(next) && next.event).toStrictEqual({ type, minute: 31, playerId: "erik" });
    }
  });
});

describe("En juego · sides and the log", () => {
  const events: MatchEvent[] = [
    { id: "e1", type: "goal", minute: 12, playerId: "erik", assistPlayerId: "adrian" },
    { id: "e2", type: "opponent_goal", minute: 24 },
    { id: "e3", type: "yellow_card", minute: 27, playerId: "tello" },
    { id: "e4", type: "substitution", minute: 30, playerId: "tello", inPlayerId: "kevin" },
    { id: "e5", type: "red_card", minute: 33, playerId: "evans" },
    { id: "e6", type: "goal", minute: 35 },
  ];
  it("who is on the pitch and who can come in (sent off never)", () => {
    expect(liveSides(["evans", "tello", "erik", "adrian"], ["kevin", "almachi"], events)).toEqual({ field: ["kevin", "erik", "adrian"], bench: ["tello", "almachi"] });
  });
  it("«Lo que va pasando», newest first", () => {
    const rows = liveLog(events, "MAD SKY", (id) => NAMES[id][1]);
    expect(rows.map((r) => [r.minute, r.text, r.detail, r.cls])).toEqual([
      ["35", "Gol del Piti", "falta el goleador", ""],
      ["33", "Roja directa a EVANS", "", "rj"],
      ["30", "Cambio: entra KEVIN", "sale TELLO", ""],
      ["27", "Amarilla a TELLO", "", "y"],
      ["24", "Gol de MAD SKY", "", "rv"],
      ["12", "Gol de ERIK", "pase de ADRIÁN T.C.", ""],
    ]);
  });
});

describe("En juego · football's minute on the LED and the log", () => {
  it("the flash and the captions read the shown minute; the event keeps the stamped one", () => {
    const v = pickerView({ k: "gol", st: 1 }, { ...ctx, minute: 30, shown: 31 });
    const [og] = v.extras;
    expect(og.next).toEqual({ event: { type: "opponent_own_goal", minute: 30 }, flash: "Autogol de MAD SKY · 31′" });
  });
  it("a live-stamped event shows football's minute (0:07 → 1′); one typed in the acta, as typed", () => {
    const rows = liveLog([{ id: "a", type: "opponent_goal", minute: 0, elapsedSeconds: 7 } as MatchEvent, { id: "b", type: "opponent_goal", minute: 19 } as MatchEvent], "MAD SKY", (id) => id);
    expect(rows.map((r) => [r.id, r.minute])).toEqual([["b", "19"], ["a", "1"]]);
  });
});

describe("En juego · invitados", () => {
  const guestCtx: PickerContext = {
    ...ctx,
    field: liveSides(["guest:g1", "evans", "erik"], ["guest:g2", "kevin"], []).field,
    bench: liveSides(["guest:g1", "evans", "erik"], ["guest:g2", "kevin"], []).bench,
    player: (id) => (id.startsWith("guest:") ? { num: "INV", name: id === "guest:g1" ? "Rafa (invitado)" : "Invitado" } : { num: NAMES[id][0], name: NAMES[id][1] }),
  };

  it("liveSides puts the guests after the members, on the pitch and on the bench", () => {
    expect(liveSides(["guest:g1", "evans", "erik"], ["guest:g2", "kevin"], [])).toEqual({ field: ["evans", "erik", "guest:g1"], bench: ["kevin", "guest:g2"] });
  });

  it("the GOL picker offers the guest after the members, and his goal carries his guest: reference", () => {
    const view = pickerView({ k: "gol", st: 1 }, guestCtx);
    expect(view.options.map((o) => `${o.num} ${o.name}`)).toEqual(["1 EVANS", "9 ERIK", "INV Rafa (invitado)"]);
    const rafa = view.options.find((o) => o.id === "guest:g1");
    expect(rafa?.aria).toBe("Marcó Rafa (invitado)");
    const assist = pickerView({ k: "gol", st: 2, scorer: "guest:g1" }, guestCtx);
    expect(assist.step).toBe("GOL de Rafa (invitado) · paso 2 de 2");
    const step = assist.options.find((o) => o.id === "evans")?.next;
    expect(step && isEvent(step) ? step.event : null).toStrictEqual({ type: "goal", minute: 31, playerId: "guest:g1", assistPlayerId: "evans", assistReviewed: true });
  });

  it("the cards reach the guests on the bench too, after the members", () => {
    const view = pickerView({ k: "tar", st: 2, card: "yellow_card" }, guestCtx);
    expect(view.bench?.map((o) => o.id)).toEqual(["kevin", "guest:g2"]);
  });

  it("the log names the guest", () => {
    const rows = liveLog([{ id: "a", type: "goal", minute: 5, playerId: "guest:g1", assistPlayerId: "erik" }], "MAD SKY", (id) => (id === "guest:g1" ? "Rafa (invitado)" : id.toUpperCase()));
    expect(rows[0].text).toBe("Gol de Rafa (invitado)");
    expect(rows[0].detail).toBe("pase de ERIK");
  });
});
