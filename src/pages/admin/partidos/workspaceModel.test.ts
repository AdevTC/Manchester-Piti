import { describe, expect, it } from "vitest";
import { reviewActa, type ActaReview } from "../data/adminLogic";
import { defaultSheet, goalRows, reviewSheet, type MatchSheet } from "../acta/sheetModel";
import { blockedWhy, cronicaHeadline, cuentaOf, effectiveSheet, footerOf, goalSub, goalWho, joinVenue, kickerOf, notSquareWhy, phaseOf, savedLine, splitVenue, tabMarks, tidyVenue } from "./workspaceModel";

const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h - 1, m); // Madrid = UTC+1
const NOW = at(2, 10);
const SEVEN = ["a", "b", "c", "d", "e", "f", "g"];
const names: Record<string, string> = { a: "EVANS", e: "HUBEROSKI", f: "ERIK", g: "ADRIÁN T.C." };
const nameOf = (id: string) => names[id] ?? id;
const sheet = (over: Partial<MatchSheet> = {}): MatchSheet => defaultSheet("t1", { rival: "FUSION 7", date: at(1, 10), status: "finished", starters: SEVEN, bench: [], ...over });
const review = (s: MatchSheet): ActaReview => reviewActa(reviewSheet(s), SEVEN, NOW, false);

describe("the match workspace", () => {
  it("phase: to play, being played (until the whistle), played, off", () => {
    const m = { id: "x", date: at(2, 9, 40), duration: 50, status: "scheduled" };
    expect(phaseOf({ ...m, date: at(8, 12) }, NOW, false)).toBe("antes");
    expect(phaseOf(m, NOW, false)).toBe("juego");
    expect(phaseOf(m, NOW, true)).toBe("jugado");
    expect(phaseOf({ ...m, status: "postponed" }, NOW, false)).toBe("off");
    expect(phaseOf({ ...m, date: at(1, 10) }, NOW, false)).toBe("jugado");
  });

  it("a played match still «Programado» is reviewed and saved as finished", () => {
    expect(effectiveSheet(sheet({ status: "scheduled" }), "jugado").status).toBe("finished");
    expect(effectiveSheet(sheet({ status: "scheduled" }), "juego").status).toBe("scheduled");
    expect(effectiveSheet(sheet({ status: "cancelled" }), "jugado").status).toBe("cancelled");
  });

  it("kicker, saved line", () => {
    expect(kickerOf("J7", sheet())).toBe("J7 · Liga · dom 1 nov · 10:00 · en casa");
    expect(kickerOf("J8", sheet({ home: false, date: NaN }))).toBe("J8 · Liga · sin fecha · fuera");
    expect(savedLine({ dirty: true, savedAt: null, published: false, now: NOW })).toBe("● Cambios sin guardar");
    expect(savedLine({ dirty: false, savedAt: at(2, 9, 4), published: false, now: NOW })).toBe("Guardado 09:04 · hora de Madrid");
    expect(savedLine({ dirty: false, savedAt: at(1, 13, 4), published: false, now: NOW })).toBe("Guardado dom 1 nov, 13:04 · hora de Madrid");
    expect(savedLine({ dirty: false, savedAt: null, published: false, now: NOW })).toBe("Sin guardar todavía");
  });

  it("the footer: the buttons of the moment and the concrete reason", () => {
    const open = sheet({ events: [{ id: "1", type: "goal", minute: 3, playerId: "f" }, { id: "2", type: "goal", minute: 9 }] });
    const r = review(open);
    expect(r.missingScorers).toBe(1);
    expect(footerOf({ phase: "jugado", inCalendar: true, draft: true, status: "finished", date: at(1, 10), review: r })).toEqual({ mode: "acta", tone: "warn", why: "No cuadra: falta el goleador de 1 gol" });
    expect(blockedWhy(r)).toBe("Para publicar falta el goleador de 1 gol");
    const ok = review(sheet({ events: [{ id: "1", type: "goal", minute: 3, playerId: "f" }] }));
    expect(footerOf({ phase: "jugado", inCalendar: false, draft: true, status: "finished", date: at(1, 10), review: ok })).toEqual({ mode: "acta", tone: "ok", why: "Cuadra · 1 gol, con goleador" });
    expect(footerOf({ phase: "jugado", inCalendar: true, draft: false, status: "finished", date: at(1, 10), review: ok })).toEqual({ mode: "publicada", tone: "ok", why: "Publicada · la web ya lo cuenta" });
    expect(footerOf({ phase: "juego", inCalendar: true, draft: false, status: "scheduled", date: at(1, 10), review: ok }).mode).toBe("juego");
    expect(footerOf({ phase: "antes", inCalendar: true, draft: false, status: "scheduled", date: at(8, 12), review: ok })).toEqual({ mode: "calendario", tone: "neu", why: "Por jugar · dom 8 nov 12:00" });
    expect(footerOf({ phase: "antes", inCalendar: false, draft: true, status: "scheduled", date: at(8, 12), review: ok })).toEqual({ mode: "borrador", tone: "warn", why: "Sin publicar · aún no sale en el calendario" });
    expect(footerOf({ phase: "off", inCalendar: true, draft: false, status: "cancelled", date: at(8, 12), review: ok })).toMatchObject({ mode: "calendario", why: "Cancelado · no cuenta para las estadísticas" });
    const noSeven = review(sheet({ starters: SEVEN.slice(0, 6), events: [] }));
    expect(notSquareWhy(noSeven)).toBe("No cuadra: faltan titulares (6 de 7)");
  });

  it("tab marks", () => {
    const ok = review(sheet());
    expect(tabMarks({ phase: "jugado", review: ok, starters: 7, published: true })).toEqual({ encuentro: "ok", convocatoria: "ok", acta: "ok", publicar: "ok" });
    expect(tabMarks({ phase: "antes", review: ok, starters: 6, published: false })).toEqual({ encuentro: "ok", convocatoria: "wn", acta: "", publicar: "" });
    expect(tabMarks({ phase: "off", review: ok, starters: 0, published: false }).convocatoria).toBe("");
  });

  it("goal rows, «La cuenta», the crónica's headline", () => {
    const rows = goalRows(sheet({ events: [{ id: "1", type: "goal", minute: 3, playerId: "g", assistPlayerId: "e" }, { id: "2", type: "goal_penalty", minute: 9, playerId: "f" }, { id: "3", type: "goal" }, { id: "4", type: "opponent_own_goal", minute: 20 }] }));
    expect(rows.map((g) => [goalWho(g, "FUSION 7", nameOf), goalSub(g, nameOf)])).toEqual([
      ["ADRIÁN T.C.", "Gol 1 · pase de HUBEROSKI"],
      ["ERIK", "Gol 2 de penalti · sin asistencia"],
      ["¿Quién marcó?", "Gol 3 · falta quién marcó"],
      ["Autogol de FUSION 7", "Gol 4 · cuenta para el Piti"],
    ]);
    expect(cuentaOf(rows)).toEqual([
      { title: "Marcador", value: "4 goles", dots: ["on", "on", "on", "on"] },
      { title: "Con goleador", value: "3 de 4", dots: ["on", "on", "on", "miss"] },
      { title: "Con pase (opcional)", value: "1 de 4", dots: ["on", "", "", ""] },
    ]);
    expect(cuentaOf([])[0].value).toBe("0 goles");
    expect(cronicaHeadline(3, 1, true, "FUSION 7")).toBe("El Piti gana 3–1 en casa ante FUSION 7");
    expect(cronicaHeadline(1, 1, false, "MAD SKY")).toBe("Empate 1–1 en el campo de MAD SKY");
    expect(cronicaHeadline(0, 2, false, "MAD SKY")).toBe("El Piti cae 0–2 en el campo de MAD SKY");
  });

  it("the field's name and address live in the one venue, typed as they come", () => {
    expect(splitVenue("Campo X · Calle Y 1")).toEqual({ name: "Campo X", address: "Calle Y 1" });
    expect(splitVenue("Campo X, Calle Y")).toEqual({ name: "Campo X, Calle Y", address: "" });
    expect(joinVenue("Campo ", "")).toBe("Campo ");
    expect(splitVenue(joinVenue("Campo ", ""))).toEqual({ name: "Campo ", address: "" });
    expect(splitVenue(joinVenue("", "Calle"))).toEqual({ name: "", address: "Calle" });
    expect(tidyVenue(" · Calle")).toBe("Calle");
    expect(tidyVenue("Campo  ")).toBe("Campo");
    expect(tidyVenue("Campo · Calle ")).toBe("Campo · Calle");
  });
});
