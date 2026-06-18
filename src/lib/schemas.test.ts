import { describe, it, expect } from "vitest";
import { userProfileSchema, nicknameSchema, matchResultSchema, seasonFormSchema } from "./schemas";

describe("nicknameSchema", () => {
  it("normaliza a minúsculas y recorta", () => {
    expect(nicknameSchema.parse("  Piti_Goleador ")).toBe("piti_goleador");
  });
  it("rechaza < 3 y > 15 y caracteres inválidos", () => {
    expect(nicknameSchema.safeParse("ab").success).toBe(false);
    expect(nicknameSchema.safeParse("a".repeat(16)).success).toBe(false);
    expect(nicknameSchema.safeParse("piti goleador").success).toBe(false);
  });
});

describe("userProfileSchema", () => {
  it("acepta un perfil válido", () => {
    const p = userProfileSchema.parse({
      email: "a@b.com", nickname: "piti", role: "user", createdAt: new Date(),
    });
    expect(p.role).toBe("user");
  });
  it("rechaza un rol desconocido", () => {
    expect(userProfileSchema.safeParse({ email: "a@b.com", nickname: "piti", role: "root" }).success).toBe(false);
  });
});

describe("matchResultSchema", () => {
  it("rechaza goles negativos", () => {
    expect(matchResultSchema.safeParse({ rival: "X", goalsFor: -1, goalsAgainst: 0, seasonId: "s1" }).success).toBe(false);
  });
});

describe("seasonFormSchema", () => {
  it("rechaza nombre vacío y recorta", () => {
    expect(seasonFormSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(seasonFormSchema.parse({ name: "  Temporada 1 " }).name).toBe("Temporada 1");
  });
});
