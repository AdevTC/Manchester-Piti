import { describe, expect, it } from "vitest";
import { ajHead, ajIndex, backLine, doorHint, doorToggle, endSentence, fitOf, knockRows, motionNote, roleLine, shownAj, themeHint, themeNote } from "./ajustesView";

const player = { kind: "jugador" as const, captain: false };
const captain = { kind: "jugador" as const, captain: true };
const socio = { kind: "socio" as const, captain: false };

describe("ajIndex", () => {
  it("a player's four sections with their live hints, no Capitanía", () => {
    const rows = ajIndex({ who: player, shirt: "jordi", nickname: "jordi", deviceLine: "Todo", theme: "system", doorN: 0 });
    expect(rows.map((r) => r.id)).toEqual(["nombre", "avisos", "apariencia", "cuenta"]);
    expect(rows.map((r) => r.hint)).toEqual(["JORDI · @jordi", "Todo", "Como tu móvil", "Google, acceso y baja"]);
    expect(rows.every((r) => r.badge === 0)).toBe(true);
  });
  it("a captain gets Capitanía with who knocks as hint and badge", () => {
    const rows = ajIndex({ who: captain, shirt: "JORDI", nickname: "jordi", deviceLine: "Solo goles · en pausa", theme: "dark", doorN: 2 });
    const cap = rows.find((r) => r.id === "capitania");
    expect(cap).toMatchObject({ t: "Capitanía", hint: "2 llaman a la puerta", badge: 2, icon: "flag" });
    expect(rows.find((r) => r.id === "apariencia")?.hint).toBe("Noche");
  });
  it("a socio's «nombre» is his apodo, with no shirt in the hint", () => {
    const rows = ajIndex({ who: socio, shirt: "", nickname: "marta", deviceLine: "Nada", theme: "light", doorN: 0 });
    expect(rows[0]).toMatchObject({ id: "nombre", t: "Tu apodo", hint: "@marta" });
  });
});

describe("heads and the section shown", () => {
  it("the index on a desktop shows the first section", () => {
    expect(shownAj(null, player)).toBe("nombre");
    expect(shownAj("cuenta", player)).toBe("cuenta");
  });
  it("titles and lines", () => {
    expect(ajHead("nombre", "jugador")).toEqual({ title: "Tu nombre", sub: "Lo que va en tu espalda y cómo te llaman en el vestuario. Se cambia aquí mismo." });
    expect(ajHead("nombre", "socio").title).toBe("Tu apodo");
    expect(ajHead("nombre", "socio").sub).not.toMatch(/espalda/);
    expect(ajHead("capitania", "jugador").title).toBe("Capitanía");
  });
});

describe("Tu nombre", () => {
  it("the fit, in words", () => {
    expect(fitOf(0, true).t).toBe("Sin nombre");
    expect(fitOf(5, true)).toEqual({ t: "Holgado", tone: "ok" });
    expect(fitOf(9, true).t).toBe("Justo");
    expect(fitOf(12, true)).toEqual({ t: "Al límite", tone: "warn" });
    expect(fitOf(13, true).t).toBe("No cabe");
    expect(fitOf(5, false)).toEqual({ t: "Bloqueado", tone: "off" });
  });
  it("one stop at the end, never «….» (bug 8)", () => {
    expect(endSentence("Comprobando si está libre…")).toBe("Comprobando si está libre…");
    expect(endSentence("Libre: así te verán en el vestuario")).toBe("Libre: así te verán en el vestuario.");
  });
});

describe("Apariencia", () => {
  it("the theme's hint and note", () => {
    expect(themeHint("light")).toBe("Día");
    expect(themeNote("system", "dark")).toBe("Sigue a tu móvil: ahora mismo, de noche.");
    expect(themeNote("light", "light")).toBe("Siempre de día en este móvil.");
  });
  it("the animations follow the phone", () => {
    expect(motionNote(true)).toMatch(/menos movimiento/);
    expect(motionNote(false)).toMatch(/completas/);
  });
});

describe("Cuenta", () => {
  it("role and back lines", () => {
    expect(roleLine(true, "jugador")).toBe("Capitán del vestuario del Manchester Piti");
    expect(roleLine(false, "socio")).toBe("Socio del Manchester Piti");
    expect(backLine("jugador", "jordi", "28", false, "")).toBe("JORDI · dorsal 28");
    expect(backLine("nuevo", "", "", true, "30")).toBe("Cuando el capitán acepte tu ficha del 30");
    expect(backLine("nuevo", "", "", false, "")).toBe("Cuando tengas ficha");
    expect(backLine("socio", "", "", false, "")).toBe("Sin ficha de jugador");
  });
});

describe("Capitanía", () => {
  const now = Date.UTC(2026, 9, 31, 12);
  const squad = [{ id: "p30", name: "ALCIDES", number: 30 }];
  it("who knocks: the shirt of the ficha he asks for, else his initials", () => {
    const rows = knockRows(
      [
        { uid: "u1", name: "Kevin Pérez", googleName: "Kevin", email: "k@x.es", playerId: "p30", at: now - 2 * 3600_000 },
        { uid: "u2", name: null, googleName: "Marta Gil", email: "m@x.es", playerId: null, at: now - 60_000 },
      ],
      squad,
      now,
    );
    expect(rows[0]).toMatchObject({ key: "u1", name: "Kevin Pérez", num: "30", line: "Pide la carta del 30 (ALCIDES)" });
    expect(rows[1]).toMatchObject({ name: "Marta Gil", num: null, ini: "MG", line: "Sin dorsal todavía" });
    expect(rows[0].at).toMatch(/2 h/);
  });
  it("the door's hint and toggle, in words", () => {
    expect(doorHint(0)).toBe("Nadie llama");
    expect(doorHint(1)).toBe("1 llama a la puerta");
    expect(doorToggle(true, true)).toBe("Aviso de la puerta: activado en este móvil");
    expect(doorToggle(false, true)).toBe("Aviso de la puerta: desactivado en este móvil");
    expect(doorToggle(false, false)).toMatch(/listo/);
  });
});
