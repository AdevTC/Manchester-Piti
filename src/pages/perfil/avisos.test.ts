import { describe, expect, it } from "vitest";
import type { ClubMatch } from "../../lib/clubData";
import { boldParts, deviceName, deviceView, testNotice, topicsLead, unblockSteps, upcomingRows } from "./avisos";
import { agoText, cycle, doorLead } from "./panels";

const UA = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36",
};

describe("este móvil", () => {
  it("nombra navegador y sistema", () => {
    expect(deviceName(UA.android)).toBe("Chrome en Android");
    expect(deviceName(UA.iphone)).toBe("Safari en iPhone");
    expect(deviceName(UA.macSafari)).toBe("Safari en Mac");
    expect(deviceName(UA.winEdge)).toBe("Edge en Windows");
    expect(deviceName(UA.firefox)).toBe("Firefox en Windows");
    expect(deviceName(UA.samsung)).toBe("Samsung Internet en Android");
  });

  it("los cuatro estados del diseño, siempre con palabras", () => {
    expect(deviceView("ready", UA.android, { permission: "granted", activeTopics: 3 })).toEqual({ kind: "listo", tone: "ok", chip: "Listo", title: "Este móvil recibe avisos", dev: "Chrome en Android · avisos permitidos" });
    expect(deviceView("ready", UA.android, { permission: "default", activeTopics: 0 })).toMatchObject({ title: "Este móvil puede recibir avisos", dev: "Chrome en Android · te pedirá permiso con el primer aviso" });
    expect(deviceView("ios-install", UA.iphone, { permission: "unknown", activeTopics: 0 })).toMatchObject({ kind: "iphone", tone: "warn", chip: "Falta un paso", title: "En iPhone, primero instala la web", dev: "iPhone · Safari, sin añadir a la pantalla de inicio" });
    expect(deviceView("ios-install", UA.ipad, { permission: "unknown", activeTopics: 0 }).title).toBe("En iPad, primero instala la web");
    expect(deviceView("denied", UA.android, { permission: "denied", activeTopics: 0 })).toMatchObject({ kind: "denegado", tone: "bad", chip: "Bloqueados" });
    expect(deviceView("unsupported", UA.firefox, { permission: "unknown", activeTopics: 0 })).toMatchObject({ kind: "no-soportado", chip: "No disponible", title: "Este navegador no admite avisos" });
  });

  it("cómo desbloquearlos, en tres pasos por navegador", () => {
    expect(unblockSteps(UA.android, false)[1]).toBe("Entra en *Permisos › Notificaciones* y elige *Permitir*");
    expect(unblockSteps(UA.winEdge, false)[0]).toContain("icono de ajustes");
    expect(unblockSteps(UA.firefox, false)[1]).toContain("quita el bloqueo");
    expect(unblockSteps(UA.macSafari, false)[0]).toContain("Safari › Ajustes");
    expect(unblockSteps(UA.samsung, false)[1]).toContain("Sitios y descargas");
    expect(unblockSteps(UA.iphone, true)[0]).toBe("Abre los *Ajustes* del iPhone");
    for (const ua of Object.values(UA)) expect(unblockSteps(ua, false)).toHaveLength(3);
    expect(boldParts("Elige *Permitir* ya")).toEqual([
      ["Elige ", false],
      ["Permitir", true],
      [" ya", false],
    ]);
  });

  it("cuántos activos, o por qué no", () => {
    expect(topicsLead(true, 5, 6)).toBe("5 de 6 activos en este móvil.");
    expect(topicsLead(false, 0, 7)).toBe("Se activan cuando este móvil esté listo.");
  });

  it("el aviso de prueba: gol con tu nombre, el siete y el final, por turnos", () => {
    const o = { name: "ADRI", rival: "MAD SKY", j: 8 };
    expect(testNotice(1, o)).toEqual({ title: "GOOOL · ADRI · 31′", body: "Manchester Piti 2–1 MAD SKY · J8" });
    expect(testNotice(2, o).title).toBe("Ya está el siete");
    expect(testNotice(3, o).body).toBe("Manchester Piti gana a MAD SKY. Vota al MVP");
    expect(testNotice(4, o).title).toBe("GOOOL · ADRI · 31′");
    expect(testNotice(2, { name: "ADRI", rival: null, j: null }).body).toBe("El capitán ha publicado el once para el rival");
  });
});

describe("calendario", () => {
  const at = (iso: string) => Date.parse(iso);
  const mk = (id: string, iso: string, extra: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId: "t1", rival: "R" + id, status: "scheduled", date: at(iso), home: true, ...extra });
  it("los tres próximos por jugar, con su jornada, en hora de Madrid", () => {
    const ms = [
      mk("a", "2026-09-20T10:00:00Z", { status: "finished", goalsFor: 2, goalsAgainst: 1 }),
      mk("d", "2026-11-22T11:00:00Z"),
      mk("b", "2026-11-08T11:00:00Z", { home: false, rival: "MAD SKY" }),
      mk("c", "2026-11-15T11:00:00Z"),
      mk("e", "2026-11-29T11:00:00Z"),
      mk("x", "2026-11-01T11:00:00Z", { status: "cancelled" }),
    ];
    const rows = upcomingRows(ms, at("2026-10-08T12:00:00Z"));
    expect(rows.map((r) => r.id)).toEqual(["b", "c", "d"]);
    expect(rows[0]).toEqual({ id: "b", j: "J3", rival: "MAD SKY", day: "8", mon: "nov", meta: "dom · 12:00 · fuera" });
    expect(rows[1].meta).toBe("dom · 12:00 · en casa");
  });
  it("sin partidos programados: nada", () => {
    expect(upcomingRows([], 0)).toEqual([]);
  });
});

describe("ajustes y capitanía", () => {
  it("◀ ▶ dan la vuelta", () => {
    const o = [
      ["a", "A"],
      ["b", "B"],
      ["c", "C"],
    ] as const;
    expect(cycle(o, "a", 1)).toBe("b");
    expect(cycle(o, "c", 1)).toBe("a");
    expect(cycle(o, "a", -1)).toBe("c");
  });
  it("la puerta en palabras", () => {
    expect(doorLead(0)).toMatch(/^Nadie llama ahora/);
    expect(doorLead(1)).toBe("Una petición espera tu sí o tu no.");
    expect(doorLead(2)).toBe("Dos peticiones esperan tu sí o tu no.");
    expect(doorLead(12)).toBe("12 peticiones esperan tu sí o tu no.");
    const now = 10 * 86_400_000;
    expect(agoText(now - 20_000, now)).toBe("ahora");
    expect(agoText(now - 5 * 60_000, now)).toBe("hace 5 min");
    expect(agoText(now - 2 * 3_600_000, now)).toBe("hace 2 h");
    expect(agoText(now - 30 * 3_600_000, now)).toBe("hace 1 día");
    expect(agoText(now - 3 * 86_400_000, now)).toBe("hace 3 días");
  });
});
