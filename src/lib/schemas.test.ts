import { describe, it, expect } from "vitest";
import {
  userProfileSchema,
  nicknameSchema,
  matchResultSchema,
  seasonFormSchema,
  parseDocs,
  seasonSchema,
  seasonMatchSchema,
  playerSchema,
  userDocSchema,
  lineupSchema,
} from "./schemas";

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

// ── New schemas ──────────────────────────────────────────────────────────────

describe("parseDocs", () => {
  it("descarta docs inválidos y conserva los válidos", () => {
    const docs = [
      { id: "ok", data: () => ({ rival: "X", goalsFor: 1, goalsAgainst: 0, seasonId: "s1" }) },
      { id: "bad", data: () => ({ rival: "Y", goalsFor: -3 }) },
    ];
    const out = parseDocs(seasonMatchSchema, docs, "matches");
    expect(out.map((m) => m.id)).toEqual(["ok"]);
  });

  it("acepta docs con campos opcionales ausentes", () => {
    const docs = [
      { id: "minimal", data: () => ({ seasonId: "s1" }) },
    ];
    const out = parseDocs(seasonMatchSchema, docs, "matches");
    expect(out.map((m) => m.id)).toEqual(["minimal"]);
  });

  it("trata null como ausente (no descarta el doc)", () => {
    const docs = [
      { id: "p1", data: () => ({ firstName: "A", number: 7, height: null, weight: null, naturalPosition: null }) },
      { id: "p2", data: () => ({ firstName: "B", lastName: "C", shirtName: "BC", number: 9 }) },
    ];
    const out = parseDocs(playerSchema, docs, "players");
    expect(out.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("seasonSchema", () => {
  it("acepta un doc válido", () => {
    const r = seasonSchema.safeParse({ id: "s1", name: "Temporada 1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe("s1");
  });

  it("acepta doc sin captainPlayerId", () => {
    const r = seasonSchema.safeParse({ id: "s1", name: "T1" });
    expect(r.success).toBe(true);
  });

  it("rechaza doc sin name", () => {
    const r = seasonSchema.safeParse({ id: "s1" });
    expect(r.success).toBe(false);
  });
});

describe("seasonMatchSchema", () => {
  it("acepta un doc completo", () => {
    const r = seasonMatchSchema.safeParse({
      id: "m1",
      seasonId: "s1",
      rival: "Rival FC",
      goalsFor: 2,
      goalsAgainst: 1,
      date: { seconds: 1700000000 },
    });
    expect(r.success).toBe(true);
  });

  it("acepta un doc con campos opcionales ausentes (partido en curso)", () => {
    const r = seasonMatchSchema.safeParse({ id: "m1", seasonId: "s1" });
    expect(r.success).toBe(true);
  });

  it("acepta un partido legacy sin seasonId (query 'all'/Admin no filtra)", () => {
    const r = seasonMatchSchema.safeParse({ id: "m1", rival: "X", goalsFor: 1, goalsAgainst: 0 });
    expect(r.success).toBe(true);
  });

  it("conserva campos extra (looseObject passthrough: competition, events)", () => {
    const r = seasonMatchSchema.safeParse({
      id: "m1",
      seasonId: "s1",
      competition: "Liga",
      events: [{ type: "goal", playerId: "p1" }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const data = r.data as Record<string, unknown>;
      expect(data.competition).toBe("Liga");
      expect(data.events).toEqual([{ type: "goal", playerId: "p1" }]);
    }
  });

  it("rechaza goalsFor negativo (campo presente pero corrupto)", () => {
    const r = seasonMatchSchema.safeParse({ id: "m1", seasonId: "s1", rival: "X", goalsFor: -3 });
    expect(r.success).toBe(false);
  });
});

describe("playerSchema", () => {
  it("acepta un jugador completo", () => {
    const r = playerSchema.safeParse({
      id: "p1",
      firstName: "Adrián",
      lastName: "Gómez",
      shirtName: "ADRI",
      number: 10,
      seasons: ["s1"],
      active: true,
      injured: false,
    });
    expect(r.success).toBe(true);
  });

  it("acepta un jugador sin campos opcionales", () => {
    const r = playerSchema.safeParse({ id: "p1", firstName: "A", lastName: "B", shirtName: "AB", number: 7 });
    expect(r.success).toBe(true);
  });

  it("acepta un jugador sin firstName/lastName/shirtName/number (defaults downstream)", () => {
    const r = playerSchema.safeParse({ id: "p1" });
    expect(r.success).toBe(true);
  });

  it("rechaza number no numérico (campo presente pero de tipo incorrecto)", () => {
    const r = playerSchema.safeParse({ id: "p1", firstName: "A", lastName: "B", shirtName: "AB", number: "siete" });
    expect(r.success).toBe(false);
  });
});

describe("userDocSchema", () => {
  it("acepta un usuario válido", () => {
    const r = userDocSchema.safeParse({ uid: "u1", nickname: "piti", email: "p@p.com", role: "admin" });
    expect(r.success).toBe(true);
  });

  it("acepta cualquier string de role (permisivo para no descartar filas)", () => {
    const r = userDocSchema.safeParse({ uid: "u1", nickname: "x", email: "x@x.com", role: "superadmin" });
    expect(r.success).toBe(true);
  });
});

describe("lineupSchema", () => {
  it("acepta un doc de lineup con seasonId", () => {
    const r = lineupSchema.safeParse({ id: "l1", seasonId: "s1" });
    expect(r.success).toBe(true);
  });

  it("rechaza un doc sin seasonId", () => {
    const r = lineupSchema.safeParse({ id: "l1" });
    expect(r.success).toBe(false);
  });

  it("acepta un doc con campos de tablero adicionales", () => {
    const r = lineupSchema.safeParse({
      id: "l1",
      seasonId: "s1",
      ownerUid: "u1",
      name: "Mi tablero",
      isOfficial: false,
      formation: "2-3-1",
    });
    expect(r.success).toBe(true);
  });
});
