import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYSIS_PROFILE } from "../../../../../functions/src/narrated/types";
import { defaultSheet, removeEvent, restoreEvent, type MatchSheet } from "../../acta/sheetModel";
import { auditWhat, leftWords, mvpView, publishWords, secondsOf, staleDraft, whatChanged } from "./actaModel";
import { sessionPath, SheetStore } from "./sheetStore";

const H = 3_600_000;
const sheet = (over: Partial<MatchSheet> = {}): MatchSheet => defaultSheet("t1", { rival: "FUSION 7", date: Date.UTC(2026, 10, 1, 9), status: "finished", starters: ["a", "b"], bench: ["c"], ...over });
const name = (id: string) => id.toUpperCase();

describe("B-ACTA-01 · the draft the published acta overtook", () => {
  it("is stale only when a draft over a published acta lags behind its revision", () => {
    expect(staleDraft({ draft: true, published: true, revision: 3 }, { revision: 4 })).toEqual({ revision: 4 });
    expect(staleDraft({ draft: true, published: true, revision: 4 }, { revision: 4 })).toBeNull();
    expect(staleDraft({ draft: true, published: false, revision: 2 }, undefined)).toBeNull();
    expect(staleDraft({ draft: false, published: true, revision: 1 }, { revision: 4 })).toBeNull();
  });
  it("says what changed in words", () => {
    const from = sheet();
    const to = sheet({ starters: ["a", "b", "c"], bench: [], photoUrl: "https://x/f.jpg", events: [{ id: "g", type: "goal", minute: 3, playerId: "a" }] });
    expect(whatChanged(from, to, name)).toEqual(["Puso a C en el siete", "Apuntó 1 jugada", "Cambió la foto del partido"]);
  });
});

describe("B-ACTA-02 · «Deshacer» of a removal", () => {
  it("brings the play back where it was and its narrated detail as it was", () => {
    const before = sheet({
      events: [
        { id: "g1", type: "goal", minute: 5, playerId: "a" },
        { id: "g2", type: "goal", minute: 9, playerId: "b" },
      ],
      analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, coverage: [], observations: [{ id: "o1", canonicalEventId: "g1", kind: "goal", team: "us", actorId: "a", order: 1, time: { from: 300, to: 300, precision: "exact" }, facts: { note: "Cruzado" } }] },
    });
    const removed = removeEvent(before, "g1");
    expect(removed.analysis?.observations[0].validity).toBe("void");
    const back = restoreEvent(removed, before, "g1");
    expect(back.events.map((e) => e.id)).toEqual(["g1", "g2"]);
    expect(back.analysis?.observations[0]).toEqual(before.analysis?.observations[0]);
  });
});

describe("B-PUB-01 · the MVP says its real close", () => {
  const now = Date.UTC(2026, 10, 3, 17);
  it("open: the close and what is left, never «48 h»", () => {
    const v = mvpView({ voteClosesAt: now + 5 * H, publishedAt: now - 43 * H, total: 6, eligible: 14, winners: [], now });
    expect(v.open).toBe(true);
    expect(v.part).toBe("6 de 14 han votado");
    expect(v.pct).toBe(43);
    expect(v.close).toMatch(/^Cierra el martes, \d\d:\d\d · faltan 5 h$/);
    expect(v.canReopen).toBe(true);
  });
  it("closed: the winner; no reopening after 7 days", () => {
    const v = mvpView({ voteClosesAt: now - 10 * 24 * H, publishedAt: now - 12 * 24 * H, total: 9, eligible: 14, winners: ["ERIK"], now });
    expect(v.winner).toBe("Ganó ERIK");
    expect(v.canReopen).toBe(false);
  });
  it("«1 día y 8 h»", () => expect(leftWords(now + 32 * H, now)).toBe("1 día y 8 h"));
});

describe("publishing in words (A-PAR-10)", () => {
  it("the first time: the MVP, the phones, the notas and the porra; a correction: no new final", () => {
    const first = publishWords({ j: "J2", sheet: sheet({ events: [{ id: "g", type: "goal", minute: 3, playerId: "a" }] }), firstTime: true, voteClosesAt: null, now: Date.UTC(2026, 10, 1, 12), played: 9, devices: 23 });
    expect(first.title).toBe("¿Publicar el acta de la J2?");
    expect(first.lines.join(" ")).toContain("Avisamos a 23 móviles: «Final: Manchester Piti 1–0 FUSION 7»");
    expect(first.lines.join(" ")).toContain("Se congelan las notas de los 9 que jugaron");
    const fix = publishWords({ j: "J2", sheet: sheet(), firstTime: false, voteClosesAt: Date.UTC(2026, 10, 1, 9), now: Date.UTC(2026, 10, 2, 12), played: 9, devices: null });
    expect(fix.title).toBe("¿Corregir el acta de la J2?");
    expect(fix.lines.join(" ")).toContain("No sale ningún aviso nuevo del final");
  });
});

describe("the history and the video marks", () => {
  it("names each matchAudit entry", () => {
    expect(auditWhat({ id: "1", at: 1, by: "u", fields: { draft: "discarded" } }).what).toBe("Descartó el borrador");
    expect(auditWhat({ id: "1", at: 1, by: "u", revision: 3, fields: { convocatoria: "notify" } }).what).toBe("Mandó la convocatoria · revisión 3");
    expect(auditWhat({ id: "1", at: 1, by: "u", fields: { mvp: "close" } }).what).toBe("Cerró la votación del MVP");
    expect(auditWhat({ id: "1", at: 1, by: "u", revision: 5, fields: {} }).what).toBe("Guardó el acta · revisión 5");
  });
  it("reads a video time", () => {
    expect(secondsOf("12:34")).toBe(754);
    expect(secondsOf("1:02:03")).toBe(3723);
    expect(secondsOf("12:75")).toBeNull();
    expect(secondsOf("abc")).toBeNull();
  });
});

describe("the acta's buffer (sheetStore)", () => {
  it("one session for the acta's stations, Datos and Convocatoria; the rest of the match asks", () => {
    for (const s of ["datos", "convocatoria", "acta", "acta/narracion", "acta/historial", "publicar"]) expect(sessionPath("m7", `/admin/partidos/m7/${s}`)).toBe(true);
    for (const s of ["despues", "en-juego"]) expect(sessionPath("m7", `/admin/partidos/m7/${s}`)).toBe(false);
    expect(sessionPath("m7", "/admin/partidos/m8/acta")).toBe(false);
  });
  it("every change is a new snapshot, mirrored while dirty; a clean store follows the server", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as unknown as Storage;
    const server = sheet();
    const store = new SheetStore("m7", server, storage);
    const first = store.get();
    store.set((v) => ({ ...v, report: "Hola" }));
    expect(store.get()).not.toBe(first);
    expect(store.get().value.report).toBe("Hola");
    store.reset();
    expect(store.get().value).toBe(server);
    store.adopt(sheet({ report: "del servidor" }), "nuevo");
    expect(store.get().value.report).toBe("del servidor");
  });
});
