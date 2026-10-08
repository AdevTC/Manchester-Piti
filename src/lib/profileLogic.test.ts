import { describe, expect, it } from "vitest";
import {
  fold,
  NICK_COPY,
  nicknameProblem,
  normalizeShirtName,
  RESERVED_NICKNAMES,
  SHIRT_COPY,
  shirtFormatProblem,
  shirtNameProblem,
  shirtTakenMessage,
} from "../../functions/src/profileLogic";

const squad = [
  { id: "erik", name: "ERIK", number: 9 },
  { id: "alvaro", name: "ÁLVARO", number: 7 },
  { id: "nono", name: "NOÑO", number: 4 },
  { id: "sin", name: "SIN DORSAL", number: null },
];

describe("Tu nombre · En la espalda (las reglas del servidor)", () => {
  it("normaliza: mayúsculas en español, espacios colapsados, apóstrofo tipográfico", () => {
    expect(normalizeShirtName("  adrián   t.c. ")).toBe("ADRIÁN T.C.");
    expect(normalizeShirtName("o’neill")).toBe("O'NEILL");
    expect(normalizeShirtName("niño")).toBe("NIÑO");
    // composed and decomposed accents print the same
    expect(normalizeShirtName("josé")).toBe("JOSÉ");
  });
  it("fold ignora mayúsculas, tildes y la tilde de la ñ", () => {
    expect(fold("Álvaro")).toBe("ALVARO");
    expect(fold("NOÑO")).toBe(fold("nono"));
    expect(fold("  a   b ")).toBe("A B");
  });
  it("aplica las reglas 2–4 en el orden del diseño", () => {
    expect(shirtFormatProblem("")).toBe("empty");
    expect(shirtFormatProblem("A")).toBe("short");
    expect(shirtFormatProblem("AB")).toBeNull();
    expect(shirtFormatProblem("ABCDEFGHIJKL")).toBeNull(); // 12
    expect(shirtFormatProblem("ABCDEFGHIJKLM")).toBe("long"); // 13
    expect(shirtFormatProblem("R2D2")).toBe("digits");
    expect(shirtFormatProblem("A_B")).toBe("chars");
    expect(shirtFormatProblem("A@B")).toBe("chars");
    expect(shirtFormatProblem(". -")).toBe("noletter");
    expect(shirtFormatProblem("D'ARTAGNAN")).toBeNull();
    expect(shirtFormatProblem("JEAN-LUC")).toBeNull();
    expect(shirtFormatProblem("T.C.")).toBeNull();
    expect(shirtFormatProblem("ÇÜÑ")).toBeNull();
  });
  it("cuenta los espacios como caracteres", () => {
    expect(shirtNameProblem("ab cd ef gh i", [])?.code).toBe("long"); // 13 with spaces
    expect(shirtNameProblem("ab cd ef gh", [])).toBeNull(); // 11
  });
  it("dos espaldas no pueden decir lo mismo (sin mirar mayúsculas ni tildes)", () => {
    const p = shirtNameProblem("alvaro", squad);
    expect(p?.code).toBe("taken");
    expect(p?.message).toBe("Ya la lleva el 7 (ÁLVARO): elige otro");
    expect(p?.takenBy?.id).toBe("alvaro");
    expect(shirtNameProblem("nono", squad)?.takenBy?.id).toBe("nono");
    expect(shirtNameProblem("Erik", squad)?.message).toBe("Ya la lleva el 9 (ERIK): elige otro");
    expect(shirtNameProblem("sin  dorsal", squad)?.message).toBe("Ya la lleva SIN DORSAL: elige otro");
    expect(shirtNameProblem("ERIKA", squad)).toBeNull();
  });
  it("los mensajes son los del diseño", () => {
    expect(shirtNameProblem("", [])?.message).toBe(SHIRT_COPY.empty);
    expect(shirtNameProblem("R9", [])?.message).toBe("Sin números: el dorsal ya va debajo");
    expect(shirtNameProblem("a", [])?.message).toBe("Mínimo 2 caracteres");
    expect(shirtNameProblem("abcdefghijklmn", [])?.message).toBe("Máximo 12 caracteres: no cabe en la espalda");
    expect(shirtTakenMessage({ id: "x", name: "ERIK", number: "9" })).toBe("Ya la lleva el 9 (ERIK): elige otro");
  });
});

describe("Tu nombre · Tu apodo (las reglas del servidor)", () => {
  it("3–15 caracteres de a–z, 0–9 y _", () => {
    expect(nicknameProblem("")?.code).toBe("empty");
    expect(nicknameProblem("ab")?.code).toBe("short");
    expect(nicknameProblem("abc")).toBeNull();
    expect(nicknameProblem("a".repeat(15))).toBeNull();
    expect(nicknameProblem("a".repeat(16))?.code).toBe("long");
    expect(nicknameProblem("adrian.tc")?.code).toBe("chars");
    expect(nicknameProblem("adrian-tc")?.code).toBe("chars");
    expect(nicknameProblem("Adrian")?.code).toBe("chars");
    expect(nicknameProblem("adrián")?.code).toBe("chars");
    expect(nicknameProblem("kevin_11")).toBeNull();
  });
  it("los apodos del club están reservados", () => {
    for (const n of RESERVED_NICKNAMES) expect(nicknameProblem(n)?.code).toBe("reserved");
    expect(RESERVED_NICKNAMES).toEqual(["admin", "capitan", "capitanes", "manchesterpiti", "piti", "soporte", "sistema"]);
    expect(nicknameProblem("pitito")).toBeNull();
  });
  it("con los mensajes del diseño", () => {
    expect(nicknameProblem("ab")?.message).toBe("Mínimo 3 caracteres");
    expect(nicknameProblem("a.b.c")?.message).toBe("Solo letras a–z, números y _ (sin puntos ni guiones)");
    expect(NICK_COPY.taken).toBe("Ya lo usa otro socio del vestuario");
  });
});
