import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { liveLog, liveSides, pickerView, type PickerContext, type Step } from "./liveModel";

const NAMES: Record<string, [string, string]> = { evans: ["1", "EVANS"], erik: ["9", "ERIK"], adrian: ["10", "ADRIÁN T.C."], tello: ["20", "TELLO"], kevin: ["11", "KEVIN"], almachi: ["21", "ALMACHI"] };
const ctx: PickerContext = { minute: 31, rival: "MAD SKY", field: ["evans", "tello", "erik", "adrian"], bench: ["kevin", "almachi"], player: (id) => ({ num: NAMES[id][0], name: NAMES[id][1] }) };
const isEvent = (s: Step): s is Extract<Step, { event: unknown }> => "event" in s;

describe("En juego · the picker", () => {
  it("GOL: ¿Quién marcó? (on the pitch first, then the banquillo) → ¿Quién le dio el pase?", () => {
    const v = pickerView({ k: "gol", st: 1 }, ctx);
    expect(v.step).toBe("GOL · 31′ · paso 1 de 2");
    expect(v.question).toBe("¿Quién marcó?");
    expect(v.options.map((o) => o.name)).toEqual(["EVANS", "TELLO", "ERIK", "ADRIÁN T.C."]);
    expect(v.bench?.map((o) => o.num)).toEqual(["11", "21"]);
    expect(v.extras.map((x) => x.label)).toEqual(["Autogol de MAD SKY", "Lo completo luego"]);
    const erik = v.options[2].next;
    expect(erik).toEqual({ state: { k: "gol", st: 2, scorer: "erik" } });
    const v2 = pickerView({ k: "gol", st: 2, scorer: "erik" }, ctx);
    expect(v2.step).toBe("GOL de ERIK · paso 2 de 2");
    expect(v2.options.map((o) => o.name)).not.toContain("ERIK");
    expect(v2.options[2].next).toEqual({ event: { type: "goal", minute: 31, playerId: "erik", assistPlayerId: "adrian" }, flash: "ERIK · 31′ · pase de ADRIÁN T.C." });
    expect(v2.extras[0]).toMatchObject({ label: "Sin asistencia", next: { event: { type: "goal", minute: 31, playerId: "erik" }, flash: "ERIK · 31′" } });
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
    expect(c2.options[0].next).toEqual({ event: { type: "substitution", minute: 31, playerId: "tello", inPlayerId: "kevin" }, caption: "Entra KEVIN, sale TELLO" });
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
    expect(liveSides(["evans", "tello", "erik", "adrian"], ["kevin", "almachi"], events)).toEqual({ field: ["erik", "adrian", "kevin"], bench: ["tello", "almachi"] });
  });
  it("«Lo que va pasando», newest first", () => {
    const rows = liveLog(events, "MAD SKY", (id) => NAMES[id][1]);
    expect(rows.map((r) => [r.minute, r.text, r.detail, r.cls])).toEqual([
      ["35", "Gol del Piti", "falta el goleador", ""],
      ["33", "Roja directa a EVANS", "", "rj"],
      ["30", "Entra KEVIN", "sale TELLO", ""],
      ["27", "Amarilla a TELLO", "", "y"],
      ["24", "Gol de MAD SKY", "", "rv"],
      ["12", "Gol de ERIK", "pase de ADRIÁN T.C.", ""],
    ]);
  });
});
