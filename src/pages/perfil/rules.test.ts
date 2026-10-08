import { describe, expect, it } from "vitest";
import { archLetters, archOffsets, nicknameCheck, shirtFitLabel, shirtNameCheck, shirtSize, typeNickname, typeShirtName } from "./rules";

const squad = [
  { id: "adrian", name: "ADRIÁN T.C.", number: 10 },
  { id: "erik", name: "ERIK", number: 9 },
  { id: "eguzquiza", name: "EGUZQUIZA", number: 8 },
];

describe("En la espalda: la comprobación en vivo", () => {
  it("igual que la de ahora → neutral, sin estampar", () => {
    const c = shirtNameCheck("adrián t.c.", "ADRIÁN T.C.", squad, "adrian");
    expect(c).toMatchObject({ state: "same", tone: "same", message: "Es lo que llevas ahora" });
  });
  it("un nombre de antes en minúsculas también cuenta como el de ahora", () => {
    expect(shirtNameCheck("ERIK", "Erik", squad, "erik").state).toBe("same");
  });
  it("cada regla con su mensaje y en su orden", () => {
    const at = (d: string) => shirtNameCheck(d, "ADRIÁN T.C.", squad, "adrian");
    expect(at("   ")).toMatchObject({ state: "empty", tone: "bad", message: "Escribe lo que quieres a tu espalda" });
    expect(at("a")).toMatchObject({ state: "short", message: "Mínimo 2 caracteres" });
    expect(at("abcdefghijklm")).toMatchObject({ state: "long", message: "Máximo 12 caracteres: no cabe en la espalda", size: "nocabe" });
    expect(at("adri 10")).toMatchObject({ state: "digits", message: "Sin números: el dorsal ya va debajo" });
    expect(at("adri!")).toMatchObject({ state: "chars", message: "Solo letras, espacios, punto, guion o apóstrofo" });
    expect(at("--")).toMatchObject({ state: "noletter", message: "Pon al menos una letra" });
    expect(at("adri")).toMatchObject({ state: "ok", tone: "ok", message: "Libre: así quedará a tu espalda", value: "ADRI", length: 4, size: "n1" });
  });
  it("ocupada por otro, sin mirar mayúsculas ni tildes, y nunca por uno mismo", () => {
    const c = shirtNameCheck("érik", "ADRIÁN T.C.", squad, "adrian");
    expect(c.state).toBe("taken");
    expect(c.message).toBe("Ya la lleva el 9 (ERIK): elige otro");
    expect(c.takenBy?.id).toBe("erik");
    // the player's own current name with other accents is "same", not "taken"
    expect(shirtNameCheck("adrian t.c.", "ADRIÁN T.C.", squad, "adrian").state).toBe("ok");
  });
  it("normaliza espacios y apóstrofos antes de contar", () => {
    const c = shirtNameCheck("  o’neill   jr ", "X", [], null);
    expect(c.value).toBe("O'NEILL JR");
    expect(c.length).toBe(10);
    expect(c.state).toBe("ok");
  });
});

describe("el tamaño de la letra en la espalda", () => {
  it("encoge con la longitud (espacios incluidos)", () => {
    expect([0, 1, 5, 6, 8, 9, 10, 11, 12, 13, 16].map(shirtSize)).toEqual(["n1", "n1", "n1", "n2", "n2", "n3", "n3", "n4", "n4", "nocabe", "nocabe"]);
    expect(shirtFitLabel(0)).toBe("Sin nombre");
    expect(shirtFitLabel(4)).toBe("Letra grande");
    expect(shirtFitLabel(7)).toBe("Letra normal");
    expect(shirtFitLabel(9)).toBe("Letra estrecha");
    expect(shirtFitLabel(12)).toBe("Letra muy estrecha");
    expect(shirtFitLabel(13)).toBe("No cabe");
  });
  it("el caso largo: EGUZQUIZA es letra estrecha", () => {
    expect(shirtNameCheck("eguzquiza", "EGUZQUIZA", squad, "eguzquiza").size).toBe("n3");
  });
});

describe("Tu apodo: la comprobación en vivo", () => {
  it("las reglas del servidor con los mensajes del diseño", () => {
    expect(nicknameCheck("adrian_tc", "adrian_tc")).toMatchObject({ state: "same", message: "Es tu apodo de ahora" });
    expect(nicknameCheck("", "adrian_tc")).toMatchObject({ state: "empty", message: "Escribe tu apodo" });
    expect(nicknameCheck("ad", "adrian_tc")).toMatchObject({ state: "short", message: "Mínimo 3 caracteres" });
    expect(nicknameCheck("a".repeat(16), "adrian_tc")).toMatchObject({ state: "long", message: "Máximo 15 caracteres" });
    expect(nicknameCheck("adrian.tc", "adrian_tc")).toMatchObject({ state: "chars", message: "Solo letras a–z, números y _ (sin puntos ni guiones)" });
    expect(nicknameCheck("piti", "adrian_tc").state).toBe("reserved");
  });
  it("libre, ocupado o comprobando", () => {
    expect(nicknameCheck("adri", "adrian_tc")).toMatchObject({ state: "ok", tone: "ok", message: "Libre: así te verán en el vestuario" });
    expect(nicknameCheck("adri", "adrian_tc", false).state).toBe("ok");
    expect(nicknameCheck("erik", "adrian_tc", true)).toMatchObject({ state: "taken", tone: "bad", message: "Ya lo usa otro socio del vestuario" });
    expect(nicknameCheck("erik", "adrian_tc", "checking").state).toBe("checking");
    // a broken handle never waits for the lookup
    expect(nicknameCheck("e", "adrian_tc", "checking").state).toBe("short");
  });
});

describe("lo que hacen los campos al escribir", () => {
  it("la espalda en mayúsculas, sin mover el cursor", () => {
    expect(typeShirtName("adrián", 3)).toEqual({ value: "ADRIÁN", caret: 3 });
    expect(typeShirtName("o'neill", 7)).toEqual({ value: "O'NEILL", caret: 7 });
  });
  it("el apodo en minúsculas, sin tildes (ñ → n) ni espacios, con el cursor en su sitio", () => {
    expect(typeNickname("Adrián TC", 7)).toEqual({ value: "adriantc", caret: 6, stripped: true });
    expect(typeNickname("Ñoño", 4)).toEqual({ value: "nono", caret: 4, stripped: true });
    // capitals alone don't show the note
    expect(typeNickname("ERIK", 2)).toEqual({ value: "erik", caret: 2, stripped: false });
    expect(typeNickname("erik_9", 6)).toEqual({ value: "erik_9", caret: 6, stripped: false });
  });
});

describe("el arco del vinilo", () => {
  it("y = t², giro = t·5°, simétrico", () => {
    expect(archOffsets(5)).toEqual([
      { i: 0, y: 1, r: -5 },
      { i: 1, y: 0.25, r: -2.5 },
      { i: 2, y: 0, r: 0 },
      { i: 3, y: 0.25, r: 2.5 },
      { i: 4, y: 1, r: 5 },
    ]);
    expect(archOffsets(4).map((o) => o.y)).toEqual([1, 0.11, 0.11, 1]);
    expect(archOffsets(1)).toEqual([{ i: 0, y: 0, r: 0 }]);
    expect(archOffsets(0)).toEqual([]);
  });
  it("los espacios mantienen su hueco", () => {
    expect(archLetters("T C").map((l) => l.c)).toEqual(["T", " ", "C"]);
  });
});
