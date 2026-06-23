import { describe, it, expect } from "vitest";
import { decideNicknameError, type NicknameErrorInputs } from "./nicknameAvailability";

const base: NicknameErrorInputs = {
  validNickname: "bob",
  debouncedNickname: "bob",
  availabilitySuccess: true,
  available: true,
  ownsTakenError: false,
};

describe("decideNicknameError", () => {
  it("set: el valor válido actual settlea como TAKEN", () => {
    expect(decideNicknameError({ ...base, available: false })).toBe("set");
  });

  it("clear: el MISMO valor válido settlea disponible mientras teníamos el error", () => {
    expect(decideNicknameError({ ...base, available: true, ownsTakenError: true })).toBe("clear");
  });

  it("none: disponible pero no teníamos error (nada que limpiar)", () => {
    expect(decideNicknameError({ ...base, available: true, ownsTakenError: false })).toBe("none");
  });

  it("none: aún en vuelo (debounced no coincide con el valor válido)", () => {
    expect(
      decideNicknameError({ ...base, debouncedNickname: "bo", available: undefined, availabilitySuccess: false }),
    ).toBe("none");
  });

  it("none: query no ha settleado todavía para el valor actual", () => {
    expect(decideNicknameError({ ...base, availabilitySuccess: false, available: undefined })).toBe("none");
  });

  it("release: valor pasó a inválido mientras teníamos el error 'taken' (no debe limpiar)", () => {
    // Edge del fix #1: tras 'bob' taken (ownsTakenError) el usuario borra a 'bo'.
    expect(decideNicknameError({ ...base, validNickname: null, ownsTakenError: true })).toBe("release");
  });

  it("none: valor inválido y no teníamos error", () => {
    expect(decideNicknameError({ ...base, validNickname: null, ownsTakenError: false })).toBe("none");
  });

  it("NO limpia el error de Zod en la transición taken→inválido→nuevo válido en vuelo", () => {
    // 1) 'bob' taken → set (ownsTakenError pasaría a true en el componente)
    expect(decideNicknameError({ ...base, available: false })).toBe("set");
    // 2) backspace a 'bo' (inválido) con error nuestro previo → release (sin clear)
    expect(decideNicknameError({ ...base, validNickname: null, ownsTakenError: true })).toBe("release");
    // 3) tecla → 'boa' (válido) pero aún sin settlear disponibilidad → none (NO clear).
    //    Como el release ya soltó la propiedad (ownsTakenError=false), aquí es 'none'
    //    y el error de Zod (si lo hubiera) queda intacto.
    expect(
      decideNicknameError({
        ...base,
        validNickname: "boa",
        debouncedNickname: "bob",
        available: undefined,
        availabilitySuccess: false,
        ownsTakenError: false,
      }),
    ).toBe("none");
  });
});
