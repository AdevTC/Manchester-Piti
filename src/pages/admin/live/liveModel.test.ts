import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../../../../functions/src/matchEngine";
import { liveLog, liveSides } from "./liveModel";

const NAMES: Record<string, [string, string]> = { evans: ["1", "EVANS"], erik: ["9", "ERIK"], adrian: ["10", "ADRIÁN T.C."], tello: ["20", "TELLO"], kevin: ["11", "KEVIN"], almachi: ["21", "ALMACHI"] };

describe("live · sides and the log", () => {
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

describe("live · football's minute in the log", () => {
  it("a live-stamped event shows football's minute (0:07 → 1′); one typed in the acta, as typed", () => {
    const rows = liveLog([{ id: "a", type: "opponent_goal", minute: 0, elapsedSeconds: 7 } as MatchEvent, { id: "b", type: "opponent_goal", minute: 19 } as MatchEvent], "MAD SKY", (id) => id);
    expect(rows.map((r) => [r.id, r.minute])).toEqual([["b", "19"], ["a", "1"]]);
  });
});

describe("live · invitados", () => {
  it("liveSides puts the guests after the members, on the pitch and on the bench", () => {
    expect(liveSides(["guest:g1", "evans", "erik"], ["guest:g2", "kevin"], [])).toEqual({ field: ["evans", "erik", "guest:g1"], bench: ["kevin", "guest:g2"] });
  });

  it("the log names the guest", () => {
    const rows = liveLog([{ id: "a", type: "goal", minute: 5, playerId: "guest:g1", assistPlayerId: "erik" }], "MAD SKY", (id) => (id === "guest:g1" ? "Rafa (invitado)" : id.toUpperCase()));
    expect(rows[0].text).toBe("Gol de Rafa (invitado)");
    expect(rows[0].detail).toBe("pase de ERIK");
  });
});
