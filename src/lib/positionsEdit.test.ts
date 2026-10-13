import { describe, expect, it } from "vitest";
import { MAX_ALSO, POS_CODES, type PosCode, type PositionSet } from "./positions";
import { cyclePosition, positionsPayload, proposalDiff, proposalPayload, proposalState, reviewPayload } from "./positionsEdit";

const set = (main: PosCode | null, also: PosCode[] = []): PositionSet => ({ main, also });

/** The shape constraints the Firestore rules (validPosSet) impose. */
function expectValidSet(s: PositionSet) {
  expect(Object.keys(s).sort()).toEqual(["also", "main"]);
  expect(s.also.length).toBeLessThanOrEqual(6);
  expect(new Set(s.also).size).toBe(s.also.length);
  if (s.main !== null) expect(s.also).not.toContain(s.main);
  for (const c of [...(s.main ? [s.main] : []), ...s.also]) expect(POS_CODES).toContain(c);
}

describe("cyclePosition", () => {
  it("nada -> también", () => {
    expect(cyclePosition(set(null), "MC")).toEqual(set(null, ["MC"]));
    expect(cyclePosition(set("DC", ["MC"]), "EI")).toEqual(set("DC", ["MC", "EI"]));
  });

  it("también -> preferida (quita de también)", () => {
    expect(cyclePosition(set(null, ["MC", "EI"]), "MC")).toEqual(set("MC", ["EI"]));
  });

  it("preferida nueva degrada a la antigua a también", () => {
    expect(cyclePosition(set("DC", ["MC"]), "MC")).toEqual(set("MC", ["DC"]));
    expect(cyclePosition(set("DC", ["MC", "EI"]), "EI")).toEqual(set("EI", ["MC", "DC"]));
  });

  it("preferida -> nada", () => {
    expect(cyclePosition(set("DC", ["MC"]), "DC")).toEqual(set(null, ["MC"]));
    expect(cyclePosition(set("DC"), "DC")).toEqual(set(null));
  });

  it("ciclo completo de una posición vuelve al principio", () => {
    let s = set(null);
    s = cyclePosition(s, "LI");
    expect(s).toEqual(set(null, ["LI"]));
    s = cyclePosition(s, "LI");
    expect(s).toEqual(set("LI"));
    s = cyclePosition(s, "LI");
    expect(s).toEqual(set(null));
  });

  it("con 6 también, uno nuevo se rechaza y devuelve el mismo conjunto", () => {
    const full = set("DC", ["MC", "MI", "MD", "EI", "ED", "MCO"]);
    expect(full.also).toHaveLength(MAX_ALSO);
    const out = cyclePosition(full, "LI");
    expect(out).toBe(full);
  });

  it("con 6 también, los que ya están sí avanzan (también -> preferida)", () => {
    const full = set("DC", ["MC", "MI", "MD", "EI", "ED"]);
    const six = set("DC", [...full.also, "MCO"]);
    const out = cyclePosition(six, "MC");
    expect(out.main).toBe("MC");
    expect(out.also).toHaveLength(6);
    expect(out.also).toContain("DC");
    expectValidSet(out);
  });

  it("con 6 también y sin preferida, un código nuevo también se rechaza", () => {
    const six = set(null, ["MC", "MI", "MD", "EI", "ED", "MCO"]);
    expect(cyclePosition(six, "LI")).toBe(six);
  });

  it("no muta la entrada", () => {
    const s = set("DC", ["MC"]);
    const snap = JSON.stringify(s);
    cyclePosition(s, "MC");
    cyclePosition(s, "DC");
    cyclePosition(s, "LI");
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("siempre devuelve un conjunto válido para las reglas", () => {
    for (const a of POS_CODES) {
      let s = set(null);
      for (let i = 0; i < 4; i++) {
        for (const b of POS_CODES) {
          s = cyclePosition(s, b);
          expectValidSet(s);
        }
        s = cyclePosition(s, a);
        expectValidSet(s);
      }
    }
  });
});

describe("positionsPayload", () => {
  it("con preferida: positions + naturalPosition = su línea", () => {
    expect(positionsPayload(set("MC", ["EI"]))).toEqual({ positions: { main: "MC", also: ["EI"] }, naturalPosition: "MED" });
    expect(positionsPayload(set("POR"))).toEqual({ positions: { main: "POR", also: [] }, naturalPosition: "POR" });
    expect(positionsPayload(set("DC"))).toEqual({ positions: { main: "DC", also: [] }, naturalPosition: "DEL" });
    expect(positionsPayload(set("LD"))).toMatchObject({ naturalPosition: "DEF" });
  });

  it("sin preferida: sin naturalPosition (ni la clave)", () => {
    const p = positionsPayload(set(null, ["MC"]));
    expect(p).toEqual({ positions: { main: null, also: ["MC"] } });
    expect("naturalPosition" in p).toBe(false);
  });

  it("conjunto vacío es válido", () => {
    expect(positionsPayload(set(null))).toEqual({ positions: { main: null, also: [] } });
  });

  it("limpia el conjunto: sin repetidos, sin la preferida en también, tope 6, solo claves main/also", () => {
    const dirty = { main: "MC", also: ["MC", "EI", "EI", "DC", "LI", "LD", "MI", "MD", "ED"], extra: 1 } as unknown as PositionSet;
    const p = positionsPayload(dirty);
    expectValidSet(p.positions);
    expect(p.positions.also).toEqual(["EI", "DC", "LI", "LD", "MI", "MD"]);
    expect(Object.keys(p.positions).sort()).toEqual(["also", "main"]);
  });
});

describe("proposalPayload", () => {
  const ts = { sentinel: "serverTimestamp" };

  it("propuesta: main, also y at", () => {
    expect(proposalPayload(set("MC", ["EI"]), ts)).toEqual({ positionsProposal: { main: "MC", also: ["EI"], at: ts } });
    const p = proposalPayload(set(null, ["EI"]), ts);
    expect(p.positionsProposal).toMatchObject({ main: null, also: ["EI"] });
    expect(p.positionsProposal && (p.positionsProposal as { at: unknown }).at).toBe(ts);
  });

  it("solo las claves main/also/at (hasOnly de las reglas)", () => {
    const p = proposalPayload(set("MC", ["EI"]), ts).positionsProposal as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(["also", "at", "main"]);
    expectValidSet({ main: p.main as PosCode, also: p.also as PosCode[] });
  });

  it("conjunto vacío sigue siendo una propuesta válida", () => {
    expect(proposalPayload(set(null), ts)).toEqual({ positionsProposal: { main: null, also: [], at: ts } });
  });

  it("null retira la propuesta", () => {
    expect(proposalPayload(null, ts)).toEqual({ positionsProposal: null });
  });

  it("solo toca positionsProposal", () => {
    expect(Object.keys(proposalPayload(set("MC"), ts))).toEqual(["positionsProposal"]);
    expect(Object.keys(proposalPayload(null, ts))).toEqual(["positionsProposal"]);
  });
});

describe("reviewPayload", () => {
  const ts = { sentinel: "serverTimestamp" };

  it.each(["aprobada", "ajustada"] as const)("%s: positions + naturalPosition + propuesta null + review", (kind) => {
    expect(reviewPayload(kind, set("MC", ["EI"]), "uid1", ts)).toEqual({
      positions: { main: "MC", also: ["EI"] },
      naturalPosition: "MED",
      positionsProposal: null,
      positionsReview: { status: kind, at: ts, by: "uid1" },
    });
  });

  it("aprobada sin preferida: sin naturalPosition", () => {
    const p = reviewPayload("aprobada", set(null, ["EI"]), "u", ts);
    expect("naturalPosition" in p).toBe(false);
    expect(p.positions).toEqual({ main: null, also: ["EI"] });
  });

  it("rechazada: sin positions (ni naturalPosition), propuesta null y review", () => {
    const p = reviewPayload("rechazada", set("MC", ["EI"]), "uid1", ts);
    expect(p).toEqual({ positionsProposal: null, positionsReview: { status: "rechazada", at: ts, by: "uid1" } });
    expect("positions" in p).toBe(false);
    expect("naturalPosition" in p).toBe(false);
  });

  it("rechazada sin conjunto tampoco lleva positions", () => {
    const p = reviewPayload("rechazada", null, "uid1", ts);
    expect("positions" in p).toBe(false);
    expect(p.positionsProposal).toBeNull();
  });

  it("review solo con las claves status/at/by", () => {
    for (const kind of ["aprobada", "ajustada", "rechazada"] as const) {
      const r = reviewPayload(kind, set("MC"), "uid1", ts).positionsReview as Record<string, unknown>;
      expect(Object.keys(r).sort()).toEqual(["at", "by", "status"]);
    }
  });

  it("aprobar con conjunto nulo escribe un conjunto vacío válido", () => {
    expect(reviewPayload("ajustada", null, "u", ts).positions).toEqual({ main: null, also: [] });
  });

  it("limpia el conjunto escrito", () => {
    const dirty = { main: "MC", also: ["MC", "EI", "EI"] } as PositionSet;
    expectValidSet(reviewPayload("ajustada", dirty, "u", ts).positions as PositionSet);
  });
});

describe("proposalState", () => {
  const at = new Date(0);

  it("ninguna sin propuesta ni revisión", () => {
    expect(proposalState({})).toBe("ninguna");
    expect(proposalState({ positionsProposal: null, positionsReview: null })).toBe("ninguna");
  });

  it("pendiente cuando hay propuesta (aunque haya revisión previa)", () => {
    expect(proposalState({ positionsProposal: { main: "MC", also: [], at } })).toBe("pendiente");
    expect(
      proposalState({ positionsProposal: { main: null, also: [], at }, positionsReview: { status: "rechazada", at, by: "x" } }),
    ).toBe("pendiente");
  });

  it("sin propuesta, el estado es el de la última revisión", () => {
    for (const status of ["aprobada", "ajustada", "rechazada"] as const) {
      expect(proposalState({ positionsProposal: null, positionsReview: { status, at, by: "x" } })).toBe(status);
      expect(proposalState({ positionsReview: { status, at, by: "x" } })).toBe(status);
    }
  });

  it("valores raros se ignoran", () => {
    expect(proposalState({ positionsProposal: "x" as never })).toBe("ninguna");
    expect(proposalState({ positionsReview: { status: "otra", at, by: "x" } as never })).toBe("ninguna");
  });
});

describe("proposalDiff", () => {
  it("sin cambios", () => {
    expect(proposalDiff(set("MC", ["EI"]), set("MC", ["EI"]))).toEqual({ added: [], removed: [] });
  });

  it("añadidas y quitadas", () => {
    expect(proposalDiff(set("MC", ["EI", "ED"]), set("MC", ["EI", "DC"]))).toEqual({ added: ["DC"], removed: ["ED"] });
  });

  it("cambio de preferida", () => {
    expect(proposalDiff(set("MC", []), set("DC", []))).toEqual({ added: ["DC"], removed: ["MC"], mainChange: ["MC", "DC"] });
  });

  it("preferida que pasa a también: no es añadida ni quitada, pero sí cambio de preferida", () => {
    expect(proposalDiff(set("MC", ["EI"]), set("EI", ["MC"]))).toEqual({ added: [], removed: [], mainChange: ["MC", "EI"] });
  });

  it("de sin preferida a una, y al revés", () => {
    expect(proposalDiff(set(null, ["MC"]), set("MC"))).toEqual({ added: [], removed: [], mainChange: [null, "MC"] });
    expect(proposalDiff(set("MC"), set(null, ["MC"]))).toEqual({ added: [], removed: [], mainChange: ["MC", null] });
  });

  it("actual nulo (sin posiciones) cuenta como vacío", () => {
    expect(proposalDiff(null, set("MC", ["EI"]))).toEqual({ added: ["MC", "EI"], removed: [], mainChange: [null, "MC"] });
  });

  it("propuesta vacía quita todo", () => {
    expect(proposalDiff(set("MC", ["EI"]), set(null))).toEqual({ added: [], removed: ["MC", "EI"], mainChange: ["MC", null] });
  });

  it("ambos vacíos", () => {
    expect(proposalDiff(null, null)).toEqual({ added: [], removed: [] });
  });
});
