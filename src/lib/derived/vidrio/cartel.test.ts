import { describe, expect, it } from "vitest";
import { readyClock } from "../../../../functions/src/matchClock";
import type { ClubMatch } from "../../clubData";
import { cartelOf } from "./cartel";
import { longSeasonFixture } from "./fixtures";

const f = longSeasonFixture();
const byId = (id: string) => f.matches.find((m) => m.id === id)!;
const ctx = (jornada: number | null, extra: { mvp?: string; now?: number } = {}) => ({ jornada, seasonName: "Temporada 1", nameOf: f.nameOf, now: extra.now ?? f.now, mvp: extra.mvp });

describe("cartelOf", () => {
  it("tonight, live: the time (a shared image never shows a running score), no signature yet", () => {
    const c = cartelOf(byId("j17"), ctx(17));
    expect(c).toMatchObject({
      jornadaLabel: "J17",
      rival: "Orduña fc",
      side: "En casa",
      venue: "CDM Palomeras",
      dateLine: "Domingo, 17 ene",
      time: "19:00",
      state: "directo",
      big: "19:00",
      played: false,
      letter: null,
      resultLine: "",
      scorers: "Alcides, Adrián T.C.",
      mvp: null,
      fileName: "piti-j17-orduna-fc.png",
    });
    expect(c.signature).toBeNull();
    expect(c.light).toMatchObject({ light: "noche", floodlights: true });
    expect(c.aria).toBe("Cartel de la J17: Manchester Piti contra Orduña fc, domingo, 17 ene a las 19:00. En directo.");
  });

  it("a played one: result, scorers, MVP", () => {
    const c = cartelOf(byId("j8"), ctx(8, { mvp: "Alcides" }));
    expect(c).toMatchObject({ big: "5–1", played: true, letter: "G", resultLine: "Ganamos 5–1", mvp: "Alcides", side: "Fuera" });
    expect(c.scorers).toBe("Adrián T.C., Erik, Huberoski, Alcides, Kevin");
    expect(c.signature).toMatchObject({ closed: true });
    expect(c.aria).toMatch(/\. Resultado 5–1\.$/);
  });

  it("a guest's goal on the poster is the guest's", () => {
    expect(cartelOf(byId("j6"), ctx(6)).scorers).toBe("Rafa (invitado)");
  });

  it("ahead, postponed, cancelled, «pendiente» and undated", () => {
    expect(cartelOf(byId("j18"), ctx(18))).toMatchObject({ big: "12:00", state: "proximo", signature: null, dateLine: "Domingo, 24 ene", side: "Fuera", venue: "Campo de Red Demons" });
    expect(cartelOf(byId("j20"), ctx(20))).toMatchObject({ big: "Aplazado", state: "aplazado", mvp: null });
    expect(cartelOf({ ...byId("j18"), status: "cancelled" }, ctx(null))).toMatchObject({ big: "Suspendido", jornadaLabel: "", fileName: "piti-red-demons.png" });
    const pending = cartelOf({ ...byId("j17"), clock: readyClock() }, ctx(17, { now: f.kickoff + 4 * 3_600_000 }));
    expect(pending).toMatchObject({ big: "Pendiente del acta", score: null, scorers: "", signature: null });
    expect(pending.aria).toMatch(/Pendiente del acta\.$/);
    const undated = cartelOf({ ...byId("j18"), date: undefined } as ClubMatch, ctx(null));
    expect(undated).toMatchObject({ big: "Por confirmar", dateLine: "Fecha por confirmar", time: "", light: null });
    expect(undated.aria).toBe("Cartel de la jornada: Manchester Piti contra Red Demons, fecha por confirmar.");
  });
});
