import { describe, expect, it } from "vitest";
import { notaPlayers, notasNotice, type MatchLike } from "../../functions/src/pushLogic";

// «Ya están las notas» (functions/src/push.ts notasOnMatch): when the acta's notas first appear.
const notas = { model: "piti-media-v2", rival: 1, players: { a: { nota: 7.2, minutes: 50, weight: 1, narrated: true }, b: { nota: 5.1, minutes: 30, weight: 1, narrated: true } } };
const played: MatchLike = { rival: "Orduña fc", status: "finished", seasonId: "s", notas };

describe("«Ya están las notas»", () => {
  it("goes when the notas first appear: «Mira la tuya» to who has one, «Míralas» to the rest, never the nota", () => {
    const everyone = notasNotice("m1", { rival: "Orduña fc", status: "scheduled" }, played, 1, false)!;
    expect(everyone).toMatchObject({ topic: "final", title: "Ya están las notas", body: "Contra Orduña fc: ya están las notas de la J1. Míralas en el partido.", tag: "notas-m1", url: "/partidos/m1/siete", log: "notas-m1" });
    const mine = notasNotice("m1", undefined, played, 1, true)!;
    expect(mine.body).toBe("Contra Orduña fc: ya están las notas de la J1. Mira la tuya en el partido.");
    expect(mine.body).not.toMatch(/\d,\d/);
  });
  it("without a jornada: «del partido»", () => {
    expect(notasNotice("m1", undefined, played, null, false)!.body).toBe("Contra Orduña fc: ya están las notas del partido. Míralas en el partido.");
  });
  it("a correction (notas already there, or written later by the backfill), an archived match, or no notas: nothing", () => {
    expect(notasNotice("m1", played, played, 1, false)).toBeNull();
    expect(notasNotice("m1", { ...played, notas: undefined }, played, 1, false)).toBeNull();
    expect(notasNotice("m1", undefined, { ...played, archived: true }, 1, false)).toBeNull();
    expect(notasNotice("m1", undefined, { ...played, notas: { ...notas, players: {} } }, 1, false)).toBeNull();
    expect(notasNotice("m1", undefined, { ...played, status: "scheduled" }, 1, false)).toBeNull();
  });
  it("who has a nota", () => {
    expect(notaPlayers(notas).sort()).toEqual(["a", "b"]);
    expect(notaPlayers(null)).toEqual([]);
    expect(notaPlayers({ players: "x" })).toEqual([]);
  });
});
