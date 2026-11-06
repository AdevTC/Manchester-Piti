import { describe, expect, it } from "vitest";
import { cleanName, DOOR_PING_GAP_MS, doorPingDue, DOOR_SHIRTS_MEMO_MS, FOREVER_MS, INVITE_PROBLEM, inviteCodePattern, inviteState, memoFor, newInviteCode, nicknameBase, nicknameCandidates } from "../../functions/src/doorLogic";

describe("doorShirts: memoria de 30 s por instancia", () => {
  it("dentro de la ventana no vuelve a leer; fuera, sí", async () => {
    let t = 1_000;
    let loads = 0;
    const get = memoFor(DOOR_SHIRTS_MEMO_MS, async () => ++loads, () => t);
    expect(await get()).toBe(1);
    t += DOOR_SHIRTS_MEMO_MS - 1;
    expect(await get()).toBe(1);
    t += 1;
    expect(await get()).toBe(2);
    expect(loads).toBe(2);
  });
  it("las llamadas mientras carga comparten una lectura", async () => {
    let loads = 0;
    const get = memoFor(30_000, async () => ++loads, () => 0);
    const [a, b] = await Promise.all([get(), get()]);
    expect([a, b, loads]).toEqual([1, 1, 1]);
  });
  it("un fallo no se guarda: la siguiente llamada vuelve a leer", async () => {
    let loads = 0;
    const get = memoFor(
      30_000,
      async () => {
        loads++;
        if (loads === 1) throw new Error("caída");
        return loads;
      },
      () => 0,
    );
    await expect(get()).rejects.toThrow("caída");
    expect(await get()).toBe(2);
  });
  it("un reloj que va hacia atrás no alarga la memoria", async () => {
    let t = 50_000;
    let loads = 0;
    const get = memoFor(30_000, async () => ++loads, () => t);
    await get();
    t = 10_000;
    expect(await get()).toBe(2);
  });
});

describe("La puerta: invitaciones", () => {
  it("codes are 10 readable symbols, never 0/O/1/I/L", () => {
    const code = newInviteCode();
    expect(code).toMatch(inviteCodePattern);
    expect(code).not.toMatch(/[01OIL]/);
    expect(newInviteCode(() => new Uint8Array(10))).toBe("AAAAAAAAAA");
  });
  it("an invitation dies when it expires, is used up or revoked", () => {
    const now = 1_000;
    expect(inviteState(undefined, now)).toBe("missing");
    expect(inviteState({ expiresAt: 2_000, maxUses: 1, uses: 0 }, now)).toBe("valid");
    expect(inviteState({ expiresAt: 2_000, maxUses: 1, uses: 1 }, now)).toBe("used");
    expect(inviteState({ expiresAt: 2_000, maxUses: 0, uses: 40 }, now)).toBe("valid");
    expect(inviteState({ expiresAt: 1_000, maxUses: 0, uses: 0 }, now)).toBe("expired");
    expect(inviteState({ expiresAt: 2_000, maxUses: 1, uses: 0, revoked: true }, now)).toBe("revoked");
    expect(INVITE_PROBLEM.used).toMatch(/Pide acceso/);
  });
  it("membership is effectively forever", () => {
    expect(FOREVER_MS).toBeGreaterThan(Date.UTC(2100, 0, 1));
  });
});

describe("La puerta: quién eres", () => {
  it("nickname from the ficha, the typed name or the Google account", () => {
    expect(nicknameBase("ADRIÁN T.C.")).toBe("adrian_t_c");
    expect(nicknameBase(undefined, "Pepe")).toBe("pepe");
    expect(nicknameBase("", "Al")).toBe("al_piti");
    expect(nicknameBase(undefined, undefined, undefined, "jordi.dev@example.com")).toBe("jordi_dev");
    expect(nicknameBase("Un nombre larguísimo de verdad")).toBe("un_nombre_largu");
    expect(nicknameBase()).toBe("jugador");
  });
  it("collisions get a number and stay within 15 characters", () => {
    const c = nicknameCandidates("un_nombre_largu", 12);
    expect(c[0]).toBe("un_nombre_largu");
    expect(c[1]).toBe("un_nombre_larg2");
    expect(c[11]).toBe("un_nombre_lar12");
    expect(c.every((n) => /^[a-z0-9_]{3,15}$/.test(n))).toBe(true);
  });
  it("typed names are trimmed and capped", () => {
    expect(cleanName("  Pepe   el   portero ")).toBe("Pepe el portero");
    expect(cleanName("x".repeat(80))).toHaveLength(40);
  });
});

describe("La puerta: «Llaman a la puerta» suena una vez por petición", () => {
  const now = 1_800_000_000_000;
  it("a first request, or one replacing an answered one, rings the captains", () => {
    expect(doorPingDue(null, now)).toBe(true);
    expect(doorPingDue({ status: "rejected", pingedAt: now - 1000 }, now)).toBe(true);
    expect(doorPingDue({ status: "removed" }, now)).toBe(true);
    // (a pending one from before the stamp)
    expect(doorPingDue({ status: "pending" }, now)).toBe(true);
  });
  it("asking again while it still waits rings only once the gap has passed", () => {
    expect(doorPingDue({ status: "pending", pingedAt: now - 1000 }, now)).toBe(false);
    expect(doorPingDue({ status: "pending", pingedAt: now - DOOR_PING_GAP_MS + 1 }, now)).toBe(false);
    expect(doorPingDue({ status: "pending", pingedAt: now - DOOR_PING_GAP_MS }, now)).toBe(true);
    // (a stamp from the future — a clock gone wrong — never silences it)
    expect(doorPingDue({ status: "pending", pingedAt: now + 60_000 }, now)).toBe(true);
  });
});
