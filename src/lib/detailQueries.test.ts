import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Firestore SDK at the module boundary. `doc`/`collection`/`query`/
// `where` are passthrough identity stubs (we only assert behavior, not the ref
// shapes); `getDoc`/`getDocs` are the seams each queryFn awaits. `../firebase`
// is mocked so importing detailQueries does NOT spin up a real Firebase app.
vi.mock("../firebase", () => ({ db: {} }));

const getDoc = vi.fn();
const getDocs = vi.fn();
vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ __ref: args }),
  collection: (...args: unknown[]) => ({ __coll: args }),
  query: (...args: unknown[]) => ({ __query: args }),
  where: (...args: unknown[]) => ({ __where: args }),
  getDoc: (...args: unknown[]) => getDoc(...args),
  getDocs: (...args: unknown[]) => getDocs(...args),
}));

import {
  matchDetailQuery,
  playerDetailQuery,
  playersNameMapQuery,
} from "./detailQueries";

/** Build a getDoc-style snapshot. */
function docSnap(opts: { id: string; exists: boolean; data?: Record<string, unknown> }) {
  return {
    id: opts.id,
    exists: () => opts.exists,
    data: () => opts.data ?? {},
  };
}

beforeEach(() => {
  getDoc.mockReset();
  getDocs.mockReset();
});

describe("matchDetailQuery", () => {
  it("devuelve null cuando el doc no existe (not-found)", async () => {
    getDoc.mockResolvedValue(docSnap({ id: "m1", exists: false }));
    const result = await matchDetailQuery("m1").queryFn!({} as never);
    expect(result).toBeNull();
  });

  it("devuelve el doc validado cuando existe", async () => {
    getDoc.mockResolvedValue(
      docSnap({
        id: "m1",
        exists: true,
        data: { rival: "Barrio FC", goalsFor: 3, goalsAgainst: 1, seasonId: "s1" },
      }),
    );
    const result = await matchDetailQuery("m1").queryFn!({} as never);
    expect(result).toEqual({
      id: "m1",
      rival: "Barrio FC",
      goalsFor: 3,
      goalsAgainst: 1,
      seasonId: "s1",
    });
  });

  it("devuelve null cuando el doc existe pero es inválido (goles negativos)", async () => {
    // seasonMatchSchema rejects negative goalsFor → safeParse fails → null.
    getDoc.mockResolvedValue(
      docSnap({ id: "m2", exists: true, data: { rival: "X", goalsFor: -1 } }),
    );
    const result = await matchDetailQuery("m2").queryFn!({} as never);
    expect(result).toBeNull();
  });

  it("normaliza campos null a ausentes antes de validar (dropNullFields)", async () => {
    // A null `date` would make z.optional() reject and drop the whole doc; the
    // queryFn runs dropNullFields first, so the doc validates with date absent.
    getDoc.mockResolvedValue(
      docSnap({ id: "m3", exists: true, data: { rival: "Y", date: null } }),
    );
    const result = await matchDetailQuery("m3").queryFn!({} as never);
    expect(result).toEqual({ id: "m3", rival: "Y" });
  });

  it("usa la queryKey ['match', id]", () => {
    expect(matchDetailQuery("abc").queryKey).toEqual(["match", "abc"]);
  });
});

describe("playerDetailQuery", () => {
  it("devuelve null cuando el doc no existe", async () => {
    getDoc.mockResolvedValue(docSnap({ id: "p1", exists: false }));
    const result = await playerDetailQuery("p1").queryFn!({} as never);
    expect(result).toBeNull();
  });

  it("devuelve el jugador validado cuando existe", async () => {
    getDoc.mockResolvedValue(
      docSnap({
        id: "p1",
        exists: true,
        data: { firstName: "Adri", shirtName: "ADRI", number: 10 },
      }),
    );
    const result = await playerDetailQuery("p1").queryFn!({} as never);
    expect(result).toEqual({ id: "p1", firstName: "Adri", shirtName: "ADRI", number: 10 });
  });

  it("usa la queryKey ['player', id]", () => {
    expect(playerDetailQuery("xyz").queryKey).toEqual(["player", "xyz"]);
  });
});

describe("playersNameMapQuery", () => {
  it("construye el mapa id→shirtName (cae a firstName y luego a —)", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "p1", data: () => ({ shirtName: "ADRI", firstName: "Adrián", number: 10 }) },
        { id: "p2", data: () => ({ firstName: "Bruno", number: 7 }) }, // no shirtName → firstName
        { id: "p3", data: () => ({ number: 3 }) }, // neither → "—"
      ],
    });
    const map = await playersNameMapQuery.queryFn!({} as never);
    expect(map).toEqual({ p1: "ADRI", p2: "Bruno", p3: "—" });
  });

  it("descarta filas inválidas sin romper el mapa", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "p1", data: () => ({ shirtName: "OK" }) },
        // number must be a number if present; a string fails playerSchema → dropped.
        { id: "bad", data: () => ({ shirtName: "NOPE", number: "not-a-number" }) },
      ],
    });
    const map = await playersNameMapQuery.queryFn!({} as never);
    expect(map).toEqual({ p1: "OK" });
  });
});
