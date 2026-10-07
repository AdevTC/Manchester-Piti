import { describe, expect, it } from "vitest";
import { cleanName, FOREVER_MS, INVITE_PROBLEM, inviteCodePattern, inviteState, newInviteCode, nicknameBase, nicknameCandidates } from "../../functions/src/doorLogic";

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
