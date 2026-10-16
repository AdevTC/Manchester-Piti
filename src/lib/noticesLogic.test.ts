import { describe, expect, it } from "vitest";
import { NOTICE_BUCKET_MS, NOTICE_TTL_MS, noticeAudience, noticeId, noticeRecord } from "./noticesLogic";
import { absenceNotice, convocatoriaMessage, kickoffNotice, type Notice } from "../../functions/src/pushLogic";
import { lateChangeNotice, reminderNotice } from "../../functions/src/remindersLogic";

const NOW = Date.UTC(2026, 9, 16, 10, 0);
const HOUR = 3_600_000;
const conv = convocatoriaMessage("m1", "first", { rival: "Rival FC", date: NOW + 48 * HOUR }, 5);
const goal: Notice = { topic: "goals", title: "¡Gol! 1–0", body: "Marca NICO", tag: "goal-m1", url: "/matches/m1", log: "goal-m1-e1" };

describe("Centro de avisos: qué se guarda y para quién", () => {
  it("los goles y el saque inicial (descanso, 2ª parte) no se guardan: ya los cuenta la isla", () => {
    expect(noticeAudience(goal)).toBeNull();
    expect(noticeAudience(kickoffNotice("m1", "Rival FC"))).toBeNull();
    expect(noticeRecord(goal, undefined, NOW)).toBeNull();
  });

  it("los avisos del club sin uid son del equipo", () => {
    expect(noticeAudience(conv)).toEqual({ audience: "team" });
    for (const topic of ["lineup", "final", "mvp", "dates"] as const) expect(noticeAudience({ topic, tag: "x-m1" })).toEqual({ audience: "team" });
  });

  it("lo personal y los recordatorios son de su socio; sin socio no se guardan", () => {
    expect(noticeAudience({ topic: "personal", tag: "claim-u1" }, "u1")).toEqual({ audience: "personal", uid: "u1" });
    expect(noticeAudience({ topic: "personal", tag: "claim-u1" })).toBeNull();
    expect(noticeAudience({ topic: "access", tag: "access" }, "u2")).toEqual({ audience: "personal", uid: "u2" });
    expect(noticeAudience({ topic: "access", tag: "access" })).toBeNull();
    expect(noticeAudience(reminderNotice("m1", "48", { rival: "Rival FC", date: NOW + 40 * HOUR }), "u3")).toEqual({ audience: "personal", uid: "u3" });
  });

  it("la puerta, las bajas de última hora y las ausencias son de los capitanes, aunque vayan a cada uno", () => {
    expect(noticeAudience({ topic: "door", tag: "door-u9" })).toEqual({ audience: "captains" });
    const late = lateChangeNotice("m1", "ERIK", "yes", "no", { rival: "Rival FC", date: NOW + 5 * HOUR }, NOW)!;
    expect(noticeAudience(late, "captain1")).toEqual({ audience: "captains" });
    const absence = absenceNotice({ id: "a1", from: "2026-10-20", to: "2026-10-27" }, "ERIK", [{ id: "m1" }]);
    expect(noticeAudience(absence, "captain1")).toEqual({ audience: "captains" });
  });
});

describe("Centro de avisos: el documento", () => {
  it("lleva sus campos, caduca a los 60 días y solo lo personal lleva uid", () => {
    const team = noticeRecord(conv, undefined, NOW)!;
    expect(team.doc).toEqual({ topic: "lineup", title: conv.title, body: conv.body, url: "/matches/m1", at: NOW, audience: "team", expireAt: NOW + NOTICE_TTL_MS });
    expect(NOTICE_TTL_MS).toBe(60 * 24 * HOUR);
    expect("uid" in team.doc).toBe(false);
    const mine = noticeRecord({ topic: "personal", title: "Tu ficha ya es tuya", body: "…", tag: "claim-u1", url: "/profile", log: "claim-u1-p1" }, "u1", NOW)!;
    expect(mine.doc.audience).toBe("personal");
    expect(mine.doc.uid).toBe("u1");
  });

  it("un reintento en la misma hora da el mismo id; un aviso distinto con la misma etiqueta, otro", () => {
    const a = noticeRecord(conv, undefined, NOW)!.id;
    expect(noticeRecord(conv, undefined, NOW + 20 * 60_000)!.id).toBe(a);
    expect(a.startsWith(`conv-m1-${Math.floor(NOW / NOTICE_BUCKET_MS)}-`)).toBe(true);
    const changes = convocatoriaMessage("m1", "changes", { rival: "Rival FC", date: NOW + 48 * HOUR }, 5);
    expect(noticeRecord(changes, undefined, NOW)!.id).not.toBe(a);
    // (the same words a day later: news again)
    expect(noticeRecord(conv, undefined, NOW + 24 * HOUR)!.id).not.toBe(a);
  });

  it("el aviso de los capitanes es uno para todos; lo personal, uno por socio", () => {
    const late = lateChangeNotice("m1", "ERIK", "yes", "no", { rival: "Rival FC", date: NOW + 5 * HOUR }, NOW)!;
    expect(noticeRecord(late, "c1", NOW)!.id).toBe(noticeRecord(late, "c2", NOW)!.id);
    const remind = reminderNotice("m1", "24", { rival: "Rival FC", date: NOW + 20 * HOUR });
    expect(noticeRecord(remind, "u1", NOW)!.id).not.toBe(noticeRecord(remind, "u2", NOW)!.id);
  });

  it("el id solo lleva caracteres seguros para una ruta de Firestore", () => {
    const id = noticeId({ tag: "a/b c", title: "t", body: "b", url: "/" }, "team", undefined, NOW);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
